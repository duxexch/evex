import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';

interface GameState {
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

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

interface WebSocketMessage {
  type: string;
  payload: any;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useGameWebSocket(sessionId: string | null) {
  const { user, token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [spectators, setSpectators] = useState<{ id: string; username: string }[]>([]);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [gameResult, setGameResult] = useState<{ winner: string | null; reason: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'authenticated':
        if (sessionIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_game',
            payload: { sessionId: sessionIdRef.current }
          }));
        }
        break;

      case 'game_joined':
        setPlayerColor(message.payload.playerColor);
        setOpponent(message.payload.opponent);
        setGameState(message.payload.gameState);
        break;

      case 'game_state':
        setGameState(message.payload);
        break;

      case 'move_made':
        setGameState(message.payload.gameState);
        setDrawOffered(false);
        setDrawOfferReceived(false);
        break;

      case 'chat_message':
        setChatMessages(prev => [...prev, message.payload]);
        break;

      case 'spectator_joined':
        setSpectators(prev => [...prev, message.payload]);
        break;

      case 'spectator_left':
        setSpectators(prev => prev.filter(s => s.id !== message.payload.id));
        break;

      case 'draw_offered':
        setDrawOfferReceived(true);
        break;

      case 'draw_declined':
        setDrawOffered(false);
        break;

      case 'game_over':
        setGameResult({
          winner: message.payload.winner,
          reason: message.payload.reason
        });
        break;

      case 'error':
        setError(message.payload.message);
        break;

      case 'pong':
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  useEffect(() => {
    if (!token || !sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game`;
    
    setConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({
        type: 'authenticate',
        payload: { token }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      if (reconnectAttemptsRef.current < maxReconnectAttempts && sessionIdRef.current) {
        reconnectAttemptsRef.current++;
        setTimeout(() => {
          if (token && sessionIdRef.current) {
            const newWs = new WebSocket(wsUrl);
            wsRef.current = newWs;
          }
        }, 2000 * reconnectAttemptsRef.current);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      setError('Connection error');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, sessionId, handleMessage]);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, []);

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'make_move',
      payload: { sessionId: sessionIdRef.current, from, to, promotion }
    }));
  }, []);

  const sendChat = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      payload: { sessionId: sessionIdRef.current, content }
    }));
  }, []);

  const resign = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'resign',
      payload: { sessionId: sessionIdRef.current }
    }));
  }, []);

  const offerDraw = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'offer_draw',
      payload: { sessionId: sessionIdRef.current }
    }));
    setDrawOffered(true);
  }, []);

  const respondDraw = useCallback((accept: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'respond_draw',
      payload: { sessionId: sessionIdRef.current, accept }
    }));
    setDrawOfferReceived(false);
  }, []);

  return {
    connectionStatus,
    gameState,
    playerColor,
    opponent,
    chatMessages,
    spectators,
    drawOffered,
    drawOfferReceived,
    gameResult,
    error,
    makeMove,
    sendChat,
    resign,
    offerDraw,
    respondDraw
  };
}
