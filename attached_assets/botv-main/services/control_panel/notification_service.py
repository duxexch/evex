"""
Notification Service
Real-time notification system with WebSocket broadcast, RBAC, and audit logging
"""
from typing import List, Optional, Dict, Any, Set
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import uuid
import asyncio
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

from models import (
    Notification,
    NotificationEvent,
    NotificationPriority,
    NotificationType,
    NotificationStatus,
    AuditLog,
    User,
)


class NotificationService:
    """Service for creating, broadcasting, and managing notifications"""
    
    # WebSocket connections: user_id -> set of websocket connections
    _connections: Dict[int, Set[Any]] = defaultdict(set)
    
    # Rate limiting: user_id -> list of timestamps
    _rate_limits: Dict[int, List[datetime]] = defaultdict(list)
    
    # Configuration
    RATE_LIMIT_WINDOW = 60  # seconds
    RATE_LIMIT_MAX = 50  # max notifications per window
    
    def __init__(self):
        pass
    
    # ==================== WebSocket Connection Management ====================
    
    @classmethod
    def register_connection(cls, user_id: int, websocket: Any) -> None:
        """Register a new WebSocket connection for a user"""
        cls._connections[user_id].add(websocket)
    
    @classmethod
    def unregister_connection(cls, user_id: int, websocket: Any) -> None:
        """Unregister a WebSocket connection"""
        if user_id in cls._connections:
            cls._connections[user_id].discard(websocket)
            if not cls._connections[user_id]:
                del cls._connections[user_id]
    
    @classmethod
    def get_user_connections(cls, user_id: int) -> Set[Any]:
        """Get all active connections for a user"""
        return cls._connections.get(user_id, set())
    
    @classmethod
    def get_all_connections(cls) -> Dict[int, Set[Any]]:
        """Get all active connections"""
        return dict(cls._connections)
    
    # ==================== Rate Limiting ====================
    
    @classmethod
    def _check_rate_limit(cls, user_id: int) -> bool:
        """Check if user has exceeded rate limit"""
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=cls.RATE_LIMIT_WINDOW)
        
        # Clean old timestamps
        cls._rate_limits[user_id] = [
            ts for ts in cls._rate_limits[user_id]
            if ts > window_start
        ]
        
        # Check limit
        if len(cls._rate_limits[user_id]) >= cls.RATE_LIMIT_MAX:
            return False
        
        # Add new timestamp
        cls._rate_limits[user_id].append(now)
        return True
    
    # ==================== Notification Creation ====================
    
    async def create_notification(
        self,
        session: AsyncSession,
        user_id: int,
        title: str,
        message: str,
        notification_type: NotificationType,
        priority: NotificationPriority,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None,
        action_data: Optional[Dict[str, Any]] = None,
        event_id: Optional[int] = None,
        actor_id: Optional[int] = None,
        event_type: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        expires_at: Optional[datetime] = None,
    ) -> Optional[Notification]:
        """Create a new notification with idempotency check"""
        
        # Check rate limit
        if not self._check_rate_limit(user_id):
            return None
        
        # Check idempotency
        if idempotency_key:
            existing = await session.execute(
                select(Notification).where(Notification.idempotency_key == idempotency_key)
            )
            if existing.scalar_one_or_none():
                return None
        
        # Create notification
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            priority=priority,
            action_url=action_url,
            action_label=action_label,
            action_data=action_data,
            event_id=event_id,
            actor_id=actor_id,
            event_type=event_type,
            idempotency_key=idempotency_key or str(uuid.uuid4()),
            metadata=metadata,
            expires_at=expires_at,
            status=NotificationStatus.PENDING,
            delivery_channel='web',
        )
        
        session.add(notification)
        await session.flush()
        
        # Create audit log
        await self._create_audit_log(
            session,
            action="notification_created",
            target_type="notification",
            target_id=notification.id,
            admin_id=actor_id,
            changes={
                "user_id": user_id,
                "type": notification_type.value,
                "priority": priority.value,
                "title": title,
            },
        )
        
        return notification
    
    # ==================== WebSocket Broadcasting ====================
    
    @classmethod
    async def broadcast_notification(cls, user_id: int, notification_data: Dict[str, Any]) -> int:
        """Broadcast notification to all user's WebSocket connections"""
        connections = cls.get_user_connections(user_id)
        
        if not connections:
            return 0
        
        sent_count = 0
        dead_connections = set()
        
        for ws in connections:
            try:
                await ws.send_json(notification_data)
                sent_count += 1
            except Exception:
                dead_connections.add(ws)
        
        # Clean up dead connections
        for ws in dead_connections:
            cls.unregister_connection(user_id, ws)
        
        return sent_count
    
    async def create_and_broadcast(
        self,
        session: AsyncSession,
        user_id: int,
        title: str,
        message: str,
        notification_type: NotificationType,
        priority: NotificationPriority,
        **kwargs
    ) -> Optional[Notification]:
        """Create notification and broadcast immediately"""
        
        notification = await self.create_notification(
            session=session,
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            **kwargs
        )
        
        if not notification:
            return None
        
        # Mark as delivered
        notification.status = NotificationStatus.DELIVERED
        notification.delivered_at = datetime.now(timezone.utc)
        await session.flush()
        
        # Broadcast via WebSocket
        notification_data = {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type.value,
            "priority": notification.priority.value,
            "action_url": notification.action_url,
            "action_label": notification.action_label,
            "action_data": notification.action_data,
            "created_at": notification.created_at.isoformat(),
            "metadata": notification.metadata,
        }
        
        sent_count = await self.broadcast_notification(user_id, notification_data)
        
        # Update delivery status
        if sent_count == 0:
            notification.status = NotificationStatus.FAILED
            notification.failure_reason = "No active connections"
        
        await session.flush()
        
        return notification
    
    # ==================== Notification Management ====================
    
    async def mark_as_read(
        self,
        session: AsyncSession,
        notification_id: int,
        user_id: int,
    ) -> Optional[Notification]:
        """Mark notification as read"""
        result = await session.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == user_id,
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        if notification.status != NotificationStatus.READ:
            notification.status = NotificationStatus.READ
            notification.read_at = datetime.now(timezone.utc)
            
            await self._create_audit_log(
                session,
                action="notification_read",
                target_type="notification",
                target_id=notification_id,
                admin_id=user_id,
                changes={"status": "read"},
            )
            
            await session.flush()
        
        return notification
    
    async def mark_as_interacted(
        self,
        session: AsyncSession,
        notification_id: int,
        user_id: int,
    ) -> Optional[Notification]:
        """Mark notification as interacted (user clicked action button)"""
        result = await session.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == user_id,
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        notification.status = NotificationStatus.INTERACTED
        notification.interacted_at = datetime.now(timezone.utc)
        
        if not notification.read_at:
            notification.read_at = notification.interacted_at
        
        await self._create_audit_log(
            session,
            action="notification_interacted",
            target_type="notification",
            target_id=notification_id,
            admin_id=user_id,
            changes={"status": "interacted"},
        )
        
        await session.flush()
        
        return notification
    
    async def dismiss_notification(
        self,
        session: AsyncSession,
        notification_id: int,
        user_id: int,
    ) -> Optional[Notification]:
        """Dismiss notification"""
        result = await session.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == user_id,
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        notification.status = NotificationStatus.DISMISSED
        notification.dismissed_at = datetime.now(timezone.utc)
        
        await session.flush()
        
        return notification
    
    async def get_user_notifications(
        self,
        session: AsyncSession,
        user_id: int,
        unread_only: bool = False,
        priority: Optional[NotificationPriority] = None,
        notification_type: Optional[NotificationType] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Notification]:
        """Get notifications for a user"""
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.status.in_([NotificationStatus.PENDING, NotificationStatus.DELIVERED]))
        
        if priority:
            query = query.where(Notification.priority == priority)
        
        if notification_type:
            query = query.where(Notification.type == notification_type)
        
        query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def get_unread_count(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> int:
        """Get count of unread notifications"""
        result = await session.execute(
            select(func.count()).select_from(Notification).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.status.in_([NotificationStatus.PENDING, NotificationStatus.DELIVERED])
                )
            )
        )
        return result.scalar() or 0
    
    # ==================== Event Management ====================
    
    async def create_notification_event(
        self,
        session: AsyncSession,
        event_type: str,
        event_source: str,
        event_data: Dict[str, Any],
        actor_id: Optional[int] = None,
        actor_type: Optional[str] = None,
        target_users: Optional[List[int]] = None,
        idempotency_key: Optional[str] = None,
    ) -> NotificationEvent:
        """Create a notification event"""
        
        # Check idempotency
        if idempotency_key:
            existing = await session.execute(
                select(NotificationEvent).where(NotificationEvent.idempotency_key == idempotency_key)
            )
            if existing.scalar_one_or_none():
                raise ValueError("Event already processed")
        
        event = NotificationEvent(
            event_type=event_type,
            event_source=event_source,
            event_data=event_data,
            actor_id=actor_id,
            actor_type=actor_type,
            target_users=target_users,
            idempotency_key=idempotency_key or str(uuid.uuid4()),
            processed=False,
        )
        
        session.add(event)
        await session.flush()
        
        return event
    
    async def process_notification_event(
        self,
        session: AsyncSession,
        event_id: int,
    ) -> int:
        """Process a notification event and generate notifications"""
        result = await session.execute(
            select(NotificationEvent).where(NotificationEvent.id == event_id)
        )
        event = result.scalar_one_or_none()
        
        if not event or event.processed:
            return 0
        
        count = 0
        
        try:
            # Generate notifications based on event type
            # This is a placeholder - actual logic should be implemented based on event type
            if event.target_users:
                for user_id in event.target_users:
                    notification = await self.create_and_broadcast(
                        session=session,
                        user_id=user_id,
                        title=event.event_data.get('title', 'New Notification'),
                        message=event.event_data.get('message', ''),
                        notification_type=NotificationType(event.event_data.get('type', 'system_alert')),
                        priority=NotificationPriority(event.event_data.get('priority', 'medium')),
                        event_id=event.id,
                        actor_id=event.actor_id,
                        event_type=event.event_type,
                    )
                    if notification:
                        count += 1
            
            # Mark event as processed
            event.processed = True
            event.processed_at = datetime.now(timezone.utc)
            event.notification_count = count
            
            await session.flush()
            
        except Exception as e:
            event.processing_error = str(e)
            await session.flush()
            raise
        
        return count
    
    # ==================== Audit Logging ====================
    
    async def _create_audit_log(
        self,
        session: AsyncSession,
        action: str,
        target_type: str,
        target_id: int,
        admin_id: Optional[int],
        changes: Dict[str, Any],
    ) -> None:
        """Create audit log entry"""
        log = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            changes=changes,
            ip_address=None,
            user_agent=None,
        )
        session.add(log)
        await session.flush()
    
    # ==================== Analytics ====================
    
    async def get_notification_stats(
        self,
        session: AsyncSession,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get notification statistics"""
        query = select(Notification)
        
        if user_id:
            query = query.where(Notification.user_id == user_id)
        
        if start_date:
            query = query.where(Notification.created_at >= start_date)
        
        if end_date:
            query = query.where(Notification.created_at <= end_date)
        
        result = await session.execute(query)
        notifications = result.scalars().all()
        
        stats = {
            'total': len(notifications),
            'unread': sum(1 for n in notifications if n.status in [NotificationStatus.PENDING, NotificationStatus.DELIVERED]),
            'read': sum(1 for n in notifications if n.status == NotificationStatus.READ),
            'interacted': sum(1 for n in notifications if n.status == NotificationStatus.INTERACTED),
            'dismissed': sum(1 for n in notifications if n.status == NotificationStatus.DISMISSED),
            'by_type': {},
            'by_priority': {},
        }
        
        for n in notifications:
            stats['by_type'][n.type.value] = stats['by_type'].get(n.type.value, 0) + 1
            stats['by_priority'][n.priority.value] = stats['by_priority'].get(n.priority.value, 0) + 1
        
        return stats
