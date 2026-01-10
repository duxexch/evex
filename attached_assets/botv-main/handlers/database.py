"""
Database session management for Telegram handlers
"""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import AsyncGenerator
from config import DATABASE_URL
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for handlers"""
    async with async_session_maker() as session:
        yield session
