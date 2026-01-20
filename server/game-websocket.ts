import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { db } from './db';
import { liveGameSessions, gameMoves, challenges, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getGameEngine } from './game-engines';
import type { MoveData, WebSocketMessage } from './game-engines/types';
import { chessEngine, ChessEngine } from './game-engines/chess';
import { chatRateLimiter, giftRateLimiter } from './lib/rate-limiter';
import { filterMessage } from './lib/word-filter';
import { settleSpectatorSupports } from './lib/support-settler';
import { JWT_USER_SECRET } from './lib/auth-config';

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
    path: '/ws/game',
    perMessageDeflate: false
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
    const decoded = jwt.verify(payload.token, JWT_USER_SECRET) as { id: string; username: string };
    
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

async function handleMakeMove(ws: AuthenticatedWebSocket, payload: { move: MoveData; expectedTurn?: number }) {
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

  const sessionId = ws.sessionId;
  const userId = ws.userId;

  try {
    const result = await db.transaction(async (tx) => {
      const [lockedSession] = await tx
        .select()
        .from(liveGameSessions)
        .where(eq(liveGameSessions.id, sessionId))
        .for('update');
      
      if (!lockedSession) {
        throw new Error('SESSION_NOT_FOUND');
      }

      const dbState = lockedSession.gameState || engine.createInitialState();
      const dbTurn = lockedSession.turnNumber || 0;
      
      if (payload.expectedTurn !== undefined && payload.expectedTurn !== dbTurn) {
        const error = new Error('TURN_MISMATCH');
        (error as any).dbState = dbState;
        (error as any).dbTurn = dbTurn;
        throw error;
      }

      const validation = engine.validateMove(dbState, userId, payload.move);
      if (!validation.valid) {
        const error = new Error('INVALID_MOVE');
        (error as any).validationError = validation.error;
        (error as any).errorKey = validation.errorKey;
        throw error;
      }

      const applyResult = engine.applyMove(dbState, userId, payload.move);
      if (!applyResult.success) {
        const error = new Error('MOVE_APPLY_FAILED');
        (error as any).applyError = applyResult.error;
        throw error;
      }

      const newTurnNumber = dbTurn + 1;

      await tx
        .update(liveGameSessions)
        .set({
          gameState: applyResult.newState,
          turnNumber: newTurnNumber
        })
        .where(eq(liveGameSessions.id, sessionId));
      
      await tx.insert(gameMoves).values({
        sessionId: sessionId,
        playerId: userId,
        moveNumber: newTurnNumber,
        moveType: payload.move.type || 'move',
        moveData: JSON.stringify(payload.move),
        isValid: true
      });

      return { 
        newState: applyResult.newState, 
        events: applyResult.events, 
        turnNumber: newTurnNumber 
      };
    });
    
    room.gameState = result.newState;
    
    console.log(`[WS] Move committed: session=${sessionId}, turn=${result.turnNumber}, player=${userId}`);
    
    for (const [playerId, playerWs] of room.players) {
      const playerView = engine.getPlayerView(result.newState, playerId);
      send(playerWs, {
        type: 'game_update',
        payload: {
          gameType: room.gameType,
          events: result.events,
          view: playerView,
          turnNumber: result.turnNumber
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
          view: spectatorView,
          turnNumber: result.turnNumber
        }
      });
    }

    const gameStatus = engine.getGameStatus(result.newState);
    if (gameStatus.isOver) {
      await handleGameOver(room, gameStatus);
    }
  } catch (error: any) {
    console.error('[WS] Move transaction failed:', error);
    
    const syncRoom = async () => {
      const freshSession = await storage.getLiveGameSession(sessionId);
      if (freshSession?.gameState) {
        room.gameState = freshSession.gameState;
        const syncView = engine.getPlayerView(freshSession.gameState, userId);
        send(ws, {
          type: 'state_sync',
          payload: {
            gameType: room.gameType,
            view: syncView,
            turnNumber: freshSession.turnNumber
          }
        });
      }
    };
    
    if (error.message === 'SESSION_NOT_FOUND') {
      sendError(ws, 'Session not found', 'SESSION_NOT_FOUND');
    } else if (error.message === 'TURN_MISMATCH') {
      send(ws, {
        type: 'move_rejected',
        payload: { 
          error: 'Game state has changed. Syncing...',
          errorKey: 'game.turnMismatch',
          requiresSync: true
        }
      });
      await syncRoom();
    } else if (error.message === 'INVALID_MOVE') {
      send(ws, {
        type: 'move_rejected',
        payload: { error: error.validationError, errorKey: error.errorKey }
      });
    } else if (error.message === 'MOVE_APPLY_FAILED') {
      send(ws, {
        type: 'move_rejected',
        payload: { error: error.applyError }
      });
    } else {
      sendError(ws, 'Failed to save move. Please try again.');
      await syncRoom();
    }
  }
}

