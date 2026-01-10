"""
معالج لوحة التحكم المتقدمة - Advanced Admin Dashboard Handler
إدارة المستخدمين، العمولات، أرصدة المحافظ، وتغيير العملات
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from models import (
    User, Wallet, Affiliate, AffiliateCommission, AffiliatePayout, 
    AffiliateStatus, OutboxStatus as TransactionStatus, PaymentMethod, PaymentMethodStatus
)
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = Router()

# Admin User IDs - معرفات الإداريين
ADMIN_IDS = [7146701713]  # معرف المسؤول الرئيسي


class AdminStates(StatesGroup):
    """حالات البحث في لوحة التحكم"""
    searching_user = State()
    viewing_user = State()
    changing_user_currency = State()
    changing_user_balance = State()
    viewing_affiliate_stats = State()
    approving_commission = State()


# ==================== MAIN ADMIN DASHBOARD ====================

@router.message(F.text == '⚙️ لوحة التحكم')
async def admin_dashboard(message: Message):
    """عرض لوحة التحكم الرئيسية"""
    # التحقق من أن المستخدم إداري
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ أنت لا تملك صلاحية الوصول")
        return
    
    text = """⚙️ **لوحة التحكم الإدارية**

اختر ما تريد إدارته:"""
    
    keyboard = [
        [KeyboardButton(text='👥 إدارة المستخدمين'), KeyboardButton(text='💰 إدارة الأرصدة')],
        [KeyboardButton(text='🤝 إدارة الوكلاء'), KeyboardButton(text='💵 إدارة العمولات')],
        [KeyboardButton(text='🏦 طرق الدفع'), KeyboardButton(text='📊 التقارير')],
        [KeyboardButton(text='🏠 القائمة الرئيسية')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


# ==================== USER MANAGEMENT ====================

@router.message(F.text == '👥 إدارة المستخدمين')
async def user_management(message: Message, state: FSMContext):
    """إدارة المستخدمين"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    text = """👥 **إدارة المستخدمين**

أدخل معرف المستخدم أو رقم الهاتف للبحث:"""
    
    await message.answer(text)
    await state.set_state(AdminStates.searching_user)


@router.message(AdminStates.searching_user)
async def search_user(message: Message, state: FSMContext, session: AsyncSession):
    """البحث عن مستخدم"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    search_query = message.text.strip()
    
    # البحث برقم تليجرام أو الهاتف
    stmt = select(User).where(
        (User.telegram_id == int(search_query) if search_query.isdigit() else False) |
        (User.phone == search_query)
    )
    
    user = await session.scalar(stmt)
    
    if not user:
        await message.answer("❌ لم يتم العثور على المستخدم")
        await state.clear()
        return
    
    await state.update_data(selected_user_id=user.id)
    await show_user_details(message, session, user)
    await state.set_state(AdminStates.viewing_user)


