import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';

interface ChessGameState {
  fen: string;
  currentTurn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  lastMove?: { from: string; to: string };
  validMoves: string[];
  capturedPieces: { white: string[]; black: string[] };
  moveHistory: { notation: string; player: 'w' | 'b'; moveNumber: number }[];
  whiteTime: number;
  blackTime: number;
}

interface DominoGameState {
  tiles: any[];
  currentTurn: string;
  playerTiles: any[];
  board: any[];
}

interface BackgammonGameState {
  board: number[];
  currentTurn: 'white' | 'black';
  dice: number[];
  diceUsed: boolean[];
  bar: { white: number; black: number };
  borneOff: { white: number; black: number };
  validMoves: Array<{ type: string; from: string; to: string }>;
  mustRoll: boolean;
  gamePhase: 'rolling' | 'moving' | 'finished';
  myColor: 'white' | 'black' | 'spectator';
  players: { white: string; black: string };
}

interface CardGameState {
  hand: any[];
  currentTurn: string;
  playedCards: any[];
  scores: Record<string, number>;
}

type GameState = ChessGameState | DominoGameState | BackgammonGameState | CardGameState | Record<string, any>;

interface ChatMessage {
  id?: string;
  userId?: string;
  username: string;
  message: string;
  isSpectator?: boolean;
  timestamp: number | string;
}

