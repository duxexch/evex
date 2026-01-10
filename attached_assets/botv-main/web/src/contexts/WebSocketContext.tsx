'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Notification, NotificationStatus } from '@/types/notification';
import { notificationService } from '@/services/notificationService';

interface WebSocketContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: number) => void;
  markAsInteracted: (id: number) => void;
  dismiss: (id: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Load initial notifications
    notificationService.getNotifications().then(setNotifications).catch(console.error);

    // Connect WebSocket
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const token = localStorage.getItem('token');
    const socket = new WebSocket(`${WS_URL}/api/v1/control-panel/notifications/ws?token=${token}`);

    socket.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      // Reconnect after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: NotificationStatus.READ, read_at: new Date().toISOString() } : n))
    );
  }, []);

  const markAsInteracted = useCallback(async (id: number) => {
    await notificationService.markAsInteracted(id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, status: NotificationStatus.INTERACTED, interacted_at: new Date().toISOString() } : n
      )
    );
  }, []);

  const dismiss = useCallback(async (id: number) => {
    await notificationService.dismiss(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: NotificationStatus.DISMISSED, dismissed_at: new Date().toISOString() } : n))
    );
  }, []);

  const unreadCount = notifications.filter(
    (n) => n.status === NotificationStatus.PENDING || n.status === NotificationStatus.DELIVERED
  ).length;

  return (
    <WebSocketContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        addNotification,
        markAsRead,
        markAsInteracted,
        dismiss
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
