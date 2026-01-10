"""
معالج المحفظة - Wallet Handler
إدارة رصيد العميل والعمليات المالية
"""

from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import User, Wallet, WalletTransaction, CurrencyEnum
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = Router()


# ==================== HANDLERS ====================

@router.message(F.text.in_(['💰 رصيدي', '💰 محفظتي']))
async def show_wallet(message: Message, session_maker):
    """عرض رصيد المحفظة"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ لم يتم العثور على حسابك")
            return
        
        # جلب محافظ المستخدم
        stmt = select(Wallet).where(Wallet.user_id == user.id, Wallet.is_active == True)
        wallets = await session.scalars(stmt)
        wallets = list(wallets)
    
    if not wallets:
        await message.answer("📭 لا توجد محافظ نشطة")
        return
    
    # عرض المحافظ
    text = "💼 **محافظك:**\n\n"
    for wallet in wallets:
        text += f"""
💱 {wallet.currency.value}
├─ الرصيد: {wallet.balance:,.2f}
├─ مجمد: {wallet.frozen_amount:,.2f}
├─ الإيداعات: {wallet.total_deposited:,.2f}
├─ السحب: {wallet.total_withdrawn:,.2f}
└─ آخر تحديث: {wallet.updated_at.strftime('%d/%m %H:%M')}

"""
        
        # عرض الإجمالي
        total_balance = sum(w.balance for w in wallets)
        text += f"📊 **الإجمالي**: {total_balance:,.2f}\n"
        
        keyboard = [
            [KeyboardButton(text='📜 سجل المعاملات'), KeyboardButton(text='⚙️ إعدادات المحفظة')],
            [KeyboardButton(text='🏠 القائمة الرئيسية')],
        ]
        
        await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


@router.message(F.text == '📜 سجل المعاملات')
async def show_transaction_history(message: Message, session_maker):
    """عرض سجل المعاملات"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            return
        
        # جلب أحدث المعاملات
        stmt = select(WalletTransaction).where(
            WalletTransaction.wallet_id.in_(
                select(Wallet.id).where(Wallet.user_id == user.id)
            )
        ).order_by(WalletTransaction.created_at.desc()).limit(20)
        
        transactions = await session.scalars(stmt)
        transactions = list(transactions)
        
        if not transactions:
            await message.answer("📭 لا توجد معاملات")
            return
        
        text = "📜 **آخر 20 معاملة:**\n\n"
        
        type_icons = {
            'deposit': '⬇️',
            'withdraw': '⬆️',
            'commission': '📊',
            'refund': '↩️'
        }
        
        status_icons = {
            'completed': '✅',
            'pending': '⏳',
            'failed': '❌'
        }
        
        for txn in transactions:
            icon = type_icons.get(txn.type, '📌')
            status = status_icons.get(txn.status, '❓')
            
            text += f"{icon} {status} {txn.type}\n"
            text += f"├─ المبلغ: {txn.amount:,.2f}\n"
            text += f"├─ الوصف: {txn.description or 'بدون'}\n"
            text += f"└─ التاريخ: {txn.created_at.strftime('%d/%m %H:%M')}\n\n"
        
        await message.answer(text)


@router.message(F.text == '⚙️ إعدادات المحفظة')
async def wallet_settings(message: Message):
    """إعدادات المحفظة"""
    text = """⚙️ **إعدادات المحفظة**

📋 الخيارات المتاحة:
• لا يمكنك تغيير العملة مباشرة
• التواصل مع الدعم لتغيير العملة
• الأدمن فقط يستطيع تغيير عملتك

💬 للتواصل مع الدعم: اضغط الزر أدناه
"""
    
    keyboard = [
        [KeyboardButton(text='📞 تواصل مع الدعم')],
        [KeyboardButton(text='🏠 القائمة الرئيسية')],
    ]
    
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True))


# ==================== HELPER FUNCTIONS ====================

async def get_or_create_wallet(session: AsyncSession, user_id: int, currency: CurrencyEnum = CurrencyEnum.SAR) -> Wallet:
    """
    جلب أو إنشاء محفظة للمستخدم
    """
    stmt = select(Wallet).where(
        (Wallet.user_id == user_id) & (Wallet.currency == currency)
    )
    
    wallet = await session.scalar(stmt)
    
    if not wallet:
        wallet = Wallet(
            user_id=user_id,
            currency=currency,
            balance=0.0
        )
        session.add(wallet)
        await session.commit()
    
    return wallet


async def add_to_wallet(
    session: AsyncSession,
    user_id: int,
    amount: float,
    txn_type: str,
    currency: CurrencyEnum = CurrencyEnum.SAR,
    description: str = None,
    reference_id: str = None
) -> bool:
    """
    إضافة مبلغ للمحفظة
    """
    try:
        wallet = await get_or_create_wallet(session, user_id, currency)
        
        # تحديث الرصيد
        wallet.balance += amount
        wallet.updated_at = datetime.utcnow()
        
        # تسجيل المعاملة
        transaction = WalletTransaction(
            wallet_id=wallet.id,
            type=txn_type,
            amount=amount,
            description=description,
            reference_id=reference_id,
            status='completed'
        )
        
        session.add(transaction)
        await session.commit()
        
        logger.info(f"إضافة {amount} للمحفظة {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"خطأ في إضافة المبلغ: {e}")
        return False


async def deduct_from_wallet(
    session: AsyncSession,
    user_id: int,
    amount: float,
    txn_type: str,
    currency: CurrencyEnum = CurrencyEnum.SAR,
    description: str = None,
    reference_id: str = None
) -> bool:
    """
    طرح مبلغ من المحفظة
    """
    try:
        wallet = await get_or_create_wallet(session, user_id, currency)
        
        if wallet.balance < amount:
            logger.warning(f"رصيد غير كافي للمستخدم {user_id}")
            return False
        
        # تحديث الرصيد
        wallet.balance -= amount
        wallet.updated_at = datetime.utcnow()
        
        # تسجيل المعاملة
        transaction = WalletTransaction(
            wallet_id=wallet.id,
            type=txn_type,
            amount=-amount,
            description=description,
            reference_id=reference_id,
            status='completed'
        )
        
        session.add(transaction)
        await session.commit()
        
        logger.info(f"طرح {amount} من محفظة {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"خطأ في طرح المبلغ: {e}")
        return False
