"""
Language selection and settings handler
"""

from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.filters import StateFilter
from sqlalchemy.ext.asyncio import AsyncSession
from handlers.auth import update_user_language, get_user_by_id
from handlers.keyboards import get_main_menu_keyboard
from services.i18n_service import get_i18n_service

router = Router()


@router.callback_query(F.data.startswith("lang_"))
async def set_language(
    query: CallbackQuery,
    session: AsyncSession,
    state: any,
):
    """Handle language selection"""
    
    # Extract language code
    language = query.data.split("_")[1]
    
    if language not in ["ar", "en"]:
        language = "ar"
    
    # Update user language
    user = await update_user_language(session, query.from_user.id, language)
    
    # Update FSM state
    await state.update_data(user_language=language)
    
    # Get i18n service
    i18n = get_i18n_service()
    
    # Send confirmation
    text = i18n.get_text("language_set", language)
    keyboard = get_main_menu_keyboard(language)
    
    await query.message.edit_text(text)
    
    # Get welcome text without placeholders
    welcome_text = i18n.get_text("settings.language_changed", language) if hasattr(i18n, 'get_text') else "✅ تم تغيير اللغة بنجاح"
    
    await query.message.answer(
        welcome_text,
        reply_markup=keyboard
    )
    
    await query.answer()


@router.message(F.text == "⚙️ الإعدادات")
async def settings_menu_ar(
    message: Message,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """Arabic settings menu"""
    
    if user_language != "ar":
        return
    
    user = await get_user_by_id(session, message.from_user.id)
    
    text = i18n.get_text("settings.current_language", "ar")
    text += "\n" + i18n.get_text("settings.choose_language", "ar")
    
    keyboard = get_language_selection_keyboard()
    
    await message.answer(text, reply_markup=keyboard)


@router.message(F.text == "⚙️ Settings")
async def settings_menu_en(
    message: Message,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """English settings menu"""
    
    if user_language != "en":
        return
    
    user = await get_user_by_id(session, message.from_user.id)
    
    text = i18n.get_text("settings.current_language", "en")
    text += "\n" + i18n.get_text("settings.choose_language", "en")
    
    keyboard = get_language_selection_keyboard()
    
    await message.answer(text, reply_markup=keyboard)
