import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth, useAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

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

export function useNotifications() {
  const { token, user } = useAuth();
  const headers = useAuthHeaders();
  const { toast } = useToast();
  const { language } = useI18n();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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

  const connectWebSocket = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
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
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [token, toast, language]);

  useEffect(() => {
    if (token && user) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, user, connectWebSocket]);

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
  };
}
