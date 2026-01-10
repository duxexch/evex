"""
LangSense Telegram Bot - Main Entry Point
"""

import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import BotCommand, BotCommandScopeDefault
from config import TELEGRAM_BOT_TOKEN, LOG_LEVEL

# Import handlers
from handlers import commands, settings, balance, deposit, support, admin
from handlers.middleware import DatabaseMiddleware, I18nMiddleware, LoggingMiddleware
from handlers.database import async_session_maker

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def set_default_commands(bot: Bot):
    """Set bot commands"""
    commands = [
        BotCommand(command="start", description="Start the bot"),
        BotCommand(command="help", description="Get help"),
        BotCommand(command="balance", description="Show balance"),
        BotCommand(command="deposit", description="Make a deposit"),
        BotCommand(command="withdraw", description="Withdraw funds"),
        BotCommand(command="transactions", description="View transactions"),
        BotCommand(command="support", description="Contact support"),
        BotCommand(command="settings", description="Settings"),
        BotCommand(command="cancel", description="Cancel operation"),
    ]
    
    await bot.set_my_commands(commands, BotCommandScopeDefault())


async def main():
    """Main function"""
    
    # Initialize bot and dispatcher
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    dp = Dispatcher()
    
    # Setup middleware
    dp.message.middleware(DatabaseMiddleware())
    dp.callback_query.middleware(DatabaseMiddleware())
    dp.message.middleware(I18nMiddleware())
    dp.callback_query.middleware(I18nMiddleware())
    dp.message.middleware(LoggingMiddleware())
    
    # Register routers
    dp.include_router(commands.router)
    dp.include_router(settings.router)
    dp.include_router(balance.router)
    dp.include_router(deposit.router)
    dp.include_router(support.router)
    dp.include_router(admin.router)
    
    try:
        # Set commands
        await set_default_commands(bot)
        
        logger.info("Starting Telegram bot polling...")
        
        # Start polling
        await dp.start_polling(
            bot,
            allowed_updates=dp.resolve_used_update_types(),
        )
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
