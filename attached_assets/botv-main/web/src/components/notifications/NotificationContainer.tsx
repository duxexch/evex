'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { NotificationPriority } from '@/types/notification';
import { ModalOverlayNotification } from './ModalOverlayNotification';
import { ToastBannerNotification } from './ToastBannerNotification';

export const NotificationContainer: React.FC = () => {
  const { notifications } = useWebSocket();
  const [criticalNotification, setCriticalNotification] = useState<any>(null);
  const [toastNotifications, setToastNotifications] = useState<any[]>([]);

  useEffect(() => {
    const latestNotification = notifications[0];
    if (!latestNotification) return;

    // Show CRITICAL notifications as modal overlays
    if (latestNotification.priority === NotificationPriority.CRITICAL) {
      setCriticalNotification(latestNotification);
    }
    // Show HIGH/MEDIUM/LOW/INFO as toasts
    else if (
      latestNotification.priority === NotificationPriority.HIGH ||
      latestNotification.priority === NotificationPriority.MEDIUM ||
      latestNotification.priority === NotificationPriority.LOW ||
      latestNotification.priority === NotificationPriority.INFO
    ) {
      setToastNotifications((prev) => [...prev, latestNotification]);
    }
  }, [notifications]);

  const handleCloseModal = () => {
    setCriticalNotification(null);
  };

  const handleCloseToast = (notificationId: number) => {
    setToastNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  return (
    <>
      {/* Critical modal overlay */}
      {criticalNotification && (
        <ModalOverlayNotification notification={criticalNotification} onClose={handleCloseModal} />
      )}

      {/* Toast notifications */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          {toastNotifications.map((notification, index) => (
            <div key={notification.id} style={{ marginTop: `${index * 100}px` }}>
              <ToastBannerNotification
                notification={notification}
                onClose={() => handleCloseToast(notification.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
