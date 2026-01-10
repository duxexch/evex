"""
My Requests Handler - معالج "طلباتي"
====================================

يوفر:
- عرض جميع طلبات المستخدم
- تصفية حسب الحالة (معلقة/موافق/مرفوضة)
- تفاصيل كل طلب
- متابعة حالة الطلب
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from models import User, Outbox, OutboxType, OutboxStatus
from utils.keyboards import get_main_menu_keyboard
import logging

logger = logging.getLogger(__name__)
router = Router()

# ==================== HANDLERS ====================

@router.message(F.text == '📋 طلباتي')
async def show_my_requests(message: Message, state: FSMContext, session_maker):
    """عرض طلبات المستخدم"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            return
        
        # جلب جميع طلبات المستخدم
        stmt = select(Outbox).where(
            Outbox.user_id == message.from_user.id
        ).order_by(desc(Outbox.created_at))
        
        requests = await session.scalars(stmt)
        requests = list(requests.all())
        
        if not requests:
            text = """📋 طلباتي

لا توجد طلبات حالياً.

📝 ابدأ طلب جديد:
💰 طلب إيداع
💸 طلب سحب
📨 شكوى"""
            
            await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))
            return
        
        # عرض الخيارات
        text = """📋 طلباتي

اختر فئة الطلبات:"""
        
        keyboard = [
            [KeyboardButton(text='⏳ الطلبات المعلقة')],
            [KeyboardButton(text='✅ الطلبات الموافق عليها')],
            [KeyboardButton(text='❌ الطلبات المرفوضة')],
            [KeyboardButton(text='📊 جميع الطلبات')],
            [KeyboardButton(text='↩️ العودة')],
        ]
        
        reply_keyboard = ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)
        await message.answer(text, reply_markup=reply_keyboard)
        await state.update_data(all_requests=requests)

@router.message(F.text.in_(['⏳ الطلبات المعلقة', '✅ الطلبات الموافق عليها', '❌ الطلبات المرفوضة', '📊 جميع الطلبات']))
async def show_filtered_requests(message: Message, state: FSMContext, session_maker):
    """عرض الطلبات المفلترة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        data = await state.get_data()
        all_requests = data.get('all_requests', [])
        
        # تصفية حسب الحالة
        if message.text == '⏳ الطلبات المعلقة':
            filtered = [r for r in all_requests if r.status == OutboxStatus.PENDING]
            title = "⏳ الطلبات المعلقة"
            emoji = "⏳"
        elif message.text == '✅ الطلبات الموافق عليها':
            filtered = [r for r in all_requests if r.status == OutboxStatus.APPROVED]
            title = "✅ الطلبات الموافق عليها"
            emoji = "✅"
        elif message.text == '❌ الطلبات المرفوضة':
            filtered = [r for r in all_requests if r.status == OutboxStatus.REJECTED]
            title = "❌ الطلبات المرفوضة"
            emoji = "❌"
        else:  # جميع الطلبات
            filtered = all_requests
            title = "📊 جميع الطلبات"
            emoji = "📊"
        
        if not filtered:
            text = f"{title}\n\nلا توجد طلبات في هذه الفئة"
            await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))
            return
        
        text = f"""{emoji} {title}

"""
        
        # عرض آخر 20 طلب
        for request in filtered[:20]:
            type_emoji = "💰" if request.type == OutboxType.DEPOSIT else "💸"
            
            # تحديد الحالة
            if request.status == OutboxStatus.PENDING:
                status_text = "⏳ معلق"
            elif request.status == OutboxStatus.APPROVED:
                status_text = "✅ موافق"
            elif request.status == OutboxStatus.REJECTED:
                status_text = "❌ مرفوض"
            else:
                status_text = "📊 آخر"
            
            text += f"""{type_emoji} {request.id}
├─ المبلغ: {request.amount}
├─ الحالة: {status_text}
├─ التاريخ: {request.created_at.strftime('%Y-%m-%d %H:%M')}
└─ التفاصيل: {request.notes or 'بدون تفاصيل'}

"""
        
        if len(filtered) > 20:
            text += f"... و {len(filtered) - 20} طلب أخر"
        
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))

@router.message(F.text == '↩️ العودة')
async def back_to_menu(message: Message, state: FSMContext, session_maker):
    """العودة للقائمة الرئيسية"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        await message.answer("العودة...", reply_markup=get_main_menu_keyboard(user.language_code))
        await state.clear()