async function handleGameOver(room: GameRoom, status: any) {
  try {
    // Get session to check for stake amount
    const session = await storage.getLiveGameSession(room.sessionId);
    if (!session) {
      console.error('[WS] Session not found for game over:', room.sessionId);
      return;
    }

    // Determine winner and loser for payout
    const winnerId = status.winner;
    const loserId = session.player1Id === winnerId ? session.player2Id : session.player1Id;

    const gameType = session.gameType || 'chess';
    const isDraw = status.status === 'draw' || (status.winner === null && !status.winningTeam);
    let statsUpdatedInPayout = false;

    // Check if this is a paid game via challenge (stats included in payout)
    if (session.challengeId && winnerId && loserId && !isDraw) {
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, session.challengeId));
      
      if (challenge && parseFloat(challenge.betAmount) > 0) {
        let payoutResult;
        
        // Use appropriate payout method based on currency type
        if (challenge.currencyType === 'project') {
          payoutResult = await storage.settleProjectCurrencyGamePayout(
            room.sessionId,
            winnerId,
            loserId,
            challenge.betAmount,
            0,
            gameType
          );
          console.log(`[WS] Using project currency payout for game ${room.sessionId}`);
        } else {
          payoutResult = await storage.settleGamePayout(
            room.sessionId,
            winnerId,
            loserId,
            challenge.betAmount,
            0,
            gameType
          );
        }

        if (!payoutResult.success) {
          console.error('[WS] Payout failed:', payoutResult.error);
        } else {
          statsUpdatedInPayout = true;
          console.log(`[WS] Game payout and stats settled: winner=${winnerId}, stake=${challenge.betAmount}, currency=${challenge.currencyType || 'usd'}`);
        }
      }

      // Settle spectator supports for this challenge
      try {
        const settlementResult = await settleSpectatorSupports(session.challengeId, winnerId);
        if (!settlementResult.success) {
          console.error('[WS] Spectator support settlement had errors:', settlementResult.errors);
        } else {
          console.log(`[WS] Spectator supports settled: ${settlementResult.settledMatches} matches, ${settlementResult.refundedSupports} refunded`);
        }
      } catch (settleError) {
        console.error('[WS] Error settling spectator supports:', settleError);
      }
    }

    // Update session status (if not already done by settleGamePayout)
    await storage.updateLiveGameSession(room.sessionId, {
      status: 'completed',
      winnerId: status.winner,
      winningTeam: status.winningTeam,
      endedAt: new Date()
    });

    // Update stats for non-paid games or draws only (skip if paid game payout was attempted)
    const isPaidGame = session.challengeId && !isDraw;
    if (!statsUpdatedInPayout && !isPaidGame) {
      try {
        await storage.updateGameStats(
          room.sessionId,
          gameType,
          status.winner,
          session.player1Id,
          session.player2Id,
          isDraw,
          '0'
        );
        console.log(`[WS] Game stats updated for session ${room.sessionId}`);
      } catch (statsError) {
        console.error('[WS] Error updating game stats:', statsError);
      }
    } else if (isPaidGame && !statsUpdatedInPayout) {
      console.error(`[WS] Stats not updated for paid game ${room.sessionId} due to payout failure`);
    }

    broadcastToRoom(room, {
      type: 'game_over',
      payload: status
    });
  } catch (error) {
    console.error('[WS] Error handling game over:', error);
  }
}

