"""
Deposit handler with FSM
"""

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import StateFilter
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession
from handlers.auth import get_user_by_id
from handlers.keyboards import get_main_menu_keyboard, get_confirm_keyboard, get_cancel_keyboard
from handlers.states import DepositStates
from services.i18n_service import get_i18n_service
from decimal import Decimal
from config import MIN_DEPOSIT, MAX_DEPOSIT

router = Router()


@router.message(F.text.contains("إيداع") | F.text.contains("Deposit"), StateFilter(None))
async def start_deposit(
    message: Message,
    state: FSMContext,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """Start deposit process"""
    
    user = await get_user_by_id(session, message.from_user.id)
    
    if not user:
        await message.answer(i18n.get_text("error.user_not_found", user_language))
        return
    
    text = i18n.get_text("deposit.enter_amount", user_language)
    text += "\n" + i18n.get_text("financial.min_deposit", user_language)
    text += f": {i18n.format_amount(Decimal(str(MIN_DEPOSIT)), 'SAR', user_language)}\n"
    text += i18n.get_text("financial.max_deposit", user_language)
    text += f": {i18n.format_amount(Decimal(str(MAX_DEPOSIT)), 'SAR', user_language)}"
    
    keyboard = get_cancel_keyboard(user_language)
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(DepositStates.waiting_for_amount)
    await state.update_data(user_language=user_language)


@router.message(DepositStates.waiting_for_amount)
async def process_deposit_amount(
    message: Message,
    state: FSMContext,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """Process deposit amount input"""
    
    # Validate input
    try:
        amount = Decimal(message.text)
    except:
        text = i18n.get_text("error.invalid_amount", user_language)
        await message.answer(text)
        return
    
    # Validate amount
    if amount < Decimal(str(MIN_DEPOSIT)):
        text = i18n.get_text("error.deposit_too_small", user_language)
        text += f": {i18n.format_amount(Decimal(str(MIN_DEPOSIT)), 'SAR', user_language)}"
        await message.answer(text)
        return
    
    if amount > Decimal(str(MAX_DEPOSIT)):
        text = i18n.get_text("error.deposit_too_large", user_language)
        text += f": {i18n.format_amount(Decimal(str(MAX_DEPOSIT)), 'SAR', user_language)}"
        await message.answer(text)
        return
    
    # Store amount and ask for payment method
    await state.update_data(deposit_amount=str(amount))
    
    text = i18n.get_text("deposit.choose_method", user_language)
    
    # Create payment method keyboard
    methods_keyboard = get_payment_methods_keyboard(user_language)
    
    await message.answer(text, reply_markup=methods_keyboard)
    await state.set_state(DepositStates.waiting_for_method)


@router.callback_query(DepositStates.waiting_for_method)
async def process_payment_method(
    query: CallbackQuery,
    state: FSMContext,
    i18n: any,
    user_language: str,
):
    """Process payment method selection"""
    
    method = query.data.split("_")[1]
    
    await state.update_data(deposit_method=method)
    
    state_data = await state.get_data()
    amount = Decimal(state_data["deposit_amount"])
    
    text = i18n.get_text("deposit.confirm", user_language)
    text += "\n" + i18n.get_text("financial.amount", user_language)
    text += f": {i18n.format_amount(amount, 'SAR', user_language)}\n"
    text += i18n.get_text("deposit.method", user_language)
    text += f": {method}"
    
    keyboard = get_confirm_keyboard(user_language)
    
    await query.message.edit_text(text, reply_markup=keyboard)
    await query.answer()
    await state.set_state(DepositStates.waiting_for_confirmation)


@router.callback_query(DepositStates.waiting_for_confirmation, F.data == "confirm_yes")
async def confirm_deposit(
    query: CallbackQuery,
    state: FSMContext,
    session: AsyncSession,
    i18n: any,
    user_language: str,
):
    """Confirm and process deposit"""
    
    state_data = await state.get_data()
    amount = Decimal(state_data["deposit_amount"])
    method = state_data["deposit_method"]
    
    # TODO: Create deposit request in database (Outbox pattern)
    # This will be implemented with the financial service
    
    text = i18n.get_text("deposit.submitted", user_language)
    text += f"\n{i18n.get_text('financial.amount', user_language)}: {i18n.format_amount(amount, 'SAR', user_language)}"
    
    keyboard = get_main_menu_keyboard(user_language)
    
    await query.message.edit_text(text)
    await query.message.answer(i18n.get_text("deposit.wait_approval", user_language), reply_markup=keyboard)
    
    await state.clear()
    await query.answer()


@router.callback_query(F.data == "confirm_no")
async def cancel_deposit(
    query: CallbackQuery,
    state: FSMContext,
    i18n: any,
    user_language: str,
):
    """Cancel deposit operation"""
    
    text = i18n.get_text("operation_cancelled", user_language)
    keyboard = get_main_menu_keyboard(user_language)
    
    await query.message.edit_text(text)
    await query.message.answer("", reply_markup=keyboard)
    
    await state.clear()
    await query.answer()


def get_payment_methods_keyboard(language: str = "ar"):
    """Get payment methods keyboard"""
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🏦 تحويل بنكي" if language == "ar" else "🏦 Bank Transfer",
                    callback_data="method_bank"
                ),
                InlineKeyboardButton(
                    text="📱 محفظة" if language == "ar" else "📱 Wallet",
                    callback_data="method_wallet"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="💳 بطاقة ائتمان" if language == "ar" else "💳 Credit Card",
                    callback_data="method_card"
                ),
            ]
        ]
    )
