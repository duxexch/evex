#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy Feature Handlers
========================
Aiogram handlers for comprehensive_bot.py legacy features:
- Deposit/Withdrawal system
- User registration
- Transaction tracking
- Multi-currency support
- Admin dashboard
"""

from aiogram import Router, F
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from services.legacy_service import legacy_service, PROTECTED_ADMIN_ID, PROTECTED_ADMIN_BALANCE
from services.i18n import get_text
import logging

router = Router()
logger = logging.getLogger(__name__)


# ==================== FSM STATES ====================

class RegistrationStates(StatesGroup):
    waiting_for_name = State()
    waiting_for_phone = State()


class DepositStates(StatesGroup):
    selecting_company = State()
    entering_wallet = State()
    entering_amount = State()


class WithdrawalStates(StatesGroup):
    entering_amount = State()
    entering_address = State()


class CurrencyStates(StatesGroup):
    selecting_currency = State()


# ==================== KEYBOARDS ====================

def main_keyboard(language='ar'):
    """Main menu keyboard"""
    if language == 'ar':
        buttons = [
            [KeyboardButton(text='💰 طلب إيداع'), KeyboardButton(text='💸 طلب سحب')],
            [KeyboardButton(text='📋 طلباتي'), KeyboardButton(text='👤 حسابي')],
            [KeyboardButton(text='📨 شكوى'), KeyboardButton(text='🆘 دعم')],
            [KeyboardButton(text='💱 تغيير العملة')]
        ]
    else:
        buttons = [
            [KeyboardButton(text='💰 Deposit'), KeyboardButton(text='💸 Withdraw')],
            [KeyboardButton(text='📋 My Requests'), KeyboardButton(text='👤 Profile')],
            [KeyboardButton(text='📨 Complaint'), KeyboardButton(text='🆘 Support')],
            [KeyboardButton(text='💱 Change Currency')]
        ]
    
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)


def companies_keyboard(companies, language='ar'):
    """Companies selection keyboard"""
    buttons = []
    for company in companies:
        buttons.append([KeyboardButton(text=f"🏢 {company['name']}")])
    
    cancel_text = '❌ إلغاء' if language == 'ar' else '❌ Cancel'
    buttons.append([KeyboardButton(text=cancel_text)])
    
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard=True)


def currency_keyboard():
    """Currency selection keyboard"""
    currencies = legacy_service.get_available_currencies()
    buttons = []
    
    # Group currencies in rows of 3
    row = []
    for curr in currencies:
        row.append(KeyboardButton(text=f"{curr['flag']} {curr['code']}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    
    if row:
        buttons.append(row)
    
    buttons.append([KeyboardButton(text='❌ إلغاء')])
    
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard=True)


# ==================== USER REGISTRATION ====================

@router.message(Command("register"))
async def cmd_register(message: Message, state: FSMContext):
    """Start registration process"""
    telegram_id = message.from_user.id
    
    # Check if already registered
    user = legacy_service.find_user(telegram_id)
    if user:
        await message.answer(
            f"✅ أنت مسجل بالفعل\n🆔 رقم العميل: {user['customer_id']}",
            reply_markup=main_keyboard(user.get('language', 'ar'))
        )
        return
    
    await message.answer(
        "📝 مرحباً بك في نظام DUX المالي!\n\nيرجى إرسال اسمك الكامل:",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(RegistrationStates.waiting_for_name)


@router.message(RegistrationStates.waiting_for_name)
async def process_name(message: Message, state: FSMContext):
    """Process user name"""
    name = message.text.strip()
    
    if len(name) < 2:
        await message.answer("❌ اسم قصير جداً. يرجى إدخال اسم صحيح:")
        return
    
    await state.update_data(name=name)
    await message.answer(
        f"✅ شكراً {name}\n\nالآن أرسل رقم هاتفك:",
        reply_markup=ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text='📱 مشاركة رقم الهاتف', request_contact=True)]],
            resize_keyboard=True,
            one_time_keyboard=True
        )
    )
    await state.set_state(RegistrationStates.waiting_for_phone)


@router.message(RegistrationStates.waiting_for_phone)
async def process_phone(message: Message, state: FSMContext):
    """Process phone number"""
    # Get phone from contact or text
    if message.contact:
        phone = message.contact.phone_number
    else:
        phone = message.text.strip()
    
    if len(phone) < 8:
        await message.answer("❌ رقم غير صحيح. يرجى إرسال رقم هاتف صحيح:")
        return
    
    # Get stored name
    data = await state.get_data()
    name = data.get('name')
    
    # Create user
    try:
        customer_id = await legacy_service.create_user(
            telegram_id=message.from_user.id,
            name=name,
            phone=phone,
            language='ar',
            currency='SAR'
        )
        
        await message.answer(
            f"✅ تم التسجيل بنجاح!\n\n"
            f"👤 الاسم: {name}\n"
            f"📞 الهاتف: {phone}\n"
            f"🆔 رقم العميل: {customer_id}\n\n"
            f"يمكنك الآن استخدام جميع خدمات النظام",
            reply_markup=main_keyboard('ar')
        )
        
        await state.clear()
        logger.info(f"Registered new user: {customer_id} ({name})")
    
    except Exception as e:
        logger.error(f"Registration error: {e}")
        await message.answer(
            "❌ حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى",
            reply_markup=main_keyboard('ar')
        )
        await state.clear()


# ==================== DEPOSIT FLOW ====================

@router.message(F.text.in_(['💰 طلب إيداع', '💰 Deposit']))
async def start_deposit(message: Message, state: FSMContext):
    """Start deposit request"""
    telegram_id = message.from_user.id
    
    # Check if registered
    user = legacy_service.find_user(telegram_id)
    if not user:
        await message.answer(
            "❌ يجب التسجيل أولاً\nاستخدم /register للتسجيل",
            reply_markup=main_keyboard('ar')
        )
        return
    
    # Get deposit companies
    companies = await legacy_service.get_companies('deposit')
    
    if not companies:
        await message.answer(
            "❌ لا توجد شركات متاحة حالياً للإيداع",
            reply_markup=main_keyboard(user.get('language', 'ar'))
        )
        return
    
    await state.update_data(companies=companies)
    await message.answer(
        "🏢 اختر الشركة للإيداع:",
        reply_markup=companies_keyboard(companies, user.get('language', 'ar'))
    )
    await state.set_state(DepositStates.selecting_company)


@router.message(DepositStates.selecting_company)
async def select_deposit_company(message: Message, state: FSMContext):
    """Select deposit company"""
    if message.text == '❌ إلغاء' or message.text == '❌ Cancel':
        user = legacy_service.find_user(message.from_user.id)
        await message.answer(
            "❌ تم إلغاء عملية الإيداع",
            reply_markup=main_keyboard(user.get('language', 'ar') if user else 'ar')
        )
        await state.clear()
        return
    
    # Extract company name from button text
    company_name = message.text.replace('🏢 ', '').strip()
    
    # Verify company exists
    data = await state.get_data()
    companies = data.get('companies', [])
    selected_company = None
    
    for company in companies:
        if company['name'] == company_name:
            selected_company = company
            break
    
    if not selected_company:
        await message.answer("❌ شركة غير صالحة. يرجى الاختيار من القائمة:")
        return
    
    await state.update_data(company=selected_company)
    await message.answer(
        f"✅ تم اختيار: {company_name}\n\n"
        f"📝 التفاصيل: {selected_company.get('details', 'غير متوفر')}\n\n"
        f"الآن أرسل رقم المحفظة/الحساب:",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(DepositStates.entering_wallet)


@router.message(DepositStates.entering_wallet)
async def enter_wallet_number(message: Message, state: FSMContext):
    """Enter wallet/account number"""
    wallet_number = message.text.strip()
    
    if len(wallet_number) < 3:
        await message.answer("❌ رقم قصير جداً. يرجى إدخال رقم صحيح:")
        return
    
    await state.update_data(wallet_number=wallet_number)
    await message.answer(
        f"✅ رقم المحفظة: {wallet_number}\n\n"
        f"الآن أرسل المبلغ المراد إيداعه:"
    )
    await state.set_state(DepositStates.entering_amount)


@router.message(DepositStates.entering_amount)
async def enter_deposit_amount(message: Message, state: FSMContext):
    """Enter deposit amount"""
    try:
        amount = float(message.text.strip())
        
        if amount <= 0:
            await message.answer("❌ المبلغ يجب أن يكون أكبر من صفر:")
            return
        
        min_deposit = float(await legacy_service.get_setting('min_deposit') or 50)
        if amount < min_deposit:
            await message.answer(f"❌ أقل مبلغ للإيداع: {min_deposit}")
            return
        
        # Get stored data
        data = await state.get_data()
        company = data.get('company')
        wallet_number = data.get('wallet_number')
        
        # Create deposit transaction
        user = legacy_service.find_user(message.from_user.id)
        trans_id = await legacy_service.create_deposit(
            telegram_id=message.from_user.id,
            amount=amount,
            company=company['name'],
            wallet_number=wallet_number
        )
        
        currency = user.get('currency', 'SAR')
        formatted_amount = legacy_service.format_amount(amount, currency)
        
        await message.answer(
            f"✅ تم إنشاء طلب الإيداع بنجاح!\n\n"
            f"🆔 رقم الطلب: {trans_id}\n"
            f"💰 المبلغ: {formatted_amount}\n"
            f"🏢 الشركة: {company['name']}\n"
            f"📱 رقم المحفظة: {wallet_number}\n\n"
            f"⏳ حالة الطلب: قيد المراجعة\n\n"
            f"سيتم إشعارك عند معالجة الطلب",
            reply_markup=main_keyboard(user.get('language', 'ar'))
        )
        
        await state.clear()
        logger.info(f"Deposit request created: {trans_id}")
    
    except ValueError:
        await message.answer("❌ يرجى إدخال رقم صحيح:")
    except Exception as e:
        logger.error(f"Deposit creation error: {e}")
        user = legacy_service.find_user(message.from_user.id)
        await message.answer(
            "❌ حدث خطأ. يرجى المحاولة مرة أخرى",
            reply_markup=main_keyboard(user.get('language', 'ar') if user else 'ar')
        )
        await state.clear()


# ==================== WITHDRAWAL FLOW ====================

@router.message(F.text.in_(['💸 طلب سحب', '💸 Withdraw']))
async def start_withdrawal(message: Message, state: FSMContext):
    """Start withdrawal request"""
    telegram_id = message.from_user.id
    
    # Check if registered
    user = legacy_service.find_user(telegram_id)
    if not user:
        await message.answer(
            "❌ يجب التسجيل أولاً\nاستخدم /register للتسجيل",
            reply_markup=main_keyboard('ar')
        )
        return
    
    # Check balance
    balance = await legacy_service.get_user_balance(telegram_id)
    currency = user.get('currency', 'SAR')
    formatted_balance = legacy_service.format_amount(balance, currency)
    
    if balance <= 0:
        await message.answer(
            f"❌ رصيدك الحالي: {formatted_balance}\n"
            f"لا يمكنك طلب سحب",
            reply_markup=main_keyboard(user.get('language', 'ar'))
        )
        return
    
    await message.answer(
        f"💰 رصيدك الحالي: {formatted_balance}\n\n"
        f"أرسل المبلغ المراد سحبه:",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(WithdrawalStates.entering_amount)


@router.message(WithdrawalStates.entering_amount)
async def enter_withdrawal_amount(message: Message, state: FSMContext):
    """Enter withdrawal amount"""
    telegram_id = message.from_user.id
    
    try:
        amount = float(message.text.strip())
        
        if amount <= 0:
            await message.answer("❌ المبلغ يجب أن يكون أكبر من صفر:")
            return
        
        min_withdrawal = float(await legacy_service.get_setting('min_withdrawal') or 100)
        if amount < min_withdrawal:
            await message.answer(f"❌ أقل مبلغ للسحب: {min_withdrawal}")
            return
        
        # Check balance
        balance = await legacy_service.get_user_balance(telegram_id)
        if amount > balance:
            user = legacy_service.find_user(telegram_id)
            currency = user.get('currency', 'SAR')
            formatted_balance = legacy_service.format_amount(balance, currency)
            await message.answer(f"❌ رصيدك غير كافٍ. الرصيد الحالي: {formatted_balance}")
            return
        
        await state.update_data(amount=amount)
        await message.answer(
            f"✅ المبلغ: {amount}\n\n"
            f"الآن أرسل عنوان الصرافة لاستلام المبلغ:"
        )
        await state.set_state(WithdrawalStates.entering_address)
    
    except ValueError:
        await message.answer("❌ يرجى إدخال رقم صحيح:")


@router.message(WithdrawalStates.entering_address)
async def enter_exchange_address(message: Message, state: FSMContext):
    """Enter exchange address"""
    address = message.text.strip()
    
    if len(address) < 5:
        await message.answer("❌ عنوان قصير جداً. يرجى إدخال عنوان كامل:")
        return
    
    # Get stored amount
    data = await state.get_data()
    amount = data.get('amount')
    
    # Create withdrawal transaction
    try:
        user = legacy_service.find_user(message.from_user.id)
        trans_id = await legacy_service.create_withdrawal(
            telegram_id=message.from_user.id,
            amount=amount,
            exchange_address=address
        )
        
        currency = user.get('currency', 'SAR')
        formatted_amount = legacy_service.format_amount(amount, currency)
        
        await message.answer(
            f"✅ تم إنشاء طلب السحب بنجاح!\n\n"
            f"🆔 رقم الطلب: {trans_id}\n"
            f"💰 المبلغ: {formatted_amount}\n"
            f"📍 عنوان الصرافة: {address}\n\n"
            f"⏳ حالة الطلب: قيد المراجعة\n\n"
            f"سيتم إشعارك عند معالجة الطلب",
            reply_markup=main_keyboard(user.get('language', 'ar'))
        )
        
        await state.clear()
        logger.info(f"Withdrawal request created: {trans_id}")
    
    except Exception as e:
        logger.error(f"Withdrawal creation error: {e}")
        user = legacy_service.find_user(message.from_user.id)
        await message.answer(
            "❌ حدث خطأ. يرجى المحاولة مرة أخرى",
            reply_markup=main_keyboard(user.get('language', 'ar') if user else 'ar')
        )
        await state.clear()


# ==================== MY REQUESTS ====================

@router.message(F.text.in_(['📋 طلباتي', '📋 My Requests']))
async def show_my_requests(message: Message):
    """Show user's transaction requests"""
    telegram_id = message.from_user.id
    
    # Check if registered
    user = legacy_service.find_user(telegram_id)
    if not user:
        await message.answer(
            "❌ يجب التسجيل أولاً\nاستخدم /register للتسجيل",
            reply_markup=main_keyboard('ar')
        )
        return
    
    # Get transactions
    transactions = await legacy_service.get_user_transactions(telegram_id)
    
    if not transactions:
        await message.answer(
            "📋 لا توجد طلبات",
            reply_markup=main_keyboard(user.get('language', 'ar'))
        )
        return
    
    currency = user.get('currency', 'SAR')
    response = "📋 طلباتي:\n\n"
    
    for trans in transactions:
        trans_id = trans['id']
        trans_type = '💰 إيداع' if trans['type'] == 'deposit' else '💸 سحب'
        amount = float(trans['amount'])
        formatted_amount = legacy_service.format_amount(amount, currency)
        status = trans['status']
        date = trans['date']
        
        status_emoji = {
            'pending': '⏳',
            'approved': '✅',
            'rejected': '❌'
        }.get(status, '❓')
        
        response += f"{trans_type} {formatted_amount}\n"
        response += f"🆔 {trans_id}\n"
        response += f"📅 {date}\n"
        response += f"{status_emoji} {status}\n\n"
    
    await message.answer(response, reply_markup=main_keyboard(user.get('language', 'ar')))


