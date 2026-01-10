import axios from 'axios';
import { Notification, NotificationStats } from '@/types/notification';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const notificationService = {
  async getNotifications(limit = 50, offset = 0): Promise<Notification[]> {
    const response = await axios.get(`${API_URL}/api/v1/control-panel/notifications`, {
      params: { limit, offset },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  async getStats(): Promise<NotificationStats> {
    const response = await axios.get(`${API_URL}/api/v1/control-panel/notifications/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  async markAsRead(notificationId: number): Promise<void> {
    await axios.post(
      `${API_URL}/api/v1/control-panel/notifications/${notificationId}/read`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
  },

  async markAsInteracted(notificationId: number): Promise<void> {
    await axios.post(
      `${API_URL}/api/v1/control-panel/notifications/${notificationId}/interact`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
  },

  async dismiss(notificationId: number): Promise<void> {
    await axios.post(
      `${API_URL}/api/v1/control-panel/notifications/${notificationId}/dismiss`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
  }
};
