'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Notification, NotificationPriority, NotificationStatus } from '@/types/notification';
import { FaBell, FaCheckCircle, FaTimes, FaFilter } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export const NotificationHistoryPanel: React.FC = () => {
  const { notifications, unreadCount, markAsRead, dismiss } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<NotificationPriority | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<NotificationStatus | 'ALL'>('ALL');

  const filteredNotifications = notifications.filter((n) => {
    if (filterPriority !== 'ALL' && n.priority !== filterPriority) return false;
    if (filterStatus !== 'ALL' && n.status !== filterStatus) return false;
    return true;
  });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.status === NotificationStatus.PENDING || notification.status === NotificationStatus.DELIVERED) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    const colors = {
      [NotificationPriority.CRITICAL]: 'bg-red-100 text-red-800',
      [NotificationPriority.HIGH]: 'bg-orange-100 text-orange-800',
      [NotificationPriority.MEDIUM]: 'bg-yellow-100 text-yellow-800',
      [NotificationPriority.LOW]: 'bg-blue-100 text-blue-800',
      [NotificationPriority.INFO]: 'bg-gray-100 text-gray-800'
    };
    return colors[priority];
  };

  const getStatusBadge = (status: NotificationStatus) => {
    const labels = {
      [NotificationStatus.PENDING]: 'قيد الانتظار',
      [NotificationStatus.DELIVERED]: 'تم التسليم',
      [NotificationStatus.READ]: 'مقروء',
      [NotificationStatus.INTERACTED]: 'تم التفاعل',
      [NotificationStatus.DISMISSED]: 'تم التجاهل',
      [NotificationStatus.FAILED]: 'فشل'
    };
    return labels[status];
  };

  return (
    <>
      {/* Notification bell icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition"
        aria-label="الإشعارات"
      >
        <FaBell className="text-2xl" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {isOpen && (
        <div className="fixed inset-y-0 left-0 w-96 bg-white shadow-2xl z-50 overflow-hidden flex flex-col" dir="rtl">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FaBell /> الإشعارات
            </h2>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 transition">
              <FaTimes className="text-xl" />
            </button>
          </div>

          {/* Filters */}
          <div className="bg-gray-50 p-3 border-b flex gap-2 items-center">
            <FaFilter className="text-gray-600" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as NotificationPriority | 'ALL')}
              className="flex-1 px-2 py-1 border rounded text-sm"
            >
              <option value="ALL">كل الأولويات</option>
              <option value={NotificationPriority.CRITICAL}>حرج</option>
              <option value={NotificationPriority.HIGH}>عالي</option>
              <option value={NotificationPriority.MEDIUM}>متوسط</option>
              <option value={NotificationPriority.LOW}>منخفض</option>
              <option value={NotificationPriority.INFO}>معلومة</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as NotificationStatus | 'ALL')}
              className="flex-1 px-2 py-1 border rounded text-sm"
            >
              <option value="ALL">كل الحالات</option>
              <option value={NotificationStatus.PENDING}>قيد الانتظار</option>
              <option value={NotificationStatus.READ}>مقروء</option>
              <option value={NotificationStatus.DISMISSED}>تم التجاهل</option>
            </select>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FaBell className="text-5xl mx-auto mb-3 text-gray-300" />
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b hover:bg-gray-50 transition cursor-pointer ${
                    notification.status === NotificationStatus.PENDING ||
                    notification.status === NotificationStatus.DELIVERED
                      ? 'bg-blue-50'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityBadge(notification.priority)}`}>
                      {notification.priority}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(notification.id);
                      }}
                      className="text-gray-400 hover:text-red-600 transition"
                      aria-label="حذف"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  <h4 className="font-semibold text-gray-900 mb-1">{notification.title}</h4>
                  <p className="text-sm text-gray-700 mb-2 leading-relaxed">{notification.body}</p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}</span>
                    <span className="px-2 py-1 bg-gray-100 rounded">{getStatusBadge(notification.status)}</span>
                  </div>

                  {notification.status === NotificationStatus.READ && notification.read_at && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                      <FaCheckCircle /> قُرئت {formatDistanceToNow(new Date(notification.read_at), { addSuffix: true, locale: ar })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40" onClick={() => setIsOpen(false)}></div>
      )}
    </>
  );
};
