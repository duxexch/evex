"""
Unit tests for NotificationService.
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from models import Base, User, Notification, NotificationEvent, NotificationPriority, NotificationType, NotificationStatus
from services.control_panel.notification_service import NotificationService


@pytest.fixture
async def async_session():
    """Create async test database session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_maker() as session:
        yield session
    
    await engine.dispose()


@pytest.fixture
async def test_user(async_session):
    """Create test user."""
    user = User(
        telegram_id=123456789,
        username="test_user",
        full_name="Test User",
        phone="+1234567890",
        balance=1000.0
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
def notification_service(async_session):
    """Create NotificationService instance."""
    return NotificationService(async_session)


@pytest.mark.asyncio
async def test_create_notification(notification_service, test_user):
    """Test creating a notification."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
    
    assert notification.id is not None
    assert notification.user_id == test_user.id
    assert notification.title == "Test Notification"
    assert notification.body == "This is a test notification"
    assert notification.notification_type == NotificationType.GENERAL
    assert notification.priority == NotificationPriority.MEDIUM
    assert notification.status == NotificationStatus.PENDING


@pytest.mark.asyncio
async def test_create_notification_with_idempotency(notification_service, test_user):
    """Test idempotency key prevents duplicate notifications."""
    idempotency_key = "test_key_123"
    
    # Create first notification
    notification1 = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM,
        idempotency_key=idempotency_key
    )
    
    # Try to create duplicate with same idempotency key
    notification2 = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM,
        idempotency_key=idempotency_key
    )
    
    # Should return the same notification
    assert notification1.id == notification2.id


@pytest.mark.asyncio
async def test_mark_as_read(notification_service, test_user, async_session):
    """Test marking notification as read."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
    
    # Mark as read
    updated = await notification_service.mark_as_read(notification.id, test_user.id)
    
    assert updated.status == NotificationStatus.READ
    assert updated.read_at is not None


@pytest.mark.asyncio
async def test_mark_as_interacted(notification_service, test_user):
    """Test marking notification as interacted."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM,
        action_url="/test/action"
    )
    
    # Mark as interacted
    updated = await notification_service.mark_as_interacted(notification.id, test_user.id)
    
    assert updated.status == NotificationStatus.INTERACTED
    assert updated.interacted_at is not None


@pytest.mark.asyncio
async def test_dismiss_notification(notification_service, test_user):
    """Test dismissing a notification."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
    
    # Dismiss notification
    updated = await notification_service.dismiss_notification(notification.id, test_user.id)
    
    assert updated.status == NotificationStatus.DISMISSED
    assert updated.dismissed_at is not None


@pytest.mark.asyncio
async def test_get_user_notifications(notification_service, test_user):
    """Test getting user notifications with pagination."""
    # Create multiple notifications
    for i in range(15):
        await notification_service.create_notification(
            user_id=test_user.id,
            title=f"Test Notification {i}",
            body=f"This is test notification {i}",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.MEDIUM
        )
    
    # Get first page
    notifications = await notification_service.get_user_notifications(
        user_id=test_user.id,
        limit=10,
        offset=0
    )
    
    assert len(notifications) == 10
    
    # Get second page
    notifications_page2 = await notification_service.get_user_notifications(
        user_id=test_user.id,
        limit=10,
        offset=10
    )
    
    assert len(notifications_page2) == 5


@pytest.mark.asyncio
async def test_get_notification_stats(notification_service, test_user):
    """Test getting notification statistics."""
    # Create notifications with different priorities and statuses
    await notification_service.create_notification(
        user_id=test_user.id,
        title="Critical",
        body="Critical notification",
        notification_type=NotificationType.SYSTEM_ALERT,
        priority=NotificationPriority.CRITICAL
    )
    
    high_notif = await notification_service.create_notification(
        user_id=test_user.id,
        title="High",
        body="High notification",
        notification_type=NotificationType.USER_ACTION_REQUIRED,
        priority=NotificationPriority.HIGH
    )
    
    # Mark one as read
    await notification_service.mark_as_read(high_notif.id, test_user.id)
    
    # Get stats
    stats = await notification_service.get_user_notification_stats(test_user.id)
    
    assert stats["total_notifications"] == 2
    assert stats["unread_count"] == 1
    assert stats["by_priority"][NotificationPriority.CRITICAL.value] == 1
    assert stats["by_priority"][NotificationPriority.HIGH.value] == 1
    assert stats["by_status"][NotificationStatus.PENDING.value] == 1
    assert stats["by_status"][NotificationStatus.READ.value] == 1


@pytest.mark.asyncio
async def test_rate_limiting(notification_service, test_user):
    """Test rate limiting (50 notifications per 60 seconds)."""
    # Create 50 notifications (should succeed)
    for i in range(50):
        notification = await notification_service.create_and_broadcast(
            user_id=test_user.id,
            title=f"Test {i}",
            body=f"Test notification {i}",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.LOW
        )
        assert notification is not None
    
    # 51st notification should fail due to rate limit
    with pytest.raises(Exception):
        await notification_service.create_and_broadcast(
            user_id=test_user.id,
            title="Rate Limited",
            body="This should fail",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.LOW
        )


@pytest.mark.asyncio
async def test_notification_event_creation(notification_service, test_user, async_session):
    """Test that NotificationEvent is created for audit trail."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test Notification",
        body="This is a test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM,
        actor_id=test_user.id
    )
    
    # Check that event was created
    from sqlalchemy import select
    result = await async_session.execute(
        select(NotificationEvent).where(NotificationEvent.notification_id == notification.id)
    )
    event = result.scalar_one_or_none()
    
    assert event is not None
    assert event.notification_id == notification.id
    assert event.event_type == "notification_created"
    assert event.actor_id == test_user.id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
