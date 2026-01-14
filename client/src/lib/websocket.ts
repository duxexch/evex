import { useState, useEffect, useRef, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

interface UseWebSocketReturn {
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: object) => void;
  isConnected: boolean;
}

export function useWebSocket(): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        
        // Authenticate if we have a token
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (token) {
          ws.send(JSON.stringify({ type: "auth", token }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt reconnection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Failed to connect, retry after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { lastMessage, sendMessage, isConnected };
}
