"""
Start and basic commands handler
"""

from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession
from handlers.auth import get_or_create_user, get_user_by_id
from handlers.keyboards import get_language_selection_keyboard, get_main_menu_keyboard
from services.i18n_service import get_i18n_service

router = Router()


@router.message(Command("start"))
async def start_command(
    message: Message,
    state: FSMContext,
    session: AsyncSession,
    i18n: any,
):
    """Handle /start command"""
    
    # Create or get user
    user = await get_or_create_user(
        session,
        user_id=message.from_user.id,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
        username=message.from_user.username,
        language_code=message.from_user.language_code or "ar",
    )
    
    # Store language in state
    language = user.language or "ar"
    await state.update_data(user_language=language)
    
    # First time user - ask for language
    if user.first_login:
        text = i18n.get_text("welcome", language)
        keyboard = get_language_selection_keyboard()
        
        await message.answer(text, reply_markup=keyboard)
        
        # Mark first login as done
        user.first_login = False
        await session.commit()
    else:
        # Returning user
        text = i18n.get_text(
            "welcome_returning",
            language,
            name=user.first_name
        )
        keyboard = get_main_menu_keyboard(language)
        
        await message.answer(text, reply_markup=keyboard)


@router.message(Command("help"))
async def help_command(message: Message, i18n: any, user_language: str):
    """Handle /help command"""
    
    help_text = i18n.get_text("help.intro", user_language)
    help_text += "\n\n"
    help_text += i18n.get_text("help.deposit", user_language)
    help_text += "\n"
    help_text += i18n.get_text("help.withdraw", user_language)
    help_text += "\n"
    help_text += i18n.get_text("help.balance", user_language)
    help_text += "\n"
    help_text += i18n.get_text("help.transactions", user_language)
    
    await message.answer(help_text)


@router.message(Command("settings"))
async def settings_command(message: Message, i18n: any, user_language: str):
    """Handle /settings command"""
    
    text = i18n.get_text("settings.title", user_language)
    keyboard = get_language_selection_keyboard()
    
    await message.answer(text, reply_markup=keyboard)


@router.message(Command("cancel"))
async def cancel_command(
    message: Message,
    state: FSMContext,
    i18n: any,
    user_language: str,
):
    """Handle /cancel command - clear FSM state"""
    
    await state.clear()
    
    text = i18n.get_text("operation_cancelled", user_language)
    keyboard = get_main_menu_keyboard(user_language)
    
    await message.answer(text, reply_markup=keyboard)


@router.message(F.text, StateFilter(None))
async def echo_handler(message: Message, i18n: any, user_language: str):
    """Echo unknown text messages"""
    
    text = i18n.get_text("unknown_command", user_language)
    keyboard = get_main_menu_keyboard(user_language)
    
    await message.answer(text, reply_markup=keyboard)
