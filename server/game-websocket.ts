import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { getGameEngine } from './game-engines';
import type { MoveData, WebSocketMessage } from './game-engines/types';
import { chessEngine, ChessEngine } from './game-engines/chess';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  sessionId?: string;
  isSpectator?: boolean;
  isAlive?: boolean;
  spectatorId?: string;
}

interface GameRoom {
  sessionId: string;
  players: Map<string, AuthenticatedWebSocket>;
  spectators: Map<string, AuthenticatedWebSocket>;
  gameType: string;
  gameState: string;
}

const rooms: Map<string, GameRoom> = new Map();
const userConnections: Map<string, AuthenticatedWebSocket> = new Map();

export function setupGameWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws/game'
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;
      if (client.isAlive === false) {
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      handleDisconnect(ws);
    });
  });

  return wss;
}

async function handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
  switch (message.type) {
    case 'authenticate':
      await handleAuthenticate(ws, message.payload);
      break;
    case 'join_game':
      await handleJoinGame(ws, message.payload);
      break;
    case 'spectate':
      await handleSpectate(ws, message.payload);
      break;
    case 'make_move':
      await handleMakeMove(ws, message.payload);
      break;
    case 'chat':
      await handleChat(ws, message.payload);
      break;
    case 'send_gift':
      await handleSendGift(ws, message.payload);
      break;
    case 'leave_game':
      handleLeaveGame(ws);
      break;
    case 'get_state':
      await handleGetState(ws, message.payload);
      break;
    case 'resign':
      await handleResign(ws, message.payload);
      break;
    case 'offer_draw':
      await handleOfferDraw(ws, message.payload);
      break;
    case 'respond_draw':
      await handleRespondDraw(ws, message.payload);
      break;
    default:
      sendError(ws, 'Unknown message type');
  }
}

async function handleAuthenticate(ws: AuthenticatedWebSocket, payload: { token: string }) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      if (isProduction) {
        console.error('[WebSocket] JWT_SECRET is not set in production');
        sendError(ws, 'Server configuration error');
        return;
      }
      console.warn('[WebSocket] Using development JWT secret - DO NOT use in production');
    }
    
    const jwtSecret = secret || 'development-secret-key';
    const decoded = jwt.verify(payload.token, jwtSecret) as { id: string; username: string };
    
    ws.userId = decoded.id;
    ws.username = decoded.username;
    userConnections.set(decoded.id, ws);

    send(ws, {
      type: 'authenticated',
      payload: { userId: decoded.id, username: decoded.username }
    });
  } catch (error) {
    sendError(ws, 'Authentication failed');
  }
}

async function handleJoinGame(ws: AuthenticatedWebSocket, payload: { sessionId: string }) {
  if (!ws.userId) {
    sendError(ws, 'Not authenticated');
    return;
  }

  const { sessionId } = payload;

  try {
    const session = await storage.getLiveGameSession(sessionId);
    if (!session) {
      sendError(ws, 'Game session not found');
      return;
    }

    const isPlayer = [session.player1Id, session.player2Id, session.player3Id, session.player4Id].includes(ws.userId);
    
    if (!isPlayer) {
      sendError(ws, 'You are not a player in this game');
      return;
    }

    let room = rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        players: new Map(),
        spectators: new Map(),
        gameType: session.gameType,
        gameState: session.gameState || getGameEngine(session.gameType)?.createInitialState() || '{}'
      };
      rooms.set(sessionId, room);
    }

    room.players.set(ws.userId, ws);
    ws.sessionId = sessionId;
    ws.isSpectator = false;

    const engine = getGameEngine(session.gameType);
    const playerView = engine?.getPlayerView(room.gameState, ws.userId);

    const playerIds = [session.player1Id, session.player2Id, session.player3Id, session.player4Id];
    const seatIndex = playerIds.indexOf(ws.userId);
    const playerSeat = seatIndex !== -1 ? seatIndex + 1 : null;
    const playerColor = session.gameType === 'chess' 
      ? (playerSeat === 1 ? 'w' : (playerSeat === 2 ? 'b' : null))
      : null;

    let opponent = null;
    const opponentIds = playerIds.filter((id) => id && id !== ws.userId);
    if (opponentIds.length > 0) {
      const opponentUser = await storage.getUser(opponentIds[0]!);
      if (opponentUser) {
        opponent = { id: opponentIds[0], username: opponentUser.username };
      }
    }

    send(ws, {
      type: 'game_joined',
      payload: {
        sessionId,
        gameType: session.gameType,
        view: playerView,
        playerColor,
        playerSeat,
        isSpectator: false,
        opponent,
        players: getPlayerList(room),
        spectatorCount: room.spectators.size,
        status: session.status,
        turnNumber: session.turnNumber
      }
    });

    broadcastToRoom(room, {
      type: 'player_joined',
      payload: { userId: ws.userId, username: ws.username }
    }, ws.userId);

  } catch (error) {
    console.error('Error joining game:', error);
    sendError(ws, 'Failed to join game');
  }
}