async function handleChat(ws: AuthenticatedWebSocket, payload: { message: string }) {
  if (!ws.sessionId) {
    sendError(ws, 'Not in a game');
    return;
  }

  if (!ws.userId) {
    sendError(ws, 'Not authenticated');
    return;
  }

  const rateLimitResult = chatRateLimiter.check(ws.userId);
  if (!rateLimitResult.allowed) {
    send(ws, {
      type: 'chat_error',
      payload: { code: 'rate_limit', retryAfterMs: rateLimitResult.retryAfterMs }
    });
    return;
  }

  const filterResult = filterMessage(payload.message);
  const messageToSend = filterResult.filteredMessage;

  const room = rooms.get(ws.sessionId);
  if (!room) return;

  const sender = await storage.getUser(ws.userId);
  const blockedUsers = sender?.blockedUsers || [];
  const mutedUsers = sender?.mutedUsers || [];

  try {
    await storage.addGameChatMessage({
      sessionId: ws.sessionId,
      userId: ws.userId,
      message: messageToSend,
      messageType: 'text',
      isFromSpectator: ws.isSpectator || false
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
  }

  broadcastToRoomFiltered(room, {
    type: 'chat_message',
    payload: {
      userId: ws.userId,
      username: ws.username,
      message: messageToSend,
      isSpectator: ws.isSpectator,
      timestamp: Date.now(),
      wasFiltered: !filterResult.isClean
    }
  }, ws.userId, blockedUsers);
}

async function handleSendGift(ws: AuthenticatedWebSocket, payload: { recipientId: string; giftItemId: string; quantity: number; message?: string }) {
  if (!ws.userId || !ws.sessionId) {
    sendError(ws, 'Not authenticated or not in a game');
    return;
  }

  const rateLimitResult = giftRateLimiter.check(ws.userId);
  if (!rateLimitResult.allowed) {
    send(ws, {
      type: 'gift_error',
      payload: { code: 'rate_limit', retryAfterMs: rateLimitResult.retryAfterMs }
    });
    return;
  }

  const recipient = await storage.getUser(payload.recipientId);
  if (recipient?.blockedUsers?.includes(ws.userId)) {
    sendError(ws, 'Cannot send gift to this user');
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
    const recipientEarnings = totalPrice * (parseFloat(giftItem.creatorShare) / 100);

    // Use transactional transfer for atomic balance update
    const transferResult = await storage.transferBalance(
      ws.userId,
      payload.recipientId,
      recipientEarnings.toString(),
      {
        createTransactionRecords: true,
        transactionType: 'gift',
        description: `Gift: ${giftItem.name} x${payload.quantity}`
      }
    );

    if (!transferResult.success) {
      sendError(ws, transferResult.error || 'Failed to send gift');
      return;
    }

    // Platform keeps the difference (totalPrice - recipientEarnings)
    // Deduct the platform fee from sender separately if needed
    const platformFee = totalPrice - recipientEarnings;
    if (platformFee > 0) {
      await storage.updateUserBalanceWithCheck(ws.userId, platformFee.toString(), 'subtract');
    }

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

    const newBalance = transferResult.fromUser ? parseFloat(transferResult.fromUser.balance) - platformFee : 0;
    send(ws, {
      type: 'gift_sent',
      payload: { success: true, newBalance }
    });

  } catch (error) {
    console.error('[WS] Error sending gift:', error);
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
  handleDisconnect(ws, true);
}

// Track sessions that are already being processed for forfeit to prevent double execution
const forfeitingSessionsLock = new Set<string>();

async function handleDisconnect(ws: AuthenticatedWebSocket, isVoluntaryLeave: boolean = false) {
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
        const disconnectedPlayerId = ws.userId;
        room.players.delete(disconnectedPlayerId);
        
        // Check if this is an active paid game - if so, the disconnecting player loses
        // Use lock + atomic DB update to prevent double forfeit execution
        const sessionId = ws.sessionId;
        if (!forfeitingSessionsLock.has(sessionId)) {
          forfeitingSessionsLock.add(sessionId);
          
          try {
            // Atomic check-and-update: only proceed if session transitions from in_progress to completed
            // This prevents double forfeit by using DB as single source of truth
            const updateResult = await db.update(liveGameSessions)
              .set({ status: 'completed' })
              .where(and(
                eq(liveGameSessions.id, sessionId),
                eq(liveGameSessions.status, 'in_progress')
              ))
              .returning({ id: liveGameSessions.id, player1Id: liveGameSessions.player1Id, player2Id: liveGameSessions.player2Id });
            
            // Only proceed if we successfully transitioned the status
            if (updateResult.length > 0) {
              const session = updateResult[0];
              // Determine the opponent (winner)
              const opponentId = session.player1Id === disconnectedPlayerId 
                ? session.player2Id 
                : session.player1Id;
              
              if (opponentId) {
                // Trigger game over with opponent as winner (forfeit by disconnect/leave)
                console.log(`[WS] Player ${disconnectedPlayerId} ${isVoluntaryLeave ? 'left' : 'disconnected'} - forfeiting game to ${opponentId}`);
                
                await handleGameOver(room, {
                  isOver: true,
                  winner: opponentId,
                  reason: isVoluntaryLeave ? 'abandonment' : 'disconnect'
                });
                
                // Notify remaining players/spectators
                broadcastToRoom(room, {
                  type: 'player_forfeited',
                  payload: { 
                    forfeitedBy: disconnectedPlayerId, 
                    winner: opponentId,
                    reason: isVoluntaryLeave ? 'abandonment' : 'disconnect'
                  }
                });
              }
            }
          } catch (error) {
            console.error('[WS] Error handling disconnect forfeit:', error);
          } finally {
            // Clean up lock after processing
            setTimeout(() => forfeitingSessionsLock.delete(sessionId), 5000);
          }
        }
        
        // Always notify about disconnection
        broadcastToRoom(room, {
          type: 'player_disconnected',
          payload: { userId: disconnectedPlayerId, username: ws.username }
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

async function broadcastToRoomFiltered(
  room: GameRoom, 
  message: WebSocketMessage, 
  senderId: string, 
  senderBlockedUsers: string[]
) {
  for (const [recipientId, ws] of room.players) {
    if (recipientId === senderId) continue;
    if (senderBlockedUsers.includes(recipientId)) continue;
    
    const recipient = await storage.getUser(recipientId);
    if (recipient?.blockedUsers?.includes(senderId)) continue;
    if (recipient?.mutedUsers?.includes(senderId)) continue;
    
    send(ws, message);
  }
  
  for (const [recipientId, ws] of room.spectators) {
    if (recipientId === senderId) continue;
    if (senderBlockedUsers.includes(recipientId)) continue;
    
    const recipient = await storage.getUser(recipientId);
    if (recipient?.blockedUsers?.includes(senderId)) continue;
    if (recipient?.mutedUsers?.includes(senderId)) continue;
    
    send(ws, message);
  }
}

export { rooms, userConnections };
