"""
Balance and transactions handler
"""

from aiogram import Router, F
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession
from handlers.auth import get_user_by_id
from handlers.keyboards import get_main_menu_keyboard
from services.i18n_service import get_i18n_service
from sqlalchemy import select
from models import Transaction

router = Router()


@router.message(F.text.contains("الرصيد") | F.text.contains("Balance"))
async def show_balance(
    message: Message,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """Show user balance"""
    
    user = await get_user_by_id(session, message.from_user.id)
    
    if not user:
        await message.answer(i18n.get_text("error.user_not_found", user_language))
        return
    
    text = i18n.get_text("balance.current", user_language)
    text += "\n" + i18n.format_amount(user.balance, "SAR", user_language)
    text += "\n\n" + i18n.get_text("balance.total_deposited", user_language)
    text += "\n" + i18n.format_amount(user.total_deposited, "SAR", user_language)
    text += "\n\n" + i18n.get_text("balance.total_withdrawn", user_language)
    text += "\n" + i18n.format_amount(user.total_withdrawn, "SAR", user_language)
    
    keyboard = get_main_menu_keyboard(user_language)
    await message.answer(text, reply_markup=keyboard)


@router.message(F.text.contains("المعاملات") | F.text.contains("Transactions"))
async def show_transactions(
    message: Message,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """Show recent transactions"""
    
    user = await get_user_by_id(session, message.from_user.id)
    
    if not user:
        await message.answer(i18n.get_text("error.user_not_found", user_language))
        return
    
    # Get last 10 transactions
    result = await session.execute(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(10)
    )
    transactions = result.scalars().all()
    
    if not transactions:
        text = i18n.get_text("transactions.no_transactions", user_language)
        keyboard = get_main_menu_keyboard(user_language)
        await message.answer(text, reply_markup=keyboard)
        return
    
    text = i18n.get_text("transactions.recent", user_language)
    text += "\n" + "=" * 40 + "\n\n"
    
    for txn in transactions:
        txn_type = i18n.get_text("transaction.credit" if txn.type == "CREDIT" else "transaction.debit", user_language)
        text += f"#{txn.id} - {txn_type}\n"
        text += i18n.format_amount(txn.amount, "SAR", user_language)
        text += f"\n{i18n.format_date(txn.created_at, user_language, 'short')}\n"
        text += "-" * 40 + "\n"
    
    keyboard = get_main_menu_keyboard(user_language)
    await message.answer(text, reply_markup=keyboard)
