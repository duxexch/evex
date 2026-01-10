export enum NotificationPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum NotificationType {
  AGENT_COMMISSION_APPROVED = 'AGENT_COMMISSION_APPROVED',
  AGENT_COMMISSION_PAID = 'AGENT_COMMISSION_PAID',
  AGENT_COMMISSION_REJECTED = 'AGENT_COMMISSION_REJECTED',
  AFFILIATE_PAYOUT_APPROVED = 'AFFILIATE_PAYOUT_APPROVED',
  AFFILIATE_PAYOUT_PAID = 'AFFILIATE_PAYOUT_PAID',
  AFFILIATE_PAYOUT_REJECTED = 'AFFILIATE_PAYOUT_REJECTED',
  TRANSACTION_ALERT = 'TRANSACTION_ALERT',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  USER_ACTION_REQUIRED = 'USER_ACTION_REQUIRED',
  GENERAL = 'GENERAL'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  INTERACTED = 'INTERACTED',
  DISMISSED = 'DISMISSED',
  FAILED = 'FAILED'
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  action_url?: string;
  idempotency_key?: string;
  read_at?: string;
  interacted_at?: string;
  dismissed_at?: string;
  event_id?: number;
  actor_id?: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationStats {
  total_notifications: number;
  unread_count: number;
  by_priority: Record<NotificationPriority, number>;
  by_status: Record<NotificationStatus, number>;
}
