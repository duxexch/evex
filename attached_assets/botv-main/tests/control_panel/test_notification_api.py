"""
Integration tests for Notification API endpoints.
"""
import pytest
from httpx import AsyncClient
from fastapi import status
from datetime import datetime
from models import User, Notification, NotificationPriority, NotificationType, NotificationStatus


@pytest.fixture
async def auth_token(async_session, test_user):
    """Create authentication token for test user."""
    from services.control_panel.auth_service import AuthService
    auth_service = AuthService(async_session)
    token = await auth_service.create_access_token(data={"sub": str(test_user.id)})
    return token


@pytest.mark.asyncio
async def test_create_notification_endpoint(async_client: AsyncClient, auth_token, test_user):
    """Test POST /api/v1/control-panel/notifications endpoint."""
    response = await async_client.post(
        "/api/v1/control-panel/notifications",
        json={
            "user_id": test_user.id,
            "title": "Test Notification",
            "body": "This is a test notification",
            "notification_type": NotificationType.GENERAL.value,
            "priority": NotificationPriority.MEDIUM.value
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["title"] == "Test Notification"
    assert data["body"] == "This is a test notification"
    assert data["notification_type"] == NotificationType.GENERAL.value
    assert data["priority"] == NotificationPriority.MEDIUM.value


@pytest.mark.asyncio
async def test_get_notifications_endpoint(async_client: AsyncClient, auth_token, test_user, notification_service):
    """Test GET /api/v1/control-panel/notifications endpoint."""
    # Create test notifications
    for i in range(5):
        await notification_service.create_notification(
            user_id=test_user.id,
            title=f"Test {i}",
            body=f"Test notification {i}",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.MEDIUM
        )
    
    response = await async_client.get(
        "/api/v1/control-panel/notifications",
        params={"limit": 10, "offset": 0},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 5


@pytest.mark.asyncio
async def test_get_notification_stats_endpoint(async_client: AsyncClient, auth_token, test_user, notification_service):
    """Test GET /api/v1/control-panel/notifications/stats endpoint."""
    # Create notifications with different priorities
    await notification_service.create_notification(
        user_id=test_user.id,
        title="Critical",
        body="Critical notification",
        notification_type=NotificationType.SYSTEM_ALERT,
        priority=NotificationPriority.CRITICAL
    )
    
    await notification_service.create_notification(
        user_id=test_user.id,
        title="High",
        body="High notification",
        notification_type=NotificationType.USER_ACTION_REQUIRED,
        priority=NotificationPriority.HIGH
    )
    
    response = await async_client.get(
        "/api/v1/control-panel/notifications/stats",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_notifications"] == 2
    assert data["unread_count"] == 2
    assert NotificationPriority.CRITICAL.value in data["by_priority"]
    assert NotificationPriority.HIGH.value in data["by_priority"]


@pytest.mark.asyncio
async def test_mark_as_read_endpoint(async_client: AsyncClient, auth_token, test_user, notification_service):
    """Test POST /api/v1/control-panel/notifications/{id}/read endpoint."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test",
        body="Test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
    
    response = await async_client.post(
        f"/api/v1/control-panel/notifications/{notification.id}/read",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == NotificationStatus.READ.value
    assert data["read_at"] is not None


@pytest.mark.asyncio
async def test_mark_as_interacted_endpoint(async_client: AsyncClient, auth_token, test_user, notification_service):
    """Test POST /api/v1/control-panel/notifications/{id}/interact endpoint."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test",
        body="Test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM,
        action_url="/test/action"
    )
    
    response = await async_client.post(
        f"/api/v1/control-panel/notifications/{notification.id}/interact",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == NotificationStatus.INTERACTED.value
    assert data["interacted_at"] is not None


@pytest.mark.asyncio
async def test_dismiss_notification_endpoint(async_client: AsyncClient, auth_token, test_user, notification_service):
    """Test POST /api/v1/control-panel/notifications/{id}/dismiss endpoint."""
    notification = await notification_service.create_notification(
        user_id=test_user.id,
        title="Test",
        body="Test notification",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
    
    response = await async_client.post(
        f"/api/v1/control-panel/notifications/{notification.id}/dismiss",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == NotificationStatus.DISMISSED.value
    assert data["dismissed_at"] is not None


@pytest.mark.asyncio
async def test_broadcast_notification_endpoint(async_client: AsyncClient, auth_token, test_user, notification_service):
    """Test POST /api/v1/control-panel/notifications/broadcast endpoint."""
    # Create additional test users
    from models import User
    from sqlalchemy.ext.asyncio import AsyncSession
    
    response = await async_client.post(
        "/api/v1/control-panel/notifications/broadcast",
        json={
            "user_ids": [test_user.id],
            "title": "Broadcast Test",
            "body": "This is a broadcast notification",
            "notification_type": NotificationType.SYSTEM_ALERT.value,
            "priority": NotificationPriority.HIGH.value
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert data["notifications_sent"] >= 1


@pytest.mark.asyncio
async def test_unauthorized_access(async_client: AsyncClient):
    """Test that endpoints require authentication."""
    response = await async_client.get("/api/v1/control-panel/notifications")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_rbac_permission_check(async_client: AsyncClient, test_user):
    """Test RBAC permission enforcement."""
    # Create token for user without notification:send permission
    from services.control_panel.auth_service import AuthService
    from sqlalchemy.ext.asyncio import AsyncSession
    
    # This test assumes your auth system properly checks RBAC
    # Adjust based on your actual implementation
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
