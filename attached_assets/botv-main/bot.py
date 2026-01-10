#!/usr/bin/env python3
"""
Main bot module with Aiogram v3 setup
Handles bot initialization, router registration, and polling
"""

import asyncio
import logging
import signal
from contextlib import suppress
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import BOT_TOKEN
from handlers import (
    start, admin, broadcast, user_settings, announcements, 
    flying_plane_handler, legacy_handlers, admin_comprehensive, 
    financial_operations, currency, addresses, requests, profile, support,
    wallet, affiliate, admin_advanced, games, tickets, penalty_shootout
)
from services.broadcast_service import BroadcastService

logger = logging.getLogger(__name__)

# Global variables for dependency injection
bot_instance = None
session_maker = None
broadcast_service = None
broadcast_worker_task = None
polling_task = None
shutdown_event = None

async def main(async_session):
    """Main bot function"""
    global bot_instance, session_maker, broadcast_service, broadcast_worker_task, polling_task, shutdown_event
    dp: Dispatcher | None = None
    
    try:
        # Validate bot token
        if not BOT_TOKEN:
            raise ValueError("BOT_TOKEN is not set in environment variables")
        
        # Initialize bot and dispatcher
        bot_instance = Bot(
            token=BOT_TOKEN,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML)
        )
        
        # Test bot token
        bot_info = await bot_instance.get_me()
        logger.info(f"Bot initialized: @{bot_info.username} ({bot_info.first_name})")
        
        # Set session maker for handlers
        session_maker = async_session
        
        # Initialize dispatcher with memory storage
        storage = MemoryStorage()
        dp = Dispatcher(storage=storage)
        shutdown_event = asyncio.Event()

        def _signal_handler():
            if not shutdown_event.is_set():
                logger.info("Shutdown signal received. Stopping bot gracefully...")
                shutdown_event.set()

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            with suppress(NotImplementedError):
                loop.add_signal_handler(sig, _signal_handler)
        
        # Initialize broadcast service
        broadcast_service = BroadcastService(bot_instance, async_session)
        
        # Register routers - ترتيب مهم: start.router يجب أن يكون آخراً!
        dp.include_routers(
            games.router,  # نظام الألعاب الجديد
            tickets.router,  # نظام التذاكر (شكاوى، إيداع، سحب)
            penalty_shootout.router,  # لعبة ضربات الجزاء
            user_settings.router,
            financial_operations.router,
            currency.router,
            addresses.router,
            requests.router,
            profile.router,
            support.router,
            wallet.router,
            affiliate.router,
            admin_comprehensive.router,
            admin_advanced.router,
            admin.router,
            broadcast.router,
            announcements.router,
            flying_plane_handler.router,
            legacy_handlers.router,
            start.router  # آخر router لأنه يحتوي على fallback handler
        )
        
        # Set session maker and services for handlers
        for router in [games.router, tickets.router, penalty_shootout.router, user_settings.router, financial_operations.router, currency.router,
                      addresses.router, requests.router, profile.router, support.router,
                      wallet.router, affiliate.router,
                      admin_comprehensive.router, admin_advanced.router, admin.router, 
                      broadcast.router, announcements.router, 
                      flying_plane_handler.router, legacy_handlers.router, start.router]:
            router.message.middleware.register(SessionMiddleware(async_session))
            router.callback_query.middleware.register(SessionMiddleware(async_session))
        
        # Start broadcast service worker
        broadcast_worker_task = asyncio.create_task(broadcast_service.worker())
        logger.info("Broadcast service worker started")
        
        # Start polling under explicit signal control
        logger.info("Starting bot polling...")
        polling_task = asyncio.create_task(
            dp.start_polling(
                bot_instance,
                stop_signals=None,
                allowed_updates=dp.resolve_used_update_types(),
            )
        )

        shutdown_waiter = asyncio.create_task(shutdown_event.wait())
        done, _ = await asyncio.wait(
            {polling_task, shutdown_waiter},
            return_when=asyncio.FIRST_COMPLETED,
        )

        if shutdown_waiter in done and not polling_task.done():
            polling_task.cancel()
            logger.info("Cancelling polling task after shutdown signal...")
            await asyncio.gather(polling_task, return_exceptions=True)
        elif polling_task in done and polling_task.exception():
            raise polling_task.exception()
        shutdown_waiter.cancel()
        with suppress(Exception):
            await shutdown_waiter
        
    except Exception as e:
        logger.error(f"Bot startup failed: {e}")
        raise
    finally:
        await graceful_shutdown(dp)


async def graceful_shutdown(dp: Dispatcher | None):
    """Attempt a full cleanup of bot resources."""
    global bot_instance, broadcast_service, broadcast_worker_task, polling_task, session_maker

    # Stop broadcast worker first
    if broadcast_service:
        with suppress(Exception):
            await broadcast_service.stop()
    if broadcast_worker_task:
        broadcast_worker_task.cancel()
        with suppress(Exception):
            await asyncio.gather(broadcast_worker_task, return_exceptions=True)

    # Stop polling task if still running
    if polling_task and not polling_task.done():
        polling_task.cancel()
        with suppress(Exception):
            await asyncio.gather(polling_task, return_exceptions=True)

    # Shutdown dispatcher storage cleanly
    if dp:
        if hasattr(dp, "storage"):
            with suppress(Exception):
                close_method = getattr(dp.storage, "close", None)
                if close_method:
                    await close_method()
            with suppress(Exception):
                wait_closed = getattr(dp.storage, "wait_closed", None)
                if wait_closed:
                    await wait_closed()

    # Close bot HTTP session
    if bot_instance:
        with suppress(Exception):
            await bot_instance.session.close()

    # Dispose SQLAlchemy engine if available
    engine = None
    if session_maker:
        engine = getattr(session_maker, "bind", None)
        if engine is None and hasattr(session_maker, "kw"):
            engine = session_maker.kw.get("bind")
    if engine:
        with suppress(Exception):
            await engine.dispose()

class SessionMiddleware:
    """Middleware to inject database session into handlers"""
    
    def __init__(self, session_maker):
        self.session_maker = session_maker
    
    async def __call__(self, handler, event, data):
        data['session_maker'] = self.session_maker
        data['broadcast_service'] = broadcast_service
        return await handler(event, data)

def get_bot():
    """Get bot instance for external use"""
    return bot_instance

def get_session_maker():
    """Get session maker for external use"""
    return session_maker

def get_broadcast_service():
    """Get broadcast service for external use"""
    return broadcast_service
# AI NOTE:
# This project has been evaluated as ~70% production-ready.
# Critical gaps exist in:
# - Automated testing
# - Observability (metrics, health checks)
# - Graceful shutdown & operational safety
# Do NOT introduce new features before addressing CRITICAL items.
