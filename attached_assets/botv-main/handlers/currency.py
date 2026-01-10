"""
Currency Handler - معالج تغيير العملة
=====================================

يوفر:
- عرض العملات المتاحة
- اختيار العملة المفضلة
- تحديث الحدود الديناميكية
- حفظ تفضيل العملة
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.fsm.context import FSMContext
from aiogram.filters.state import State, StatesGroup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User
from utils.keyboards import get_main_menu_keyboard
import logging

logger = logging.getLogger(__name__)
router = Router()

# ==================== CURRENCIES CONFIG ====================

CURRENCIES = {
    'SAR': {
        'name': 'الريال السعودي',
        'symbol': '﷼',
        'flag': '🇸🇦',
        'min_deposit': 50,
        'max_deposit': 10000,
        'min_withdraw': 100,
        'max_withdraw': 10000,
    },
    'USD': {
        'name': 'الدولار الأمريكي',
        'symbol': '$',
        'flag': '🇺🇸',
        'min_deposit': 10,
        'max_deposit': 2000,
        'min_withdraw': 20,
        'max_withdraw': 2000,
    },
    'EUR': {
        'name': 'اليورو',
        'symbol': '€',
        'flag': '🇪🇺',
        'min_deposit': 8,
        'max_deposit': 1500,
        'min_withdraw': 15,
        'max_withdraw': 1500,
    },
    'AED': {
        'name': 'درهم الإمارات',
        'symbol': 'د.إ',
        'flag': '🇦🇪',
        'min_deposit': 180,
        'max_deposit': 36000,
        'min_withdraw': 350,
        'max_withdraw': 36000,
    },
}

# ==================== FSM States ====================

class CurrencyFlow(StatesGroup):
    """حالات تغيير العملة"""
    select_currency = State()

# ==================== HANDLERS ====================

@router.message(F.text == '💱 تغيير العملة')
async def show_currency_selection(message: Message, state: FSMContext, session_maker):
    """عرض خيارات العملات المتاحة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            return
        
        current_currency = user.language_code or 'SAR'
        
        text = """💱 اختر عملتك المفضلة:

"""
        buttons = []
        
        for code, info in CURRENCIES.items():
            is_current = "✅ " if code == current_currency else "   "
            text += f"{is_current}{info['flag']} {info['name']}\n"
            text += f"    💰 من {info['min_deposit']} إلى {info['max_deposit']}\n\n"
            
            button_text = f"{info['flag']} {info['name']}"
            buttons.append([KeyboardButton(text=button_text)])
        
        buttons.append([KeyboardButton(text='❌ إلغاء')])
        
        keyboard = ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard=True)
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(CurrencyFlow.select_currency)

@router.message(CurrencyFlow.select_currency)
async def save_currency_preference(message: Message, state: FSMContext, session_maker):
    """حفظ تفضيل العملة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            await state.clear()
            return
        
        selected_text = message.text.strip()
        
        if selected_text == '❌ إلغاء':
            await message.answer("❌ تم إلغاء تغيير العملة", reply_markup=get_main_menu_keyboard(user.language_code))
            await state.clear()
            return
        
        # البحث عن العملة المختارة
        selected_code = None
        for code, info in CURRENCIES.items():
            if selected_text == f"{info['flag']} {info['name']}":
                selected_code = code
                break
        
        if not selected_code:
            await message.answer("❌ عملة غير صحيحة. اختر من القائمة")
            return
        
        # تحديث عملة المستخدم (في حقل مخصص)
        # ملاحظة: قد تحتاج لإضافة حقل currency_code في User model
        user.language_code = selected_code  # استخدام حقل موجود مؤقتاً
        await session.commit()
        
        # الحصول على معلومات العملة
        info = CURRENCIES[selected_code]
        
        text = f"""✅ تم تحديث العملة بنجاح!

💱 العملة الجديدة: {info['name']}
🔣 الرمز: {info['symbol']}
{info['flag']} البلد/المنطقة

💰 الحدود الجديدة:
   أقل إيداع: {info['min_deposit']} {info['symbol']}
   أقصى إيداع: {info['max_deposit']} {info['symbol']}
   أقل سحب: {info['min_withdraw']} {info['symbol']}
   أقصى سحب: {info['max_withdraw']} {info['symbol']}

✨ ستظهر هذه العملة في جميع معاملاتك"""
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))
        logger.info(f"تم تحديث عملة المستخدم {message.from_user.id} إلى {selected_code}")
        await state.clear()

# ==================== HELPER FUNCTIONS ====================

def get_currency_limits(currency_code: str = 'SAR'):
    """الحصول على حدود العملة"""
    return CURRENCIES.get(currency_code, CURRENCIES['SAR'])

def format_amount(amount: float, currency_code: str = 'SAR') -> str:
    """تنسيق المبلغ مع رمز العملة"""
    info = CURRENCIES.get(currency_code, CURRENCIES['SAR'])
    return f"{amount:,.2f} {info['symbol']}"