async function handleSpectate(ws: AuthenticatedWebSocket, payload: { sessionId: string }) {
  const { sessionId } = payload;

  try {
    const session = await storage.getLiveGameSession(sessionId);
    if (!session) {
      sendError(ws, 'Game session not found');
      return;
    }

    let room = rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        players: new Map(),
        spectators: new Map(),
        gameType: session.gameType,
        gameState: session.gameState || '{}'
      };
      rooms.set(sessionId, room);
    }

    const spectatorId = ws.userId || `anon_${Date.now()}`;
    room.spectators.set(spectatorId, ws);
    ws.sessionId = sessionId;
    ws.isSpectator = true;
    ws.spectatorId = spectatorId;

    if (ws.userId) {
      await storage.addGameSpectator({
        sessionId,
        userId: ws.userId
      });
    }

    const engine = getGameEngine(session.gameType);
    const spectatorView = engine?.getPlayerView(room.gameState, 'spectator');

    send(ws, {
      type: 'spectating',
      payload: {
        sessionId,
        gameType: session.gameType,
        view: spectatorView,
        playerSeat: null,
        isSpectator: true,
        players: getPlayerList(room),
        spectatorCount: room.spectators.size,
        status: session.status
      }
    });

    broadcastToRoom(room, {
      type: 'spectator_joined',
      payload: { spectatorCount: room.spectators.size }
    });

  } catch (error) {
    console.error('Error spectating game:', error);
    sendError(ws, 'Failed to spectate game');
  }
}

async function handleMakeMove(ws: AuthenticatedWebSocket, payload: { move: MoveData }) {
  if (!ws.userId || !ws.sessionId) {
    sendError(ws, 'Not in a game');
    return;
  }

  if (ws.isSpectator) {
    sendError(ws, 'Spectators cannot make moves');
    return;
  }

  const room = rooms.get(ws.sessionId);
  if (!room) {
    sendError(ws, 'Game room not found');
    return;
  }

  const engine = getGameEngine(room.gameType);
  if (!engine) {
    sendError(ws, 'Game engine not available');
    return;
  }

  const validation = engine.validateMove(room.gameState, ws.userId, payload.move);
  if (!validation.valid) {
    send(ws, {
      type: 'move_rejected',
      payload: { error: validation.error, errorKey: validation.errorKey }
    });
    return;
  }

  const result = engine.applyMove(room.gameState, ws.userId, payload.move);
  if (!result.success) {
    send(ws, {
      type: 'move_rejected',
      payload: { error: result.error }
    });
    return;
  }

  room.gameState = result.newState;

  try {
    const currentSession = await storage.getLiveGameSession(ws.sessionId);
    const currentTurn = currentSession?.turnNumber || 0;
    const newTurnNumber = currentTurn + 1;
    
    await storage.updateLiveGameSession(ws.sessionId, {
      gameState: result.newState,
      turnNumber: newTurnNumber
    });

    await storage.addGameMove({
      sessionId: ws.sessionId,
      playerId: ws.userId,
      moveNumber: newTurnNumber,
      moveType: payload.move.type,
      moveData: JSON.stringify(payload.move),
      isValid: true
    });

    console.log(`[WS] Move saved: session=${ws.sessionId}, turn=${newTurnNumber}, player=${ws.userId}`);
  } catch (error) {
    console.error('[WS] Error saving move:', error);
    sendError(ws, 'Failed to save move. Please try again.');
    return;
  }

  for (const [playerId, playerWs] of room.players) {
    const playerView = engine.getPlayerView(result.newState, playerId);
    send(playerWs, {
      type: 'game_update',
      payload: {
        gameType: room.gameType,
        events: result.events,
        view: playerView
      }
    });
  }

  const spectatorView = engine.getPlayerView(result.newState, 'spectator');
  for (const [, spectatorWs] of room.spectators) {
    send(spectatorWs, {
      type: 'game_update',
      payload: {
        gameType: room.gameType,
        events: result.events,
        view: spectatorView
      }
    });
  }

  const gameStatus = engine.getGameStatus(result.newState);
  if (gameStatus.isOver) {
    await handleGameOver(room, gameStatus);
  }
}

