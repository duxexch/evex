"""
User Profile Handler - معالج ملف المستخدم
=========================================

يوفر:
- عرض بيانات المستخدم الشخصية
- تحديث اللغة والعملة
- عرض الإحصائيات الشخصية
- خيارات إعادة التعيين
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import User, Outbox, OutboxStatus
from utils.keyboards import get_main_menu_keyboard
import logging

logger = logging.getLogger(__name__)
router = Router()

# ==================== HANDLERS ====================

@router.message(F.text == '👤 حسابي')
async def show_user_profile(message: Message, state: FSMContext, session_maker):
    """عرض ملف المستخدم"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            return
        
        # الإحصائيات
        stmt_deposit = select(func.count(Outbox.id)).where(
            Outbox.user_id == message.from_user.id,
            Outbox.type == "deposit"
        )
        deposit_count = await session.scalar(stmt_deposit)
        
        stmt_withdraw = select(func.count(Outbox.id)).where(
            Outbox.user_id == message.from_user.id,
            Outbox.type == "withdrawal"
        )
        withdraw_count = await session.scalar(stmt_withdraw)
        
        # البيانات الشخصية
        text = f"""👤 ملف المستخدم

📝 البيانات الشخصية:
├─ الاسم: {user.first_name} {user.last_name or ''}
├─ رقم العميل: {user.customer_code or 'لم يتم إنشاؤه بعد'}
├─ معرف التليجرام: {user.telegram_id}
└─ تاريخ التسجيل: {user.created_at.strftime('%Y-%m-%d') if hasattr(user, 'created_at') else 'N/A'}

🌍 الإعدادات:
├─ اللغة: {'العربية 🇸🇦' if user.language_code == 'ar' else 'English 🇬🇧'}
├─ البلد: {user.country_code or 'السعودية'}
└─ الرقم المحفوظ: {user.phone_encrypted and '✅' or '❌'}

💰 الإحصائيات:
├─ عدد الإيداعات: {deposit_count or 0}
├─ عدد الطلبات: {withdraw_count or 0}
├─ الرصيد: {user.balance or '0.00'} ر.س
├─ إجمالي الإيداعات: {user.total_deposited or '0.00'} ر.س
└─ إجمالي السحب: {user.total_withdrawn or '0.00'} ر.س

⚙️ الخيارات:"""
        
        keyboard = [
            [KeyboardButton(text='🌐 تغيير اللغة'), KeyboardButton(text='💱 تغيير العملة')],
            [KeyboardButton(text='🔄 إعادة تعيين'), KeyboardButton(text='❌ تسجيل خروج')],
            [KeyboardButton(text='↩️ العودة')],
        ]
        
        reply_keyboard = ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True, one_time_keyboard=True)
        await message.answer(text, reply_markup=reply_keyboard)

@router.message(F.text == '🌐 تغيير اللغة')
async def change_language(message: Message, state: FSMContext, session_maker):
    """تغيير اللغة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        current_lang = "العربية 🇸🇦" if user.language_code == 'ar' else "English 🇬🇧"
        
        text = f"""🌐 تغيير اللغة

اللغة الحالية: {current_lang}

اختر اللغة الجديدة:"""
        
        keyboard = [
            [KeyboardButton(text='🇸🇦 العربية')],
            [KeyboardButton(text='🇬🇧 English')],
            [KeyboardButton(text='❌ إلغاء')],
        ]
        
        reply_keyboard = ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True, one_time_keyboard=True)
        await message.answer(text, reply_markup=reply_keyboard)

@router.message(F.text.in_(['🇸🇦 العربية', '🇬🇧 English']))
async def save_language(message: Message, state: FSMContext, session_maker):
    """حفظ اللغة الجديدة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        new_lang = 'ar' if '🇸🇦' in message.text else 'en'
        user.language_code = new_lang
        await session.commit()
        
        text = f"""✅ تم تغيير اللغة بنجاح!

اللغة الجديدة: {'العربية 🇸🇦' if new_lang == 'ar' else 'English 🇬🇧'}"""
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(new_lang))

@router.message(F.text == '🔄 إعادة تعيين')
async def reset_system(message: Message, state: FSMContext, session_maker):
    """إعادة تعيين النظام"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        # إلغاء جميع الحالات المعلقة
        await state.clear()
        
        text = """✅ تم إعادة تعيين النظام بنجاح!

سيتم العودة للقائمة الرئيسية."""
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))

@router.message(F.text == '❌ تسجيل خروج')
async def logout(message: Message, state: FSMContext, session_maker):
    """تسجيل خروج المستخدم"""
    await state.clear()
    
    text = """👋 تم تسجيل خروجك بنجاح!

لتسجيل الدخول مجدداً، أرسل /start"""
    
    await message.answer(text)

@router.message(F.text == '↩️ العودة')
async def back_to_menu(message: Message, state: FSMContext, session_maker):
    """العودة للقائمة الرئيسية"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        await message.answer("↩️ العودة للقائمة الرئيسية", reply_markup=get_main_menu_keyboard(user.language_code))
        await state.clear()
