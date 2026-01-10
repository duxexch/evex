#!/usr/bin/env python3
"""
Admin routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from api.schemas import BroadcastRequest, AdminStatsResponse, UserProfile
from api.auth_utils import get_current_user
from models import User, Outbox, OutboxStatus
from config import ADMIN_USER_IDS

router = APIRouter()


async def get_db():
    """Placeholder for dependency injection"""
    from api.main import async_session_maker
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def verify_admin(current_user: User):
    """Verify user is admin"""
    if current_user.id not in ADMIN_USER_IDS and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get admin statistics"""
    verify_admin(current_user)
    
    # Get user stats
    total_users = await session.scalar(select(func.count(User.id)))
    active_users = await session.scalar(
        select(func.count(User.id)).where(User.is_active == True)
    )
    
    # Get pending requests
    pending_requests = await session.scalar(
        select(func.count(Outbox.id)).where(Outbox.status == OutboxStatus.PENDING)
    )
    
    return AdminStatsResponse(
        total_users=total_users or 0,
        active_users=active_users or 0,
        pending_requests=pending_requests or 0,
        total_deposits=0.0,  # Can be calculated from Outbox
        total_withdrawals=0.0  # Can be calculated from Outbox
    )


@router.get("/users", response_model=List[UserProfile])
async def get_users(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    page: int = 1,
    limit: int = 10
):
    """Get all users (admin only)"""
    verify_admin(current_user)
    
    result = await session.execute(
        select(User)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    users = result.scalars().all()
    
    return [UserProfile.model_validate(user) for user in users]


@router.post("/broadcast")
async def broadcast_message(
    request: BroadcastRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Broadcast message to users (admin only)"""
    verify_admin(current_user)
    
    # This is a placeholder - actual broadcast logic would be implemented
    # with proper message queuing and delivery tracking
    
    return {
        "message": "Broadcast queued successfully",
        "target_type": request.target_type,
        "target_value": request.target_value
    }


@router.get("/requests")
async def get_pending_requests(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get pending requests (admin only)"""
    verify_admin(current_user)
    
    result = await session.execute(
        select(Outbox)
        .where(Outbox.status == OutboxStatus.PENDING)
        .order_by(Outbox.created_at.desc())
    )
    requests = result.scalars().all()
    
    return [
        {
            "id": req.id,
            "user_id": req.user_id,
            "type": req.type.value,
            "content": req.content,
            "status": req.status.value,
            "created_at": req.created_at
        }
        for req in requests
    ]
