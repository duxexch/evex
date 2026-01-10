"""
Support and contact handler - معالج الدعم والشكاوى المحسّن
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.filters import StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models import User, Outbox, OutboxStatus
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ==================== FSM ====================

class ComplaintFlow(StatesGroup):
    select_type = State()
    enter_details = State()
    confirm = State()

# ==================== KEYBOARDS ====================

def get_complaint_type_keyboard():
    """لوحة مفاتيح أنواع الشكاوى"""
    keyboard = [
        [KeyboardButton(text='💰 مشكلة في الإيداع')],
        [KeyboardButton(text='💸 مشكلة في السحب')],
        [KeyboardButton(text='❌ رسوم غير متوقعة')],
        [KeyboardButton(text='🐌 تأخير في المعاملة')],
        [KeyboardButton(text='🔐 مشكلة في الأمان')],
        [KeyboardButton(text='📱 مشكلة تقنية')],
        [KeyboardButton(text='📝 أخرى')],
        [KeyboardButton(text='↩️ رجوع')],
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True, one_time_keyboard=True)

def get_main_menu_keyboard(language='ar'):
    """Get main menu keyboard"""
    if language == 'en':
        keyboard = [
            [KeyboardButton(text='💰 Deposit'), KeyboardButton(text='💸 Withdraw')],
            [KeyboardButton(text='📊 My Requests'), KeyboardButton(text='💳 Payment Methods')],
            [KeyboardButton(text='👤 Profile'), KeyboardButton(text='📞 Support')],
        ]
    else:
        keyboard = [
            [KeyboardButton(text='💰 إيداع'), KeyboardButton(text='💸 سحب')],
            [KeyboardButton(text='📊 طلباتي'), KeyboardButton(text='💳 طرق الدفع')],
            [KeyboardButton(text='👤 حسابي'), KeyboardButton(text='📞 الدعم')],
        ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

router = Router()

@router.message(F.text.in_(['📞 الدعم', '🆘 دعم']))
async def show_support_menu(message: Message, state: FSMContext, session_maker):
    """عرض قائمة الدعم والشكاوى"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            return
        
        text = """📞 خدمة الدعم والشكاوى

📋 الخيارات المتاحة:
├─ 📝 تقديم شكوى جديدة
├─ 📊 حالة الشكاوى السابقة
├─ 💬 الردود
└─ 📞 التواصل معنا"""
        
        keyboard = [
            [KeyboardButton(text='📝 شكوى جديدة'), KeyboardButton(text='📊 حالة الشكاوى')],
            [KeyboardButton(text='💬 الردود')],
            [KeyboardButton(text='📞 تواصل معنا'), KeyboardButton(text='↩️ رجوع')],
        ]
        
        reply_keyboard = ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True, one_time_keyboard=True)
        await message.answer(text, reply_markup=reply_keyboard)

@router.message(F.text.in_(['📝 شكوى جديدة', '📨 شكوى']))
async def start_complaint(message: Message, state: FSMContext, session_maker):
    """بدء عملية تقديم شكوى"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        text = """📝 تقديم شكوى جديدة

اختر نوع الشكوى:"""
        
        await state.set_state(ComplaintFlow.select_type)
        await message.answer(text, reply_markup=get_complaint_type_keyboard())

@router.message(ComplaintFlow.select_type)
async def select_complaint_type(message: Message, state: FSMContext, session_maker):
    """اختيار نوع الشكوى"""
    if message.text == '↩️ رجوع':
        async with session_maker() as session:
            user = await session.get(User, message.from_user.id)
            await message.answer("↩️ تم الإلغاء", reply_markup=get_main_menu_keyboard(user.language_code or 'ar'))
        await state.clear()
        return
    
    complaint_types = {
        '💰 مشكلة في الإيداع': 'deposit_issue',
        '💸 مشكلة في السحب': 'withdrawal_issue',
        '❌ رسوم غير متوقعة': 'unexpected_fees',
        '🐌 تأخير في المعاملة': 'transaction_delay',
        '🔐 مشكلة في الأمان': 'security_issue',
        '📱 مشكلة تقنية': 'technical_issue',
        '📝 أخرى': 'other',
    }
    
    complaint_type = complaint_types.get(message.text)
    if not complaint_type:
        await message.answer("❌ اختيار غير صحيح، حاول مرة أخرى")
        return
    
    await state.update_data(complaint_type=complaint_type, complaint_type_text=message.text)
    
    text = """📝 الآن اكتب تفاصيل الشكوى:

