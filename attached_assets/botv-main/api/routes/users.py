#!/usr/bin/env python3
"""
User routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from api.schemas import UserProfile, UpdateProfileRequest
from api.auth_utils import get_current_user
from models import User

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


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get user profile"""
    return UserProfile.model_validate(current_user)


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    if request.first_name is not None:
        current_user.first_name = request.first_name
    
    if request.last_name is not None:
        current_user.last_name = request.last_name
    
    if request.language_code is not None:
        current_user.language_code = request.language_code
    
    if request.country_code is not None:
        current_user.country_code = request.country_code
    
    if request.notifications_enabled is not None:
        current_user.notifications_enabled = request.notifications_enabled
    
    current_user.updated_at = datetime.now(timezone.utc)
    
    await session.commit()
    await session.refresh(current_user)
    
    return UserProfile.model_validate(current_user)
