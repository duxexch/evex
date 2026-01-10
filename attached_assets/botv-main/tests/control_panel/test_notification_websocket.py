"""
WebSocket integration tests for real-time notifications.
"""
import pytest
import asyncio
import json
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession
from models import NotificationPriority, NotificationType


@pytest.mark.asyncio
async def test_websocket_connection(async_client, auth_token, test_user):
    """Test WebSocket connection establishment."""
    with async_client.websocket_connect(
        f"/api/v1/control-panel/notifications/ws?token={auth_token}"
    ) as websocket:
        # Connection should be established
        assert websocket is not None


@pytest.mark.asyncio
async def test_websocket_receive_notification(async_client, auth_token, test_user, notification_service):
    """Test receiving notification via WebSocket."""
    with async_client.websocket_connect(
        f"/api/v1/control-panel/notifications/ws?token={auth_token}"
    ) as websocket:
        # Create and broadcast notification
        notification = await notification_service.create_and_broadcast(
            user_id=test_user.id,
            title="WebSocket Test",
            body="This is a WebSocket test notification",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.MEDIUM
        )
        
        # Receive notification via WebSocket
        data = websocket.receive_json()
        
        assert data["id"] == notification.id
        assert data["title"] == "WebSocket Test"
        assert data["body"] == "This is a WebSocket test notification"


@pytest.mark.asyncio
async def test_websocket_multiple_connections(async_client, auth_token, test_user, notification_service):
    """Test broadcasting to multiple WebSocket connections."""
    # Create two WebSocket connections
    with async_client.websocket_connect(
        f"/api/v1/control-panel/notifications/ws?token={auth_token}"
    ) as ws1, async_client.websocket_connect(
        f"/api/v1/control-panel/notifications/ws?token={auth_token}"
    ) as ws2:
        # Create and broadcast notification
        notification = await notification_service.create_and_broadcast(
            user_id=test_user.id,
            title="Broadcast Test",
            body="This notification should reach both connections",
            notification_type=NotificationType.SYSTEM_ALERT,
            priority=NotificationPriority.HIGH
        )
        
        # Both connections should receive the notification
        data1 = ws1.receive_json()
        data2 = ws2.receive_json()
        
        assert data1["id"] == notification.id
        assert data2["id"] == notification.id


@pytest.mark.asyncio
async def test_websocket_reconnection(async_client, auth_token, test_user, notification_service):
    """Test WebSocket reconnection after disconnect."""
    # First connection
    with async_client.websocket_connect(
        f"/api/v1/control-panel/notifications/ws?token={auth_token}"
    ) as websocket:
        # Send notification
        notification1 = await notification_service.create_and_broadcast(
            user_id=test_user.id,
            title="Before Disconnect",
            body="This should be received",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.LOW
        )
        
        data = websocket.receive_json()
        assert data["id"] == notification1.id
    
    # Connection closed, reconnect
    with async_client.websocket_connect(
        f"/api/v1/control-panel/notifications/ws?token={auth_token}"
    ) as websocket:
        # Send another notification
        notification2 = await notification_service.create_and_broadcast(
            user_id=test_user.id,
            title="After Reconnect",
            body="This should also be received",
            notification_type=NotificationType.GENERAL,
            priority=NotificationPriority.LOW
        )
        
        data = websocket.receive_json()
        assert data["id"] == notification2.id


@pytest.mark.asyncio
async def test_websocket_unauthorized(async_client):
    """Test that WebSocket requires valid token."""
    with pytest.raises(Exception):
        with async_client.websocket_connect(
            "/api/v1/control-panel/notifications/ws?token=invalid_token"
        ) as websocket:
            pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