⚠️ يرجى تقديم تفاصيل دقيقة"""
    
    await state.set_state(ComplaintFlow.enter_details)
    await message.answer(text)

@router.message(ComplaintFlow.enter_details)
async def enter_complaint_details(message: Message, state: FSMContext, session_maker):
    """إدخال تفاصيل الشكوى"""
    if len(message.text) < 10:
        await message.answer("❌ التفاصيل قصيرة جداً، يرجى كتابة 10 أحرف على الأقل")
        return
    
    await state.update_data(complaint_details=message.text)
    
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        data = await state.get_data()
        
        text = f"""✅ تأكيد الشكوى

📋 البيانات:
├─ النوع: {data.get('complaint_type_text', 'غير محدد')}
├─ التفاصيل: {data.get('complaint_details', 'غير محدد')[:100]}...

هل تريد تقديم هذه الشكوى؟"""
        
        keyboard = [
            [KeyboardButton(text='✅ تقديم'), KeyboardButton(text='❌ إلغاء')],
        ]
        
        await state.set_state(ComplaintFlow.confirm)
        await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True, one_time_keyboard=True))

@router.message(ComplaintFlow.confirm)
async def submit_complaint(message: Message, state: FSMContext, session_maker):
    """تقديم الشكوى"""
    if message.text == '❌ إلغاء':
        async with session_maker() as session:
            user = await session.get(User, message.from_user.id)
            await message.answer("↩️ تم إلغاء الشكوى", reply_markup=get_main_menu_keyboard(user.language_code or 'ar'))
        await state.clear()
        return
    
    data = await state.get_data()
    
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        
        complaint = Outbox(
            user_id=message.from_user.id,
            type='complaint',
            amount=0,
            status=OutboxStatus.PENDING,
            extra_data={
                'complaint_type': data.get('complaint_type'),
                'complaint_details': data.get('complaint_details'),
                'submitted_at': datetime.now().isoformat(),
            }
        )
        
        session.add(complaint)
        await session.commit()
        
        text = f"""✅ تم تقديم الشكوى بنجاح!

📋 تفاصيل الشكوى:
├─ رقم الشكوى: {complaint.id}
├─ الحالة: ⏳ قيد المراجعة
└─ الوقت: {datetime.now().strftime('%Y-%m-%d %H:%M')}

⏱️ سيتم التحقق من شكواك خلال 24 ساعة"""
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code or 'ar'))
        await state.clear()

@router.message(F.text == '📊 حالة الشكاوى')
async def show_complaint_status(message: Message, state: FSMContext, session_maker):
    """عرض حالة الشكاوى السابقة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        
        stmt = select(Outbox).where(
            and_(
                Outbox.user_id == message.from_user.id,
                Outbox.type == 'complaint'
            )
        ).order_by(Outbox.created_at.desc()).limit(10)
        
        complaints = await session.scalars(stmt)
        complaints = list(complaints)
        
        if not complaints:
            text = "❌ لا توجد شكاوى سابقة"
        else:
            text = f"""📊 حالة الشكاوى الخاصة بك ({len(complaints)}):

"""
            for idx, complaint in enumerate(complaints, 1):
                status_icon = '⏳' if complaint.status == OutboxStatus.PENDING else '✅' if complaint.status == OutboxStatus.APPROVED else '❌'
                complaint_type = complaint.extra_data.get('complaint_type', 'unknown') if complaint.extra_data else 'unknown'
                
                text += f"""{idx}. رقم الشكوى: {complaint.id}
   ├─ الحالة: {status_icon}
   └─ التاريخ: {complaint.created_at.strftime('%Y-%m-%d') if hasattr(complaint, 'created_at') else 'N/A'}

"""
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code or 'ar'))

@router.message(F.text == '📞 تواصل معنا')
async def contact_us(message: Message, state: FSMContext, session_maker):
    """معلومات التواصل مع الدعم"""
    text = """📞 تواصل معنا

يمكنك التواصل معنا عبر:

📱 تطبيق التليجرام:
├─ قناة الدعم: @LangSense_Support
└─ الدردشة المباشرة: تواصل معنا

📧 البريد الإلكتروني:
└─ support@langsense.com

⏱️ ساعات العمل:
└─ من الأحد إلى الخميس: 9 ص - 6 م"""
    
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code or 'ar'))

@router.message(F.text == '↩️ رجوع')
async def back_to_menu(message: Message, state: FSMContext, session_maker):
    """العودة للقائمة الرئيسية"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        await message.answer("↩️ العودة للقائمة الرئيسية", reply_markup=get_main_menu_keyboard(user.language_code or 'ar'))
        await state.clear()
