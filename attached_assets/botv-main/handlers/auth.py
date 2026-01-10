"""
User authentication and data retrieval for Telegram handlers
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User
from decimal import Decimal
from datetime import datetime


async def get_or_create_user(
    session: AsyncSession,
    user_id: int,
    first_name: str,
    last_name: str | None = None,
    username: str | None = None,
    language_code: str = "ar",
) -> User:
    """Get existing user or create new one"""
    
    # Try to find user
    result = await session.execute(
        select(User).where(User.telegram_id == user_id)
    )
    user = result.scalars().first()
    
    if user:
        # Update last seen
        user.last_seen = datetime.utcnow()
        await session.commit()
        return user
    
    # Create new user
    user = User(
        telegram_id=user_id,
        first_name=first_name,
        last_name=last_name,
        username=username,
        language=language_code,
        balance=Decimal("0.00"),
        total_deposited=Decimal("0.00"),
        total_withdrawn=Decimal("0.00"),
        daily_withdraw_limit=Decimal("10000.00"),
        is_active=True,
    )
    
    session.add(user)
    await session.commit()
    
    return user


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    """Get user from database"""
    result = await session.execute(
        select(User).where(User.telegram_id == user_id)
    )
    return result.scalars().first()


async def update_user_language(
    session: AsyncSession,
    user_id: int,
    language: str,
) -> User | None:
    """Update user language preference"""
    result = await session.execute(
        select(User).where(User.telegram_id == user_id)
    )
    user = result.scalars().first()
    
    if user:
        user.language = language
        await session.commit()
    
    return user


async def is_user_admin(session: AsyncSession, user_id: int) -> bool:
    """Check if user is admin"""
    result = await session.execute(
        select(User).where(
            (User.telegram_id == user_id) & (User.is_admin == True)
        )
    )
    return result.scalars().first() is not None


async def is_user_agent(session: AsyncSession, user_id: int) -> bool:
    """Check if user is agent (can refer others)"""
    result = await session.execute(
        select(User).where(
            (User.telegram_id == user_id) & (User.is_agent == True)
        )
    )
    return result.scalars().first() is not None