# ==================== PROFILE ====================

@router.message(F.text.in_(['👤 حسابي', '👤 Profile']))
async def show_profile(message: Message):
    """Show user profile"""
    telegram_id = message.from_user.id
    
    user = legacy_service.find_user(telegram_id)
    if not user:
        await message.answer(
            "❌ يجب التسجيل أولاً\nاستخدم /register للتسجيل",
            reply_markup=main_keyboard('ar')
        )
        return
    
    balance = await legacy_service.get_user_balance(telegram_id)
    currency = user.get('currency', 'SAR')
    formatted_balance = legacy_service.format_amount(balance, currency)
    
    # Admin balance protection message
    balance_note = ""
    if telegram_id == PROTECTED_ADMIN_ID:
        balance_note = f"\n\n⚠️ حساب أدمن محمي (الرصيد ثابت: {PROTECTED_ADMIN_BALANCE:,} SAR)"
    
    response = f"""👤 معلومات الحساب

🆔 رقم العميل: {user['customer_id']}
👤 الاسم: {user['name']}
📞 الهاتف: {user['phone']}
💰 الرصيد: {formatted_balance}
💱 العملة: {currency}
📅 تاريخ التسجيل: {user.get('date', 'غير متوفر')}{balance_note}"""
    
    await message.answer(response, reply_markup=main_keyboard(user.get('language', 'ar')))


