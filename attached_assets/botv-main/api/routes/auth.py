#!/usr/bin/env python3
"""
Authentication routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from api.schemas import LoginRequest, RegisterRequest, TokenResponse
from api.auth_utils import create_access_token, get_current_user
from models import User
from services.customer_id import generate_customer_code

router = APIRouter()
logger = logging.getLogger(__name__)


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


@router.post("/register", response_model=TokenResponse)
async def register(
    request: RegisterRequest,
    session: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    # Check if user already exists
    result = await session.execute(
        select(User).where(User.phone_number == request.phone_number)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this phone number already exists"
        )
    
    # Generate customer code
    customer_code = await generate_customer_code(session)
    
    # Create new user (no telegram_id for mobile app users)
    new_user = User(
        telegram_id=0,  # Placeholder for mobile users
        phone_number=request.phone_number,
        first_name=request.first_name,
        last_name=request.last_name,
        customer_code=customer_code,
        language_code=request.language_code,
        country_code=request.country_code,
        is_active=True
    )
    
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    
    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id)})
    
    logger.info(f"New user registered: {new_user.customer_code}")
    
    return TokenResponse(
        access_token=access_token,
        user_id=new_user.id,
        customer_code=new_user.customer_code
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_db)
):
    """Login with phone number"""
    # Find user by phone number
    result = await session.execute(
        select(User).where(User.phone_number == request.phone_number)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is banned"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    logger.info(f"User logged in: {user.customer_code}")
    
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        customer_code=user.customer_code
    )


@router.get("/me", response_model=TokenResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get current authenticated user info"""
    access_token = create_access_token(data={"sub": str(current_user.id)})
    
    return TokenResponse(
        access_token=access_token,
        user_id=current_user.id,
        customer_code=current_user.customer_code
    )
