"""Notifications API Router with WebSocket support"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.dependencies import get_db, get_current_user
from services.control_panel.notification_service import NotificationService
from services.control_panel import RBACService
from api.v1.control_panel.notifications.schemas import (
    NotificationCreate,
    NotificationResponse,
    NotificationListResponse,
    NotificationMarkRead,
    NotificationStats,
    BroadcastNotificationRequest,
)
from models import NotificationPriority, NotificationType


router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_service() -> NotificationService:
    return NotificationService()


def get_rbac_service() -> RBACService:
    return RBACService()


def require_permission(permission: str):
    async def checker(
        db: AsyncSession = Depends(get_db),
        current_user=Depends(get_current_user),
        rbac: RBACService = Depends(get_rbac_service),
    ):
        allowed = await rbac.has_permission(db, current_user.id, permission)
        if not allowed:
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user
    
    return checker


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time notifications"""
    # Simple token-based auth for WebSocket
    # In production, implement proper JWT validation
    await websocket.accept()
    
    # Extract user_id from token (simplified - should use JWT)
    try:
        user_id = int(token)  # Placeholder - implement proper JWT decode
    except:
        await websocket.close(code=1008)
        return
    
    # Register connection
    NotificationService.register_connection(user_id, websocket)
    
    try:
        while True:
            # Keep connection alive and listen for pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        NotificationService.unregister_connection(user_id, websocket)


@router.post("/", response_model=NotificationResponse, status_code=201)
async def create_notification(
    request: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:send")),
    service: NotificationService = Depends(get_service),
):
    """Create and broadcast a new notification"""
    try:
        notification = await service.create_and_broadcast(
            session=db,
            user_id=request.user_id,
            title=request.title,
            message=request.message,
            notification_type=request.type,
            priority=request.priority,
            action_url=request.action_url,
            action_label=request.action_label,
            action_data=request.action_data,
            event_id=request.event_id,
            actor_id=request.actor_id or current_user.id,
            event_type=request.event_type,
            metadata=request.metadata,
        )
        
        if not notification:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        
        return notification
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/broadcast", status_code=201)
async def broadcast_notification(
    request: BroadcastNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:send")),
    service: NotificationService = Depends(get_service),
):
    """Broadcast notification to multiple users"""
    sent_count = 0
    failed_count = 0
    
    for user_id in request.user_ids:
        try:
            notification = await service.create_and_broadcast(
                session=db,
                user_id=user_id,
                title=request.title,
                message=request.message,
                notification_type=request.type,
                priority=request.priority,
                action_url=request.action_url,
                action_label=request.action_label,
                action_data=request.action_data,
                actor_id=current_user.id,
            )
            if notification:
                sent_count += 1
            else:
                failed_count += 1
        except Exception:
            failed_count += 1
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "total": len(request.user_ids),
    }


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    priority: Optional[NotificationPriority] = Query(None),
    notification_type: Optional[NotificationType] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:view")),
    service: NotificationService = Depends(get_service),
):
    """List notifications for current user"""
    notifications = await service.get_user_notifications(
        session=db,
        user_id=current_user.id,
        unread_only=unread_only,
        priority=priority,
        notification_type=notification_type,
        limit=limit,
        offset=offset,
    )
    
    unread_count = await service.get_unread_count(db, current_user.id)
    
    return NotificationListResponse(
        notifications=notifications,
        total=len(notifications),
        unread_count=unread_count,
    )


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:view")),
    service: NotificationService = Depends(get_service),
):
    """Get unread notification count"""
    count = await service.get_unread_count(db, current_user.id)
    return {"count": count}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:view")),
    service: NotificationService = Depends(get_service),
):
    """Mark notification as read"""
    notification = await service.mark_as_read(db, notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return notification


@router.post("/{notification_id}/interact", response_model=NotificationResponse)
async def mark_as_interacted(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:view")),
    service: NotificationService = Depends(get_service),
):
    """Mark notification as interacted (user clicked action)"""
    notification = await service.mark_as_interacted(db, notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return notification


@router.post("/{notification_id}/dismiss", response_model=NotificationResponse)
async def dismiss_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:view")),
    service: NotificationService = Depends(get_service),
):
    """Dismiss notification"""
    notification = await service.dismiss_notification(db, notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return notification


@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("notification:view")),
    service: NotificationService = Depends(get_service),
):
    """Get notification statistics for current user"""
    stats = await service.get_notification_stats(db, user_id=current_user.id)
    return stats
