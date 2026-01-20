import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth, useAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { getPendingGameStartMessages, acknowledgeGameStartMessage } from "@/lib/challenges-api";

interface Notification {
  id: string;
  userId: string;
  type: "announcement" | "transaction" | "security" | "promotion" | "system" | "p2p";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  titleAr: string | null;
  message: string;
  messageAr: string | null;
  link: string | null;
  metadata: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface GameStartEvent {
  challengeId: string;
  sessionId: string;
  gameType: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  redirectUrl: string;
}

export function useNotifications() {
  const { token, user } = useAuth();
  const headers = useAuthHeaders();
  const { toast } = useToast();
  const { language } = useI18n();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingTimeoutRef = useRef<NodeJS.Timeout>();
  const [gameStartEvent, setGameStartEvent] = useState<GameStartEvent | null>(null);
  const [showGameStartModal, setShowGameStartModal] = useState(false);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { headers });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count", { headers });
      if (!res.ok) throw new Error("Failed to fetch unread count");
      const data = await res.json();
      return data.count;
    },
    enabled: !!token,
    refetchInterval: 10000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  /**
   * Polling fallback for game start messages
   * Triggers when WebSocket is not connected
   */
  const pollForPendingMessages = useCallback(async () => {
    if (isConnected || !user?.id) return;
    
    try {
      const result = await getPendingGameStartMessages();
      if (result.messages && result.messages.length > 0) {
        const message = result.messages[0];
        console.log('[Polling] Found pending game start message:', message);
        setGameStartEvent(message);
        setShowGameStartModal(true);
        await acknowledgeGameStartMessage(message.payload.challengeId);
        
        toast({
          title: language === 'ar' ? 'بدأت المباراة!' : 'Game Started!',
          description: language === 'ar' ? 'انتقل إلى شاشة اللعب' : 'Moving to game screen',
        });
      }
    } catch (error) {
      console.error('[Polling] Error:', error);
    }
  }, [isConnected, user?.id, toast, language]);

  const connectWebSocket = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected, sending auth token');
      ws.send(JSON.stringify({ type: "auth", token }));
      
      // Clear polling when WebSocket connects
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = undefined;
      }

      // Check if we're waiting for a game start
      const awaitingGameStart = sessionStorage.getItem('awaiting_game_start');
      if (awaitingGameStart) {
        console.log('[WebSocket] Connected while awaiting game start for challenge:', awaitingGameStart);
        // Immediately poll for the message
        pollForPendingMessages();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        console.log('[WebSocket] Message received:', data.type);
        
        if (data.type === "new_notification") {
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
          
          const notification = data.data as Notification;
          const title = language === "ar" && notification.titleAr ? notification.titleAr : notification.title;
          const message = language === "ar" && notification.messageAr ? notification.messageAr : notification.message;
          
          toast({
            title,
            description: message,
            variant: notification.priority === "urgent" || notification.priority === "high" ? "destructive" : "default",
          });
        }
        
        if (data.type === "unread_notifications") {
          queryClient.setQueryData(["/api/notifications"], data.data);
        }

        // Handle system events like game config changes
        if (data.type === "system_event") {
          const event = data.event;
          if (event?.type === 'game_config_changed') {
            // Invalidate multiplayer games cache to refresh game config
            queryClient.invalidateQueries({ queryKey: ['/api/multiplayer-games'] });
            queryClient.invalidateQueries({ queryKey: ['/api/config-version/multiplayer_games_version'] });
            
            // Show user-facing toast notification
            toast({
              title: language === 'ar' ? 'تم تحديث إعدادات اللعبة' : 'Game settings updated',
              description: language === 'ar' 
                ? 'تم تطبيق أحدث إعدادات اللعبة' 
                : 'Latest game configuration has been applied',
            });
          }
        }

        // Handle real-time challenge updates
        if (data.type === "challenge_update") {
          // Invalidate all challenge-related queries for real-time updates
          queryClient.invalidateQueries({ queryKey: ['/api/challenges/public'] });
          queryClient.invalidateQueries({ queryKey: ['/api/challenges/available'] });
          queryClient.invalidateQueries({ queryKey: ['/api/challenges/my'] });
          
          // Show toast for new challenges (optional - can be noisy)
          if (data.eventType === 'created' && data.data?.visibility === 'public') {
            toast({
              title: language === 'ar' ? 'تحدي جديد!' : 'New Challenge!',
              description: language === 'ar' 
                ? `${data.data.player1Name} أنشأ تحدي ${data.data.gameType}` 
                : `${data.data.player1Name} created a ${data.data.gameType} challenge`,
            });
          }
        }

        // Handle game start - redirect players to game screen with modal
        if (data.type === "game_start") {
          const payload = data.payload;
          console.log('[WebSocket] game_start event received:', payload);
          console.log('[WebSocket] Current user ID:', user?.id);
          console.log('[WebSocket] Is this our game?', payload && user?.id && (payload.player1Id === user.id || payload.player2Id === user.id));
          
          if (payload && user?.id) {
            if (payload.player1Id === user.id || payload.player2Id === user.id) {
              console.log('[WebSocket] ✓ This is our game! Setting modal');
              setGameStartEvent(payload);
              setShowGameStartModal(true);
              
              // Clear the awaiting flag
              sessionStorage.removeItem('awaiting_game_start');
              
              toast({
                title: language === 'ar' ? 'بدأت المباراة!' : 'Game Started!',
                description: language === 'ar' 
                  ? 'انتقل إلى شاشة اللعبة الآن' 
                  : 'Redirecting to game screen',
              });
            } else {
              console.log('[WebSocket] This game is not for us');
            }
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
      wsRef.current = null;
      
      // Start polling when WebSocket disconnects
      if (!pollingTimeoutRef.current) {
        const pollWithBackoff = () => {
          pollForPendingMessages();
          pollingTimeoutRef.current = setTimeout(pollWithBackoff, 3000);
        };
        pollingTimeoutRef.current = setTimeout(pollWithBackoff, 3000);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[WebSocket] Attempting to reconnect');
        connectWebSocket();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      ws.close();
    };

    wsRef.current = ws;
  }, [token, toast, language, user, pollForPendingMessages]);

  useEffect(() => {
    if (token && user) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, user, connectWebSocket, pollForPendingMessages]);

  const getLocalizedContent = useCallback((notification: Notification) => {
    return {
      title: language === "ar" && notification.titleAr ? notification.titleAr : notification.title,
      message: language === "ar" && notification.messageAr ? notification.messageAr : notification.message,
    };
  }, [language]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    getLocalizedContent,
    gameStartEvent,
    showGameStartModal,
    setShowGameStartModal,
  };
}