interface WebSocketMessage {
  type: string;
  payload: any;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'syncing' | 'error';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function getReconnectDelay(attempt: number): number {
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
  const jitter = delay * 0.2 * Math.random();
  return delay + jitter;
}

export function useGameWebSocket(sessionId: string | null) {
  const { user, token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [gameType, setGameType] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [gameResult, setGameResult] = useState<{ winner: string | null; reason: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState<number>(0);
  const [isMovePending, setIsMovePending] = useState(false);

  const reconnectAttemptsRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  const tokenRef = useRef(token);
  const isIntentionalCloseRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());

  sessionIdRef.current = sessionId;
  tokenRef.current = token;

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'authenticated':
        console.log('[WS] Authenticated, joining game...');
        if (sessionIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_game',
            payload: { sessionId: sessionIdRef.current }
          }));
        }
        break;

      case 'game_joined':
        console.log('[WS] Game joined successfully');
        setConnectionStatus('connected');
        if (message.payload.gameType) setGameType(message.payload.gameType);
        if (message.payload.playerColor) setPlayerColor(message.payload.playerColor);
        if (message.payload.opponent) setOpponent(message.payload.opponent);
        if (message.payload.view) setGameState(message.payload.view);
        if (message.payload.turnNumber !== undefined) {
          console.log('[WS] Turn number from join:', message.payload.turnNumber);
          setTurnNumber(message.payload.turnNumber);
        }
        setError(null);
        setIsMovePending(false);
        
        if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
          console.log('[WS] Requesting state sync after join');
          wsRef.current.send(JSON.stringify({
            type: 'get_state',
            payload: { sessionId: sessionIdRef.current }
          }));
        }
        break;

      case 'state_sync':
        console.log('[WS] State synced from server, turn:', message.payload.turnNumber);
        setConnectionStatus('connected');
        if (message.payload.gameType) {
          setGameType(message.payload.gameType);
        }
        if (message.payload.view) {
          setGameState(message.payload.view);
        }
        if (message.payload.playerColor) {
          setPlayerColor(message.payload.playerColor);
        }
        if (message.payload.opponent) {
          setOpponent(message.payload.opponent);
        }
        if (message.payload.chatMessages) {
          setChatMessages(message.payload.chatMessages);
        }
        if (message.payload.turnNumber !== undefined) {
          setTurnNumber(message.payload.turnNumber);
        }
        setIsMovePending(false);
        break;

      case 'game_state':
        setGameState(message.payload);
        break;

      case 'move_made':
        if (message.payload.view) {
          setGameState(message.payload.view);
        } else if (message.payload.gameState) {
          setGameState(message.payload.gameState);
        }
        setDrawOffered(false);
        setDrawOfferReceived(false);
        break;

      case 'game_update':
        if (message.payload.gameType) {
          setGameType(message.payload.gameType);
        }
        if (message.payload.view) {
          setGameState(message.payload.view);
        }
        if (message.payload.turnNumber !== undefined) {
          console.log('[WS] Turn number updated:', message.payload.turnNumber);
          setTurnNumber(message.payload.turnNumber);
        }
        setIsMovePending(false);
        break;

      case 'move_rejected':
        console.warn('[WS] Move rejected:', message.payload.error);
        setIsMovePending(false);
        // Server sends requiresSync: true for TURN_MISMATCH and automatically syncs
        // We just need to reset turnNumber when state_sync arrives (handled above)
        if (message.payload.requiresSync) {
          console.log('[WS] Move rejected due to state mismatch, awaiting server sync...');
        }
        break;

      case 'spectating':
        console.log('[WS] Spectating game');
        setConnectionStatus('connected');
        if (message.payload.gameType) setGameType(message.payload.gameType);
        if (message.payload.view) setGameState(message.payload.view);
        setError(null);
        break;

      case 'chat_message':
        setChatMessages(prev => [...prev, message.payload]);
        break;

      case 'spectator_joined':
        if (message.payload.spectatorCount !== undefined) {
          setSpectatorCount(message.payload.spectatorCount);
        }
        break;

      case 'spectator_left':
        if (message.payload.spectatorCount !== undefined) {
          setSpectatorCount(message.payload.spectatorCount);
        }
        break;

      case 'draw_offered':
        setDrawOfferReceived(true);
        break;

      case 'draw_declined':
        setDrawOffered(false);
        break;

      case 'game_over':
        console.log('[WS] Game over:', message.payload.reason);
        setGameResult({
          winner: message.payload.winner,
          reason: message.payload.reason
        });
        break;

      case 'error':
        console.error('[WS] Server error:', message.payload.message);
        setError(message.payload.message);
        if (message.payload.code === 'SESSION_NOT_FOUND' || message.payload.code === 'NOT_AUTHORIZED') {
          isIntentionalCloseRef.current = true;
          wsRef.current?.close();
        }
        break;

      case 'pong':
        lastPongRef.current = Date.now();
        break;

      default:
        console.log('[WS] Unknown message type:', message.type);
    }
  }, []);

  const connect = useCallback(() => {
    if (!tokenRef.current || !sessionIdRef.current) {
      console.log('[WS] Cannot connect: missing token or sessionId');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WS] Already connected or connecting');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game`;
    
    console.log('[WS] Connecting to', wsUrl);
    setConnectionStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connection opened, authenticating...');
      reconnectAttemptsRef.current = 0;
      lastPongRef.current = Date.now();
      
      ws.send(JSON.stringify({
        type: 'authenticate',
        payload: { token: tokenRef.current }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Connection closed:', event.code, event.reason);
      wsRef.current = null;
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (isIntentionalCloseRef.current) {
        setConnectionStatus('disconnected');
        isIntentionalCloseRef.current = false;
        return;
      }
      
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && sessionIdRef.current) {
        const delay = getReconnectDelay(reconnectAttemptsRef.current);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        setConnectionStatus('reconnecting');
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        console.log('[WS] Max reconnect attempts reached');
        setConnectionStatus('error');
        setError('Connection lost. Please refresh the page to reconnect.');
      }
    };

    ws.onerror = (event) => {
      console.error('[WS] Connection error:', event);
    };

    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const timeSinceLastPong = Date.now() - lastPongRef.current;
        if (timeSinceLastPong > 60000) {
          console.log('[WS] Pong timeout, closing connection');
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }, [handleMessage]);

  const requestStateSync = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    console.log('[WS] Requesting state sync...');
    setConnectionStatus('syncing');
    wsRef.current.send(JSON.stringify({
      type: 'get_state',
      payload: { sessionId: sessionIdRef.current }
    }));
  }, []);

  useEffect(() => {
    if (!token || !sessionId) {
      if (wsRef.current) {
        isIntentionalCloseRef.current = true;
        wsRef.current.close();
      }
      return;
    }

    connect();

    return () => {
      isIntentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, sessionId, connect]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionIdRef.current) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          requestStateSync();
        } else if (wsRef.current?.readyState !== WebSocket.CONNECTING) {
          reconnectAttemptsRef.current = 0;
          connect();
        }
      }
    };

    const handleOnline = () => {
      if (sessionIdRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
        console.log('[WS] Network online, reconnecting...');
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [connect, requestStateSync]);

  const turnNumberRef = useRef(turnNumber);
  turnNumberRef.current = turnNumber;

  const makeMove = useCallback((moveData: Record<string, any> | string, to?: string, promotion?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot make move: not connected');
      return false;
    }
    
    if (isMovePending) {
      console.warn('[WS] Cannot make move: previous move pending');
      return false;
    }
    
    let move: any;
    if (typeof moveData === 'object') {
      move = moveData;
      console.log('[WS] Making move (object):', move, 'expectedTurn:', turnNumberRef.current);
    } else {
      move = { from: moveData, to, promotion };
      console.log('[WS] Making move:', moveData, '->', to, 'expectedTurn:', turnNumberRef.current);
    }
    
    setIsMovePending(true);
    
    wsRef.current.send(JSON.stringify({
      type: 'make_move',
      payload: { 
        sessionId: sessionIdRef.current, 
        move,
        expectedTurn: turnNumberRef.current
      }
    }));
    return true;
  }, [isMovePending]);

  const sendChat = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      payload: { sessionId: sessionIdRef.current, message: content }
    }));
    return true;
  }, []);

  const resign = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    
    console.log('[WS] Resigning game');
    wsRef.current.send(JSON.stringify({
      type: 'resign',
      payload: { sessionId: sessionIdRef.current }
    }));
    return true;
  }, []);

  const offerDraw = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    
    console.log('[WS] Offering draw');
    wsRef.current.send(JSON.stringify({
      type: 'offer_draw',
      payload: { sessionId: sessionIdRef.current }
    }));
    setDrawOffered(true);
    return true;
  }, []);

  const respondDraw = useCallback((accept: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    
    console.log('[WS] Responding to draw:', accept ? 'accept' : 'decline');
    wsRef.current.send(JSON.stringify({
      type: 'respond_draw',
      payload: { sessionId: sessionIdRef.current, accept }
    }));
    setDrawOfferReceived(false);
    return true;
  }, []);

  const forceReconnect = useCallback(() => {
    console.log('[WS] Force reconnecting...');
    reconnectAttemptsRef.current = 0;
    setError(null);
    if (wsRef.current) {
      isIntentionalCloseRef.current = true;
      wsRef.current.close();
    }
    setTimeout(() => {
      isIntentionalCloseRef.current = false;
      connect();
    }, 100);
  }, [connect]);

  return {
    connectionStatus,
    gameType,
    gameState,
    playerColor,
    opponent,
    chatMessages,
    spectatorCount,
    drawOffered,
    drawOfferReceived,
    gameResult,
    error,
    turnNumber,
    isMovePending,
    makeMove,
    sendChat,
    resign,
    offerDraw,
    respondDraw,
    forceReconnect,
    requestStateSync
  };
}
