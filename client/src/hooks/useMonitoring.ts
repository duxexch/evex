import { useState, useEffect, useCallback, useRef } from "react";

export interface Alert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  entityId?: string;
  createdAt: Date;
  isRead: boolean;
}

export interface SystemMetrics {
  activeUsers: number;
  activeChallenges: number;
  pendingTransactions: number;
  pendingComplaints: number;
  systemHealth: number;
  cpuUsage: number;
  memoryUsage: number;
  databaseSize: number;
  timestamp: Date;
}

interface UseMonitoringReturn {
  alerts: Alert[];
  metrics: SystemMetrics | null;
  isConnected: boolean;
  alertCount: {
    critical: number;
    warning: number;
    info: number;
  };
  markAlertAsRead: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  clearAlerts: () => void;
}

export function useMonitoring(): UseMonitoringReturn {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to monitoring WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${protocol}//${window.location.host}/ws/monitoring`;

        wsRef.current = new WebSocket(url);

        wsRef.current.onopen = () => {
          console.log("✅ Connected to monitoring system");
          setIsConnected(true);
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

        wsRef.current.onclose = () => {
          console.log("❌ Disconnected from monitoring system");
          setIsConnected(false);
          // Attempt reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
      } catch (error) {
        console.error("WebSocket connection error:", error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case "alert":
        setAlerts((prev) => [
          {
            id: message.data.id,
            type: message.data.type,
            severity: message.data.severity,
            title: message.data.title,
            message: message.data.message,
            details: message.data.details,
            userId: message.data.userId,
            entityId: message.data.entityId,
            createdAt: new Date(message.data.createdAt),
            isRead: message.data.isRead,
          },
          ...prev.slice(0, 99), // Keep last 100 alerts
        ]);

        // Show notification for critical alerts
        if (message.data.severity === "critical") {
          showNotification(message.data.title, message.data.message, "critical");
        }
        break;

      case "metrics_update":
        setMetrics({
          activeUsers: message.data.activeUsers,
          activeChallenges: message.data.activeChallenges,
          pendingTransactions: message.data.pendingTransactions,
          pendingComplaints: message.data.pendingComplaints,
          systemHealth: message.data.systemHealth,
          cpuUsage: message.data.cpuUsage,
          memoryUsage: message.data.memoryUsage,
          databaseSize: message.data.databaseSize,
          timestamp: new Date(message.data.timestamp),
        });
        break;

      case "status_update":
        console.log(`🔔 System Status: ${message.status} - ${message.message}`);
        break;
    }
  };

  const markAlertAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alerts/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
        );
      }
    } catch (error) {
      console.error("Error marking alert as read:", error);
    }
  }, []);

  const resolveAlert = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alerts/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error("Error resolving alert:", error);
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Calculate alert counts
  const alertCount = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  return {
    alerts,
    metrics,
    isConnected,
    alertCount,
    markAlertAsRead,
    resolveAlert,
    clearAlerts,
  };
}

// Helper: Show browser notification
function showNotification(
  title: string,
  message: string,
  type: "critical" | "warning" | "info" = "info"
) {
  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: message,
      icon:
        type === "critical"
          ? "🔴"
          : type === "warning"
            ? "🟡"
            : "🔵",
      tag: "monitoring",
      requireInteraction: type === "critical",
    });

    // Auto-close after 30 seconds for non-critical
    if (type !== "critical") {
      setTimeout(() => notification.close(), 30000);
    }
  }
}

// Request notification permission on first load
export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
