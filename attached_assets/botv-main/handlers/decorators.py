"""
Decorators for handler authorization
"""

from functools import wraps
from sqlalchemy.ext.asyncio import AsyncSession
from handlers.auth import is_user_admin
from services.i18n_service import get_i18n_service


def admin_only(func):
    """Check if user is admin before executing handler"""
    
    @wraps(func)
    async def wrapper(message, session: AsyncSession, i18n: any, user_language: str, *args, **kwargs):
        # Check if user is admin
        is_admin = await is_user_admin(session, message.from_user.id)
        
        if not is_admin:
            text = i18n.get_text("error.admin_only", user_language)
            await message.answer(text)
            return
        
        return await func(message, session, i18n, user_language, *args, **kwargs)
    
    return wrapper


def agent_only(func):
    """Check if user is agent before executing handler"""
    from handlers.auth import is_user_agent
    
    @wraps(func)
    async def wrapper(message, session: AsyncSession, i18n: any, user_language: str, *args, **kwargs):
        # Check if user is agent
        is_agent = await is_user_agent(session, message.from_user.id)
        
        if not is_agent:
            text = i18n.get_text("error.agent_only", user_language)
            await message.answer(text)
            return
        
        return await func(message, session, i18n, user_language, *args, **kwargs)
    
    return wrapper
