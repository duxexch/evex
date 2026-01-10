"""
Middleware for injecting database session and i18n service to handlers
"""

from typing import Callable, Dict, Any, Awaitable
from aiogram import BaseMiddleware
from aiogram.types import Update, User, Chat
from sqlalchemy.ext.asyncio import AsyncSession
from handlers.database import async_session_maker
from services.i18n_service import get_i18n_service


class DatabaseMiddleware(BaseMiddleware):
    """Inject database session to all handlers"""
    
    async def __call__(
        self,
        handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]],
        event: Update,
        data: Dict[str, Any],
    ) -> Any:
        async with async_session_maker() as session:
            data["session"] = session
            return await handler(event, data)


class I18nMiddleware(BaseMiddleware):
    """Inject i18n service to all handlers"""
    
    async def __call__(
        self,
        handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]],
        event: Update,
        data: Dict[str, Any],
    ) -> Any:
        # Get user language from database or default to Arabic
        data["i18n"] = get_i18n_service()
        data["user_language"] = data.get("user_language", "ar")
        return await handler(event, data)


class LoggingMiddleware(BaseMiddleware):
    """Log all updates for debugging"""
    
    async def __call__(
        self,
        handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]],
        event: Update,
        data: Dict[str, Any],
    ) -> Any:
        import logging
        logger = logging.getLogger(__name__)
        
        if event.message:
            logger.info(
                f"Message from {event.message.from_user.id}: {event.message.text}"
            )
        elif event.callback_query:
            logger.info(
                f"Callback from {event.callback_query.from_user.id}: "
                f"{event.callback_query.data}"
            )
        
        return await handler(event, data)