async def show_user_details(message: Message, session: AsyncSession, user: User):
    """عرض تفاصيل المستخدم"""
    # جلب المحافظ
    stmt = select(Wallet).where(Wallet.user_id == user.id, Wallet.is_active == True)
    wallets = await session.scalars(stmt)
    
    wallets_info = "\n".join([
        f"💰 {w.currency}: {w.balance:,.2f} ر.س (مجمد: {w.frozen_amount:,.2f})"
        for w in wallets
    ])
    
    text = f"""👤 **تفاصيل المستخدم**

📌 **المعلومات الأساسية:**
• المعرف: {user.id}
• تليجرام: {user.telegram_id}
• الاسم: {user.first_name} {user.last_name or ''}
• الهاتف: {user.phone}
• اللغة: {user.language}
• التاريخ: {user.created_at.strftime('%d/%m/%Y')}

💰 **الأرصدة:**
{wallets_info or 'لا توجد محافظ'}

📊 **الإحصائيات:**
• العمليات: {len(await session.scalars(select(func.count(Wallet.id))))}

اختر العملية:"""
    
    keyboard = [
        [KeyboardButton(text='💰 تغيير الرصيد'), KeyboardButton(text='💱 تغيير العملة')],
        [KeyboardButton(text='🔒 حظر/فتح'), KeyboardButton(text='🗑️ حذف')],
        [KeyboardButton(text='⬅️ رجوع'), KeyboardButton(text='🏠 القائمة الرئيسية')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


@router.message(F.text == '💰 تغيير الرصيد')
async def change_user_balance(message: Message, state: FSMContext):
    """تغيير رصيد المستخدم"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    text = """💰 **تغيير الرصيد**

أدخل المبلغ والعملة:
مثال: 500 SAR أو -200 USD"""
    
    await message.answer(text)
    await state.set_state(AdminStates.changing_user_balance)


@router.message(AdminStates.changing_user_balance)
async def process_balance_change(message: Message, state: FSMContext, session: AsyncSession):
    """معالجة تغيير الرصيد"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    try:
        # مثال: "500 SAR" أو "-200 USD"
        parts = message.text.split()
        amount = float(parts[0])
        currency = parts[1].upper() if len(parts) > 1 else 'SAR'
        
        data = await state.get_data()
        user_id = data.get('selected_user_id')
        
        # جلب أو إنشاء المحفظة
        wallet = await session.scalar(
            select(Wallet).where(
                Wallet.user_id == user_id,
                Wallet.currency == currency
            )
        )
        
        if not wallet:
            await message.answer(f"❌ لا توجد محفظة {currency} للمستخدم")
            return
        
        old_balance = wallet.balance
        wallet.balance += amount
        
        await session.commit()
        
        await message.answer(
            f"✅ تم تحديث الرصيد:\n"
            f"العملة: {currency}\n"
            f"الرصيد السابق: {old_balance:,.2f}\n"
            f"الرصيد الجديد: {wallet.balance:,.2f}"
        )
        
        await state.clear()
    
    except Exception as e:
        await message.answer(f"❌ خطأ: {str(e)}")
        logger.error(f"Error changing balance: {e}")


@router.message(F.text == '💱 تغيير العملة')
async def change_user_currency(message: Message, state: FSMContext):
    """تغيير عملة المستخدم الأساسية"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    text = """💱 **تغيير العملة**

اختر العملة الجديدة:"""
    
    keyboard = [
        [KeyboardButton(text='🇸🇦 SAR'), KeyboardButton(text='🇺🇸 USD'), KeyboardButton(text='🇪🇺 EUR')],
        [KeyboardButton(text='🇦🇪 AED'), KeyboardButton(text='🇪🇬 EGP'), KeyboardButton(text='🇰🇼 KWD')],
        [KeyboardButton(text='⬅️ رجوع')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))
    await state.set_state(AdminStates.changing_user_currency)


@router.message(AdminStates.changing_user_currency)
async def process_currency_change(message: Message, state: FSMContext, session: AsyncSession):
    """معالجة تغيير العملة"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    # استخراج رمز العملة من الرسالة
    currency = message.text.split()[-1].upper() if ' ' in message.text else message.text.upper()
    
    data = await state.get_data()
    user_id = data.get('selected_user_id')
    
    # تحديث عملة المستخدم الأساسية
    user = await session.get(User, user_id)
    user.preferred_currency = currency
    await session.commit()
    
    await message.answer(f"✅ تم تغيير العملة الأساسية إلى {currency}")
    await state.clear()


# ==================== AFFILIATE MANAGEMENT ====================

@router.message(F.text == '🤝 إدارة الوكلاء')
async def affiliate_management(message: Message, session: AsyncSession):
    """إدارة الوكلاء"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    # إحصائيات الوكلاء
    stmt = select(func.count(Affiliate.id)).where(
        Affiliate.status == AffiliateStatus.ACTIVE
    )
    active_count = await session.scalar(stmt)
    
    stmt = select(func.sum(Affiliate.total_commission_earned))
    total_earned = await session.scalar(stmt) or 0
    
    text = f"""🤝 **إدارة الوكلاء**

📊 **الإحصائيات:**
• الوكلاء النشطين: {active_count}
• إجمالي العمولات: {total_earned:,.2f} ر.س

اختر:"""
    
    keyboard = [
        [KeyboardButton(text='👀 عرض جميع الوكلاء')],
        [KeyboardButton(text='🔍 البحث عن وكيل')],
        [KeyboardButton(text='⬅️ رجوع')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


# ==================== COMMISSION MANAGEMENT ====================

@router.message(F.text == '💵 إدارة العمولات')
async def commission_management(message: Message, session: AsyncSession):
    """إدارة العمولات"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    # جلب العمولات المعلقة
    stmt = select(AffiliateCommission).where(
        AffiliateCommission.status == TransactionStatus.PENDING
    )
    pending = await session.scalars(stmt)
    pending_count = len(await session.scalars(stmt))
    
    text = f"""💵 **إدارة العمولات**

📋 **العمولات المعلقة:** {pending_count}

اختر:"""
    
    keyboard = [
        [KeyboardButton(text='⏳ عرض المعلقة'), KeyboardButton(text='✅ الموافقة')],
        [KeyboardButton(text='💳 طلبات السحب'), KeyboardButton(text='📊 التقرير')],
        [KeyboardButton(text='⬅️ رجوع')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


# ==================== PAYMENT METHODS ====================

@router.message(F.text == '🏦 طرق الدفع')
async def manage_payment_methods(message: Message, session: AsyncSession):
    """إدارة طرق الدفع"""
    if message.from_user.id not in ADMIN_IDS:
        return
    
    # جلب طرق الدفع
    stmt = select(PaymentMethod).order_by(PaymentMethod.order)
    methods = await session.scalars(stmt)
    
    methods_text = "\n".join([
        f"{'✅' if m.is_active else '❌'} {m.display_name_ar} ({m.name})\n"
        f"   الإيداع: {m.deposit_fee}% | السحب: {m.withdrawal_fee}%"
        for m in methods
    ])
    
    text = f"""🏦 **طرق الدفع**

{methods_text or 'لا توجد طرق دفع'}

اختر:"""
    
    keyboard = [
        [KeyboardButton(text='➕ إضافة طريقة'), KeyboardButton(text='✏️ تعديل')],
        [KeyboardButton(text='⬅️ رجوع')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))