async function handleGameOver(room: GameRoom, status: any) {
  try {
    await storage.updateLiveGameSession(room.sessionId, {
      status: 'completed',
      winnerId: status.winner,
      winningTeam: status.winningTeam,
      endedAt: new Date()
    });

    broadcastToRoom(room, {
      type: 'game_over',
      payload: status
    });
  } catch (error) {
    console.error('Error handling game over:', error);
  }
}

async function handleChat(ws: AuthenticatedWebSocket, payload: { message: string }) {
  if (!ws.sessionId) {
    sendError(ws, 'Not in a game');
    return;
  }

  const room = rooms.get(ws.sessionId);
  if (!room) return;

  if (ws.userId) {
    try {
      await storage.addGameChatMessage({
        sessionId: ws.sessionId,
        userId: ws.userId,
        message: payload.message,
        messageType: 'text',
        isFromSpectator: ws.isSpectator || false
      });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  }

  broadcastToRoom(room, {
    type: 'chat_message',
    payload: {
      userId: ws.userId,
      username: ws.username,
      message: payload.message,
      isSpectator: ws.isSpectator,
      timestamp: Date.now()
    }
  });
}

async function handleSendGift(ws: AuthenticatedWebSocket, payload: { recipientId: string; giftItemId: string; quantity: number; message?: string }) {
  if (!ws.userId || !ws.sessionId) {
    sendError(ws, 'Not authenticated or not in a game');
    return;
  }

  const room = rooms.get(ws.sessionId);
  if (!room) return;

  try {
    const giftItem = await storage.getGiftItem(payload.giftItemId);
    if (!giftItem) {
      sendError(ws, 'Gift not found');
      return;
    }

    const totalPrice = parseFloat(giftItem.price) * payload.quantity;
    const sender = await storage.getUser(ws.userId);
    
    if (!sender || parseFloat(sender.balance) < totalPrice) {
      sendError(ws, 'Insufficient balance');
      return;
    }

    const recipientEarnings = totalPrice * (parseFloat(giftItem.creatorShare) / 100);

    await storage.updateUserBalance(ws.userId, totalPrice.toString(), 'subtract');
    await storage.updateUserBalance(payload.recipientId, recipientEarnings.toString(), 'add');

    await storage.addSpectatorGift({
      sessionId: ws.sessionId,
      senderId: ws.userId,
      recipientId: payload.recipientId,
      giftItemId: payload.giftItemId,
      quantity: payload.quantity,
      totalPrice: totalPrice.toString(),
      recipientEarnings: recipientEarnings.toString(),
      message: payload.message
    });

    broadcastToRoom(room, {
      type: 'gift_received',
      payload: {
        senderId: ws.userId,
        senderUsername: ws.username,
        recipientId: payload.recipientId,
        giftItem: giftItem,
        quantity: payload.quantity,
        message: payload.message
      }
    });

    send(ws, {
      type: 'gift_sent',
      payload: { success: true, newBalance: parseFloat(sender.balance) - totalPrice }
    });

  } catch (error) {
    console.error('Error sending gift:', error);
    sendError(ws, 'Failed to send gift');
  }
}

async function handleGetState(ws: AuthenticatedWebSocket, payload: { sessionId: string }) {
  try {
    const session = await storage.getLiveGameSession(payload.sessionId);
    if (!session) {
      sendError(ws, 'Game not found', 'SESSION_NOT_FOUND');
      return;
    }

    let room = rooms.get(payload.sessionId);
    
    if (room && session.gameState) {
      room.gameState = session.gameState;
    } else if (!room) {
      room = {
        sessionId: payload.sessionId,
        players: new Map(),
        spectators: new Map(),
        gameType: session.gameType,
        gameState: session.gameState || getGameEngine(session.gameType)?.createInitialState() || '{}'
      };
      rooms.set(payload.sessionId, room);
    }

    const engine = getGameEngine(room.gameType);
    const playerView = engine?.getPlayerView(room.gameState, ws.userId || 'spectator');

    let opponent = null;
    let playerSeat: number | null = null;
    let playerColor: 'w' | 'b' | null = null;
    
    if (ws.userId) {
      const playerIds = [session.player1Id, session.player2Id, session.player3Id, session.player4Id];
      playerSeat = playerIds.indexOf(ws.userId);
      
      if (playerSeat === -1) {
        playerSeat = null;
      } else {
        playerSeat = playerSeat + 1;
        
        if (room.gameType === 'chess') {
          playerColor = playerSeat === 1 ? 'w' : 'b';
        }
        
        const opponentIds = playerIds.filter((id, idx) => id && id !== ws.userId);
        if (opponentIds.length > 0) {
          const opponentUser = await storage.getUser(opponentIds[0]!);
          if (opponentUser) {
            opponent = { id: opponentIds[0], username: opponentUser.username };
          }
        }
      }
    }

    const chatMessages = await storage.getGameChatMessages(payload.sessionId);

    console.log(`[WS] State sync for session ${payload.sessionId}, player ${ws.userId}`);

    send(ws, {
      type: 'state_sync',
      payload: {
        sessionId: payload.sessionId,
        gameType: room.gameType,
        view: playerView,
        playerColor,
        playerSeat,
        isSpectator: playerSeat === null,
        opponent,
        players: getPlayerList(room),
        spectatorCount: room.spectators.size,
        chatMessages: chatMessages?.slice(-50) || [],
        status: session.status,
        turnNumber: session.turnNumber
      }
    });
  } catch (error) {
    console.error('[WS] Error getting state:', error);
    sendError(ws, 'Failed to get game state');
  }
}

async function handleResign(ws: AuthenticatedWebSocket, payload: { sessionId: string }) {
  if (!ws.userId || !ws.sessionId) {
    sendError(ws, 'Not in a game');
    return;
  }

  const room = rooms.get(ws.sessionId);
  if (!room) return;

  const session = await storage.getLiveGameSession(ws.sessionId);
  if (!session) return;

  const winner = session.player1Id === ws.userId ? session.player2Id : session.player1Id;

  await handleGameOver(room, {
    isOver: true,
    winner,
    reason: 'resignation'
  });
}

async function handleOfferDraw(ws: AuthenticatedWebSocket, payload: { sessionId: string }) {
  if (!ws.sessionId) return;

  const room = rooms.get(ws.sessionId);
  if (!room) return;

  for (const [playerId, playerWs] of room.players) {
    if (playerId !== ws.userId) {
      send(playerWs, {
        type: 'draw_offered',
        payload: { offeredBy: ws.userId, offeredByUsername: ws.username }
      });
    }
  }
}

async function handleRespondDraw(ws: AuthenticatedWebSocket, payload: { accept: boolean }) {
  if (!ws.sessionId) return;

  const room = rooms.get(ws.sessionId);
  if (!room) return;

  if (payload.accept) {
    await handleGameOver(room, {
      isOver: true,
      isDraw: true,
      reason: 'agreement'
    });
  } else {
    broadcastToRoom(room, {
      type: 'draw_declined',
      payload: { declinedBy: ws.userId }
    });
  }
}

function handleLeaveGame(ws: AuthenticatedWebSocket) {
  handleDisconnect(ws);
}

function handleDisconnect(ws: AuthenticatedWebSocket) {
  if (ws.userId) {
    userConnections.delete(ws.userId);
  }

  if (ws.sessionId) {
    const room = rooms.get(ws.sessionId);
    if (room) {
      if (ws.isSpectator && ws.spectatorId) {
        room.spectators.delete(ws.spectatorId);
        broadcastToRoom(room, {
          type: 'spectator_left',
          payload: { spectatorCount: room.spectators.size }
        });
      } else if (ws.userId) {
        room.players.delete(ws.userId);
        broadcastToRoom(room, {
          type: 'player_disconnected',
          payload: { userId: ws.userId, username: ws.username }
        });
      }

      if (room.players.size === 0 && room.spectators.size === 0) {
        rooms.delete(ws.sessionId);
      }
    }
  }
}

function getPlayerList(room: GameRoom): { id: string; username?: string }[] {
  return Array.from(room.players.entries()).map(([id, ws]) => ({
    id,
    username: ws.username
  }));
}

function send(ws: WebSocket, message: WebSocketMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, message: string, code?: string) {
  send(ws, { type: 'error', payload: { message, code } });
}

function broadcastToRoom(room: GameRoom, message: WebSocketMessage, excludeUserId?: string) {
  for (const [userId, ws] of room.players) {
    if (userId !== excludeUserId) {
      send(ws, message);
    }
  }
  for (const [userId, ws] of room.spectators) {
    if (userId !== excludeUserId) {
      send(ws, message);
    }
  }
}

export { rooms, userConnections };
