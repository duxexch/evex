from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

from models import NotificationPriority, NotificationType, NotificationStatus


class NotificationCreate(BaseModel):
    """Create notification request"""
    user_id: int
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    type: NotificationType
    priority: NotificationPriority
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    event_id: Optional[int] = None
    actor_id: Optional[int] = None
    event_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationResponse(BaseModel):
    """Notification response"""
    id: int
    user_id: int
    title: str
    message: str
    type: NotificationType
    priority: NotificationPriority
    action_url: Optional[str]
    action_label: Optional[str]
    action_data: Optional[Dict[str, Any]]
    status: NotificationStatus
    read_at: Optional[datetime]
    interacted_at: Optional[datetime]
    dismissed_at: Optional[datetime]
    event_id: Optional[int]
    actor_id: Optional[int]
    event_type: Optional[str]
    delivered_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """List of notifications"""
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class NotificationStatusUpdate(BaseModel):
    """Update notification status"""
    status: NotificationStatus


class NotificationMarkRead(BaseModel):
    """Mark notification as read (empty body for POST)"""
    pass


class NotificationStats(BaseModel):
    """Notification statistics"""
    total: int
    unread: int
    read: int
    interacted: int
    dismissed: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]


class NotificationEventCreate(BaseModel):
    """Create notification event"""
    event_type: str
    event_source: str
    event_data: Dict[str, Any]
    actor_id: Optional[int] = None
    actor_type: Optional[str] = None
    target_users: Optional[list[int]] = None


class NotificationEventResponse(BaseModel):
    """Notification event response"""
    id: int
    event_type: str
    event_source: str
    event_data: Dict[str, Any]
    actor_id: Optional[int]
    notification_count: int
    processed: bool
    processed_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class BroadcastNotificationRequest(BaseModel):
    """Broadcast notification to multiple users"""
    user_ids: list[int] = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    type: NotificationType
    priority: NotificationPriority
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
