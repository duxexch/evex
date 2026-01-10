'use client';

import React, { useEffect, useState } from 'react';
import { Notification, NotificationPriority } from '@/types/notification';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { FaTimes, FaBell, FaExclamationCircle, FaInfoCircle } from 'react-icons/fa';

interface ToastBannerNotificationProps {
  notification: Notification;
  onClose: () => void;
  autoHideDuration?: number;
}

export const ToastBannerNotification: React.FC<ToastBannerNotificationProps> = ({
  notification,
  onClose,
  autoHideDuration = 8000
}) => {
  const { markAsRead, dismiss } = useWebSocket();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    markAsRead(notification.id);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [notification.id, markAsRead, onClose, autoHideDuration]);

  const handleDismiss = () => {
    dismiss(notification.id);
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleClick = () => {
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  const getPriorityStyles = () => {
    switch (notification.priority) {
      case NotificationPriority.HIGH:
        return 'bg-orange-50 border-orange-300 text-orange-900';
      case NotificationPriority.MEDIUM:
        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      case NotificationPriority.LOW:
        return 'bg-blue-50 border-blue-300 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-900';
    }
  };

  const getIcon = () => {
    switch (notification.priority) {
      case NotificationPriority.HIGH:
        return <FaExclamationCircle className="text-orange-600" />;
      case NotificationPriority.MEDIUM:
        return <FaBell className="text-yellow-600" />;
      default:
        return <FaInfoCircle className="text-blue-600" />;
    }
  };

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      dir="rtl"
    >
      <div
        className={`${getPriorityStyles()} border-l-4 rounded-lg shadow-lg p-4 mx-4 ${
          notification.action_url ? 'cursor-pointer hover:shadow-xl' : ''
        }`}
        onClick={handleClick}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 ml-3 text-2xl">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
            <p className="text-sm leading-relaxed">{notification.body}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition mr-2"
            aria-label="إغلاق"
          >
            <FaTimes />
          </button>
        </div>
      </div>
    </div>
  );
};
