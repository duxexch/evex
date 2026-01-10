"""
معالج الوكلاء والمسوقين - Affiliate Handler
إدارة برنامج الإحالة والعمولات
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import User, Affiliate, AffiliateReferral, AffiliateCommission, AffiliatePayout, AffiliateStatus, CommissionType
from datetime import datetime
import random
import string
import logging

logger = logging.getLogger(__name__)
router = Router()


# ==================== HANDLERS ====================

@router.message(F.text == '🤝 برنامج الإحالة')
async def affiliate_program(message: Message, session_maker):
    """عرض برنامج الإحالة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ لم يتم العثور على حسابك")
            return
        
        # جلب بيانات الوكيل
        affiliate = await session.scalar(
            select(Affiliate).where(Affiliate.user_id == user.id)
        )
    
    if not affiliate:
        # عرض شرح البرنامج
        text = """🤝 **برنامج الإحالة**

احصل على عمولة من كل عميل تحيله!

📊 **كيفية العمل:**
1️⃣ انضم للبرنامج
2️⃣ احصل على رابط إحالتك الفريد
3️⃣ شارك الرابط مع الآخرين
4️⃣ احصل على عمولة من كل عملية

💰 **العمولات:**
• الإيداع: 2%
• السحب: 1%
• الحد الأدنى للدفع: 100 ر.س

🎁 **المميزات:**
✅ تتبع تلقائي للإحالات
✅ دفع شهري منتظم
✅ لا حد أقصى للعمولات
✅ دعم مخصص

هل تريد الانضمام؟"""
        
        keyboard = [
            [KeyboardButton(text='✅ نعم، أنضم الآن'), KeyboardButton(text='❌ لا، شكراً')],
        ]
        
        await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))
    else:
        # عرض بيانات الوكيل
        await show_affiliate_stats(message, session, affiliate)


@router.message(F.text == '✅ نعم، أنضم الآن')
async def join_affiliate_program(message: Message, session_maker):
    """الانضمام لبرنامج الإحالة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        # التحقق من عدم الانضمام مسبقاً
        existing = await session.scalar(
            select(Affiliate).where(Affiliate.user_id == user.id)
        )
        
        if existing:
            await message.answer("✅ أنت بالفعل عضو في برنامج الإحالة")
            return
        
        # إنشاء وكيل جديد
        affiliate_code = generate_affiliate_code()
        
        affiliate = Affiliate(
            user_id=user.id,
            affiliate_code=affiliate_code,
            name=user.first_name or "Unknown",
            commission_type=CommissionType.PERCENTAGE,
            commission_rate=2.0,  # نسبة افتراضية 2%
            status=AffiliateStatus.ACTIVE,
            is_verified=True
        )
        
        session.add(affiliate)
        await session.commit()
        
        text = f"""✅ **تم الانضمام بنجاح!**

🎉 مرحباً بك في برنامج الإحالة!

📌 **كود الإحالة:**
`{affiliate_code}`

🔗 **رابط الإحالة:**
`https://t.me/YourBot?start={affiliate_code}`

📊 **عمولتك:**
• الإيداع: 2%
• السحب: 1%

💡 **نصائح:**
شارك رابطك مع أصدقائك واحصل على عمولة!

"""
        
        keyboard = [
            [KeyboardButton(text='📊 إحصائياتي'), KeyboardButton(text='💰 الأرباح')],
            [KeyboardButton(text='🏠 القائمة الرئيسية')],
        ]
        
        await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


async def show_affiliate_stats(message: Message, session: AsyncSession, affiliate: Affiliate):
    """عرض إحصائيات الوكيل"""
    text = f"""📊 **إحصائيات برنامجك**

👤 **المعلومات:**
• الكود: {affiliate.affiliate_code}
• الحالة: {affiliate.status.value}
• تاريخ الانضمام: {affiliate.created_at.strftime('%d/%m/%Y')}

📈 **الإحصائيات:**
• عدد الإحالات: {affiliate.total_referrals}
• الإحالات النشطة: {affiliate.active_referrals}
• العمولة المستحقة: {affiliate.pending_commission:,.2f} ر.س
• العمولة المدفوعة: {affiliate.total_commission_paid:,.2f} ر.س
• إجمالي العمولة: {affiliate.total_commission_earned:,.2f} ر.س

🔗 **رابط الإحالة:**
`https://t.me/YourBot?start={affiliate.affiliate_code}`
"""
    
    keyboard = [
        [KeyboardButton(text='💰 طلب سحب'), KeyboardButton(text='📋 قائمة الإحالات')],
        [KeyboardButton(text='🏠 القائمة الرئيسية')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


@router.message(F.text == '📊 إحصائياتي')
async def affiliate_stats(message: Message, session_maker):
    """إحصائيات الوكيل"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        affiliate = await session.scalar(
            select(Affiliate).where(Affiliate.user_id == user.id)
        )
        
        if not affiliate:
            await message.answer("❌ أنت لست عضواً في برنامج الإحالة")
            return
        
        await show_affiliate_stats(message, session, affiliate)


@router.message(F.text == '💰 طلب سحب')
async def request_payout(message: Message):
    """طلب سحب الأرباح"""
    text = """💰 **طلب سحب الأرباح**

📋 **خطوات الطلب:**
1. تأكد أن لديك الحد الأدنى (100 ر.س)
2. اختر طريقة الدفع
3. أدخل بيانات الحساب البنكي
4. أرسل الطلب

⏳ سيتم معالجة طلبك خلال 3-5 أيام عمل

هل تريد المتابعة؟"""
    
    keyboard = [
        [KeyboardButton(text='✅ نعم'), KeyboardButton(text='❌ لاحقاً')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


# ==================== HELPER FUNCTIONS ====================

def generate_affiliate_code() -> str:
    """توليد كود إحالة فريد"""
    chars = string.ascii_letters + string.digits
    code = ''.join(random.choice(chars) for _ in range(8))
    return code.upper()


async def calculate_commission(
    session: AsyncSession,
    affiliate_id: int,
    transaction_amount: float,
    transaction_type: str = 'deposit'
) -> float:
    """حساب العمولة"""
    affiliate = await session.get(Affiliate, affiliate_id)
    
    if not affiliate or affiliate.status != AffiliateStatus.ACTIVE:
        return 0.0
    
    # معدل العمولة حسب النوع
    if transaction_type == 'deposit':
        base_rate = 2.0
    elif transaction_type == 'withdraw':
        base_rate = 1.0
    else:
        return 0.0
    
    # حساب العمولة
    if affiliate.commission_type == CommissionType.PERCENTAGE:
        commission = (transaction_amount * affiliate.commission_rate) / 100
    else:
        commission = affiliate.commission_rate
    
    return commission
