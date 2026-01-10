'use client';

import React, { useEffect, useState } from 'react';
import { Notification, NotificationPriority } from '@/types/notification';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { FaTimes, FaExclamationTriangle, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';

interface ModalOverlayNotificationProps {
  notification: Notification;
  onClose: () => void;
  onAction?: () => void;
}

export const ModalOverlayNotification: React.FC<ModalOverlayNotificationProps> = ({
  notification,
  onClose,
  onAction
}) => {
  const { markAsRead, markAsInteracted } = useWebSocket();

  useEffect(() => {
    markAsRead(notification.id);
  }, [notification.id, markAsRead]);

  const handleAction = () => {
    markAsInteracted(notification.id);
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
    if (onAction) onAction();
    onClose();
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case NotificationPriority.CRITICAL:
        return 'bg-red-600';
      case NotificationPriority.HIGH:
        return 'bg-orange-500';
      case NotificationPriority.MEDIUM:
        return 'bg-yellow-500';
      case NotificationPriority.LOW:
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getIcon = () => {
    switch (notification.priority) {
      case NotificationPriority.CRITICAL:
      case NotificationPriority.HIGH:
        return <FaExclamationTriangle className="text-4xl text-red-600" />;
      case NotificationPriority.MEDIUM:
        return <FaInfoCircle className="text-4xl text-yellow-600" />;
      default:
        return <FaCheckCircle className="text-4xl text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header with priority bar */}
        <div className={`${getPriorityColor()} h-2`}></div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0 ml-4">{getIcon()}</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{notification.title}</h3>
              <p className="text-gray-700 leading-relaxed">{notification.body}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
              aria-label="إغلاق"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            {notification.action_url && (
              <button
                onClick={handleAction}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                اتخاذ إجراء
              </button>
            )}
            <button
              onClick={onClose}
              className={`${
                notification.action_url ? 'flex-1' : 'w-full'
              } bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition`}
            >
              {notification.action_url ? 'تجاهل' : 'حسنًا'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