# ==================== CURRENCY CHANGE ====================

@router.message(F.text.in_(['💱 تغيير العملة', '💱 Change Currency']))
async def start_currency_change(message: Message, state: FSMContext):
    """Start currency change"""
    telegram_id = message.from_user.id
    
    user = legacy_service.find_user(telegram_id)
    if not user:
        await message.answer(
            "❌ يجب التسجيل أولاً\nاستخدم /register للتسجيل",
            reply_markup=main_keyboard('ar')
        )
        return
    
    current_currency = user.get('currency', 'SAR')
    
    await message.answer(
        f"💱 العملة الحالية: {current_currency}\n\n"
        f"اختر العملة الجديدة:",
        reply_markup=currency_keyboard()
    )
    await state.set_state(CurrencyStates.selecting_currency)


@router.message(CurrencyStates.selecting_currency)
async def select_currency(message: Message, state: FSMContext):
    """Select new currency"""
    if message.text == '❌ إلغاء':
        user = legacy_service.find_user(message.from_user.id)
        await message.answer(
            "❌ تم إلغاء تغيير العملة",
            reply_markup=main_keyboard(user.get('language', 'ar') if user else 'ar')
        )
        await state.clear()
        return
    
    # Extract currency code from button text (e.g., "🇸🇦 SAR")
    parts = message.text.split()
    if len(parts) < 2:
        await message.answer("❌ عملة غير صالحة. يرجى الاختيار من القائمة:")
        return
    
    currency_code = parts[-1].strip().upper()
    
    # Verify currency exists
    currency_info = legacy_service.get_currency_info(currency_code)
    if not currency_info:
        await message.answer("❌ عملة غير صالحة. يرجى الاختيار من القائمة:")
        return
    
    # Update user currency
    success = await legacy_service.update_user_currency(message.from_user.id, currency_code)
    
    if success:
        await message.answer(
            f"✅ تم تغيير العملة إلى: {currency_info['flag']} {currency_code} - {currency_info['name']}",
            reply_markup=main_keyboard('ar')
        )
        logger.info(f"Currency changed for user {message.from_user.id} to {currency_code}")
    else:
        await message.answer(
            "❌ حدث خطأ أثناء تغيير العملة",
            reply_markup=main_keyboard('ar')
        )
    
    await state.clear()


# ==================== SUPPORT ====================

@router.message(F.text.in_(['🆘 دعم', '🆘 Support']))
async def show_support(message: Message):
    """Show support information"""
    support_phone = await legacy_service.get_setting('support_phone')
    company_name = await legacy_service.get_setting('company_name')
    
    user = legacy_service.find_user(message.from_user.id)
    
    response = f"""🆘 الدعم الفني

🏢 {company_name or 'DUX'}
📞 {support_phone or 'غير متوفر'}

يمكنك التواصل معنا في أي وقت"""
    
    await message.answer(
        response,
        reply_markup=main_keyboard(user.get('language', 'ar') if user else 'ar')
    )
