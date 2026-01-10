"""
Saved Addresses Handler - معالج العناوين المحفوظة
================================================

يوفر:
- عرض العناوين المحفوظة السابقة
- إضافة عنوان جديد
- اختيار من العناوين المحفوظة
- حذف عنوان (اختياري)
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.fsm.context import FSMContext
from aiogram.filters.state import State, StatesGroup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User, WithdrawalAddress
from utils.keyboards import get_main_menu_keyboard
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = Router()

# ==================== FSM States ====================

class AddressFlow(StatesGroup):
    """حالات التعامل مع العناوين"""
    select_address = State()
    enter_new_address = State()
    confirm_address = State()

# ==================== HANDLERS ====================

async def show_saved_addresses(message: Message, state: FSMContext, session_maker, for_withdrawal=True):
    """عرض العناوين المحفوظة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            return
        
        # جلب العناوين المحفوظة
        stmt = select(WithdrawalAddress).where(
            WithdrawalAddress.user_id == message.from_user.id,
            WithdrawalAddress.is_active == True
        ).order_by(WithdrawalAddress.created_at.desc())
        
        addresses = await session.scalars(stmt)
        addresses = list(addresses.all())
        
        text = "📍 العناوين المحفوظة:\n\n"
        buttons = []
        
        if addresses:
            # عرض العناوين المحفوظة
            for i, addr in enumerate(addresses, 1):
                label = addr.label or f"العنوان {i}"
                text += f"{i}️⃣ {label}\n"
                text += f"   📍 {addr.address}\n"
                text += f"   📅 {addr.created_at.strftime('%Y-%m-%d')}\n\n"
                
                button_text = f"✅ {label}"
                buttons.append([KeyboardButton(text=button_text)])
        
        # خيار عنوان جديد
        text += "➕ أو أضف عنوان جديد"
        buttons.append([KeyboardButton(text='➕ عنوان جديد')])
        buttons.append([KeyboardButton(text='❌ إلغاء')])
        
        keyboard = ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard=True)
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(AddressFlow.select_address)
        await state.update_data(addresses=addresses)

@router.message(AddressFlow.select_address)
async def select_or_add_address(message: Message, state: FSMContext, session_maker):
    """اختيار عنوان أو إضافة جديد"""
    text = message.text.strip()
    
    if text == '❌ إلغاء':
        async with session_maker() as session:
            user = await session.get(User, message.from_user.id)
            await message.answer("❌ تم الإلغاء", reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
        await state.clear()
        return
    
    if text == '➕ عنوان جديد':
        # الانتقال لإدخال عنوان جديد
        new_text = """➕ أضف عنوان جديد

أدخل العنوان بصيغة واضحة:
مثال: شارع الملك فهد - الدور الأول بجانب مول الرياض"""
        
        await message.answer(new_text, reply_markup=ReplyKeyboardRemove())
        await state.set_state(AddressFlow.enter_new_address)
        return
    
    # البحث عن العنوان المختار
    data = await state.get_data()
    addresses = data.get('addresses', [])
    
    selected_address = None
    for addr in addresses:
        label = addr.label or "العنوان"
        if text == f"✅ {label}":
            selected_address = addr.address
            break
    
    if selected_address:
        await message.answer(f"✅ تم اختيار العنوان:\n{selected_address}")
        await state.update_data(selected_address=selected_address)
        # الانتقال للخطوة التالية (سيتم التعامل معها في financial_operations.py)
        await state.clear()
        return
    
    await message.answer("❌ عنوان غير صحيح")

@router.message(AddressFlow.enter_new_address)
async def confirm_new_address(message: Message, state: FSMContext, session_maker):
    """تأكيد العنوان الجديد"""
    address = message.text.strip()
    
    if len(address) < 10:
        await message.answer("❌ العنوان قصير جداً. أدخل عنوان أكثر تفصيلاً")
        return
    
    if len(address) > 200:
        await message.answer("❌ العنوان طويل جداً")
        return
    
    # تأكيد العنوان
    text = f"""📍 تأكيد العنوان الجديد:

{address}

هل تؤكد حفظ هذا العنوان؟"""
    
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text='✅ نعم، احفظ'), KeyboardButton(text='❌ لا، غير')],
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(AddressFlow.confirm_address)
    await state.update_data(new_address=address)

@router.message(AddressFlow.confirm_address)
async def save_new_address(message: Message, state: FSMContext, session_maker):
    """حفظ العنوان الجديد"""
    async with session_maker() as session:
        if message.text != '✅ نعم، احفظ':
            await message.answer("❌ تم الإلغاء")
            await state.clear()
            return
        
        data = await state.get_data()
        address = data.get('new_address')
        
        # حفظ العنوان الجديد
        new_addr = WithdrawalAddress(
            user_id=message.from_user.id,
            address=address,
            label=None,
            is_active=True,
            created_at=datetime.now()
        )
        
        session.add(new_addr)
        await session.commit()
        
        user = await session.get(User, message.from_user.id)
        
        text = f"""✅ تم حفظ العنوان بنجاح!

📍 العنوان: {address}

سيتم استخدام هذا العنوان في طلب السحب الحالي."""
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
        
        # تمرير العنوان للمرحلة التالية
        await state.update_data(selected_address=address)
        logger.info(f"تم حفظ عنوان جديد للمستخدم {message.from_user.id}")
        
        await state.clear()
