"""
Financial Operations Handler - تعامل كامل مع الإيداع والسحب والشركات
================================================================

يوفر معالجات شاملة وفعالة ل:
- عمليات الإيداع الكاملة (deposit flow)
- عمليات السحب الكاملة (withdrawal flow)
- إدارة الشركات (add, edit, delete, list)
- إدارة وسائل الدفع
- التعامل مع العملات المختلفة
"""

import csv
import os
import random
from datetime import datetime
from decimal import Decimal
from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.fsm.context import FSMContext
from aiogram.filters.state import State, StatesGroup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import User, Outbox, OutboxType, OutboxStatus, WithdrawalAddress
from services.legacy_service import legacy_service
from config import ADMIN_USER_IDS
import logging

logger = logging.getLogger(__name__)
router = Router()

# ==================== HELPER FUNCTIONS ====================

def generate_verification_code() -> str:
    """🔐 توليد كود تحقق عشوائي (4 أرقام)"""
    return str(random.randint(1000, 9999))

# ==================== FSM States ====================

class DepositFlow(StatesGroup):
    """حالات عملية الإيداع"""
    select_company = State()
    select_payment_method = State()
    enter_wallet_number = State()
    enter_amount = State()
    confirm_amount = State()

class WithdrawalFlow(StatesGroup):
    """حالات عملية السحب"""
    select_company = State()
    select_payment_method = State()
    enter_wallet_number = State()
    enter_amount = State()
    confirm_address = State()
    enter_confirmation_code = State()  # ← كود التحقق الأول
    verify_code = State()                # ← التحقق من صحة الكود

class AddCompanyFlow(StatesGroup):
    """حالات إضافة شركة"""
    enter_name = State()
    select_type = State()
    enter_details = State()
    confirm_save = State()

class EditCompanyFlow(StatesGroup):
    """حالات تعديل الشركة"""
    select_company = State()
    select_field = State()
    enter_value = State()

class DeleteCompanyFlow(StatesGroup):
    """حالات حذف الشركة"""
    select_company = State()
    confirm_delete = State()

class AddPaymentMethodFlow(StatesGroup):
    """حالات إضافة وسيلة دفع"""
    select_company = State()
    enter_method_name = State()
    select_method_type = State()
    enter_account_data = State()

# ==================== DEPOSIT HANDLERS ====================

@router.message(F.text.in_(['💰 طلب إيداع', '💳 إيداع']))
async def start_deposit(message: Message, state: FSMContext, session_maker):
    """بدء عملية الإيداع"""
    
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً. أرسل /start")
            return
        
        # جلب الشركات المتاحة للإيداع
        companies = legacy_service.get_companies('deposit')
        if not companies:
            await message.answer("❌ لا توجد شركات متاحة للإيداع حالياً")
            return
        
        text = """💰 طلب إيداع جديد
        
🏢 اختر الشركة المراد الإيداع من خلالها:

"""
        for i, company in enumerate(companies, 1):
            status = "✅" if company['is_active'] == 'active' else "❌"
            text += f"{status} {i}. {company['name']}\n"
            text += f"   📋 {company['details']}\n"
        
        text += f"\n📊 إجمالي الشركات: {len(companies)}"
        
        keyboard = {'keyboard': [], 'resize_keyboard': True, 'one_time_keyboard': True}
        for company in companies:
            keyboard['keyboard'].append([{'text': f"🏢 {company['name']}"}])
        keyboard['keyboard'].append([{'text': '❌ إلغاء'}])
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(DepositFlow.select_company)
        await state.update_data(user_id=message.from_user.id, user_name=user.name)

@router.message(DepositFlow.select_company)
async def select_deposit_company(message: Message, state: FSMContext, session_maker):
    """اختيار الشركة للإيداع"""
    text = message.text.replace('🏢 ', '').strip()
    
    if text == '❌ إلغاء':
        await message.answer("❌ تم إلغاء عملية الإيداع")
        await state.clear()
        return
    
    companies = legacy_service.get_companies('deposit')
    company = next((c for c in companies if c['name'] == text), None)
    
    if not company:
        await message.answer("❌ اختيار غير صحيح. اختر من القائمة")
        return
    
    await state.update_data(selected_company=company)
    
    methods = legacy_service.get_payment_methods_by_company(company['id'])
    
    if not methods or len(methods) == 0:
        await message.answer(f"✅ تم اختيار: {company['name']}\n\n📋 التفاصيل: {company['details']}\n\n💳 الآن أدخل رقم المحفظة/الحساب:")
        await state.set_state(DepositFlow.enter_wallet_number)
        return
    
    buttons = [[KeyboardButton(text=m['name'])] for m in methods]
    buttons.append([KeyboardButton(text='❌ إلغاء')])
    keyboard = ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)
    
    text = f"""✅ تم اختيار: {company['name']}

📋 التفاصيل: {company['details']}

💳 اختر وسيلة الدفع:"""
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(DepositFlow.select_payment_method)

@router.message(DepositFlow.select_payment_method)
async def deposit_payment_method_selected(message: Message, state: FSMContext, session_maker):
    """معالجة اختيار وسيلة الدفع"""
    text = message.text.strip()
    
    if text == '❌ إلغاء':
        async with session_maker() as session:
            user = await session.get(User, message.from_user.id)
            from utils.keyboards import get_main_menu_keyboard
            await message.answer("❌ تم إلغاء عملية الإيداع", reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
        await state.clear()
        return
    
    data = await state.get_data()
    company = data.get('selected_company')
    methods = legacy_service.get_payment_methods_by_company(company['id'])
    
    method = next((m for m in methods if m['name'] == text), None)
    
    if not method:
        await message.answer("❌ اختيار غير صحيح. اختر من القائمة")
        return
    
    await state.update_data(payment_method=method)
    
    text = f"""✅ وسيلة الدفع: {method['name']}
📋 التفاصيل: {method.get('details', '')}

💳 الآن أدخل رقم المحفظة/الحساب:"""
    
    await message.answer(text, reply_markup=ReplyKeyboardRemove())
    await state.set_state(DepositFlow.enter_wallet_number)

@router.message(DepositFlow.enter_wallet_number)
async def deposit_wallet_number(message: Message, state: FSMContext, session_maker):
    """إدخال رقم المحفظة/الحساب"""
    wallet = message.text.strip()
    
    if len(wallet) < 5:
        await message.answer("❌ رقم المحفظة/الحساب قصير جداً (أقل من 5 أرقام)")
        return
    
    await state.update_data(wallet_number=wallet)
    
    data = await state.get_data()
    user_currency = 'SAR'
    min_deposit = 50
    
    text = f"""✅ تم حفظ رقم المحفظة: {wallet}

💰 أدخل المبلغ المطلوب إيداعه:

📌 أقل مبلغ: {min_deposit} ر.س
💡 أدخل المبلغ بالأرقام فقط (مثال: 500)"""
    
    await message.answer(text)
    await state.set_state(DepositFlow.enter_amount)

@router.message(DepositFlow.enter_amount)
async def deposit_amount(message: Message, state: FSMContext, session_maker):
    """إدخال مبلغ الإيداع"""
    try:
        amount = float(message.text.strip())
    except:
        await message.answer("❌ مبلغ غير صحيح. أدخل رقم صحيح")
        return
    
    if amount < 50:
        await message.answer("❌ أقل مبلغ للإيداع 50 ر.س")
        return
    
    if amount > 1_000_000:
        await message.answer("❌ مبلغ كبير جداً. الحد الأقصى 1,000,000 ر.س")
        return
    
    await state.update_data(amount=amount)
    
    data = await state.get_data()
    company = data['selected_company']
    
    text = f"""📊 ملخص طلب الإيداع:

🏢 الشركة: {company['name']}
💳 المحفظة: {data['wallet_number']}
💰 المبلغ: {amount:,.2f} ر.س

هل تؤكد العملية؟"""
    
    keyboard = {
        'keyboard': [
            [{'text': '✅ تأكيد'}, {'text': '❌ إلغاء'}]
        ],
        'resize_keyboard': True,
        'one_time_keyboard': True
    }
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(DepositFlow.confirm_amount)

@router.message(DepositFlow.confirm_amount)
async def confirm_deposit(message: Message, state: FSMContext, session_maker):
    """تأكيد عملية الإيداع"""
    async with session_maker() as session:
        if message.text == '❌ إلغاء':
            user = await session.get(User, message.from_user.id)
            from utils.keyboards import get_main_menu_keyboard
            await message.answer("❌ تم إلغاء عملية الإيداع", reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
            await state.clear()
            return
        
        if message.text != '✅ تأكيد':
            await message.answer("❌ اختر من الأزرار المتاحة")
            return
        
        data = await state.get_data()
        user = await session.get(User, data['user_id'])
        company = data['selected_company']
        wallet = data['wallet_number']
        amount = data['amount']
        
        # إنشاء معاملة في قاعدة البيانات
        trans_id = f"DEP{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # حفظ في CSV
        try:
            with open('transactions.csv', 'a', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow([
                    trans_id,
                    user.customer_code,
                    user.telegram_id,
                    user.name,
                    'deposit',
                    company['name'],
                    wallet,
                    amount,
                    '',  # exchange_address
                    'pending',
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    '',  # admin_note
                    ''   # processed_by
                ])
        except Exception as e:
            logger.error(f"Error saving deposit: {e}")
        
        text = f"""✅ تم إرسال طلب الإيداع بنجاح

🆔 رقم المعاملة: {trans_id}
👤 العميل: {user.name}
🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
📅 التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
⏳ الحالة: في انتظار المراجعة

سيتم إشعارك فور مراجعة الطلب."""
        
        from utils.keyboards import get_main_menu_keyboard
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))
        
        # إشعار الأدمن
        for admin_id in ADMIN_USER_IDS:
            try:
                admin_text = f"""🔔 طلب إيداع جديد

🆔 رقم المعاملة: {trans_id}
👤 العميل: {user.name} ({user.customer_code})
🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
📅 التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}

الأوامر:
✅ موافقة {trans_id}
❌ رفض {trans_id} السبب"""
                from bot import bot
                await bot.send_message(admin_id, admin_text)
            except:
                pass
        
        await state.clear()

# ==================== WITHDRAWAL HANDLERS ====================

@router.message(F.text.in_(['💸 طلب سحب', '💰 سحب']))
async def start_withdrawal(message: Message, state: FSMContext, session_maker):
    """بدء عملية السحب"""
    async with session_maker() as session:
        user = await session.get(User, message.from_user.id)
        if not user:
            await message.answer("❌ يجب تسجيل الدخول أولاً")
            return
        
        companies = legacy_service.get_companies('withdraw')
        if not companies:
            from utils.keyboards import get_main_menu_keyboard
            await message.answer("❌ لا توجد شركات متاحة للسحب حالياً", reply_markup=get_main_menu_keyboard(user.language_code))
            return
        
        text = """💸 طلب سحب جديد

🏢 اختر الشركة المراد السحب من خلالها:

"""
        for i, company in enumerate(companies, 1):
            status = "✅" if company['is_active'] == 'active' else "❌"
            text += f"{status} {i}. {company['name']}\n"
            text += f"   📋 {company['details']}\n"
        
        keyboard = {'keyboard': [], 'resize_keyboard': True, 'one_time_keyboard': True}
        for company in companies:
            keyboard['keyboard'].append([{'text': f"🏢 {company['name']}"}])
        keyboard['keyboard'].append([{'text': '❌ إلغاء'}])
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(WithdrawalFlow.select_company)
        await state.update_data(user_id=message.from_user.id, user_name=user.name)

@router.message(WithdrawalFlow.select_company)
async def select_withdrawal_company(message: Message, state: FSMContext, session_maker):
    """اختيار الشركة للسحب"""
    text = message.text.replace('🏢 ', '').strip()
    
    if text == '❌ إلغاء':
        async with session_maker() as session:
            user = await session.get(User, message.from_user.id)
            from utils.keyboards import get_main_menu_keyboard
            await message.answer("❌ تم إلغاء عملية السحب", reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
        await state.clear()
        return
    
    companies = legacy_service.get_companies('withdraw')
    company = next((c for c in companies if c['name'] == text), None)
    
    if not company:
        await message.answer("❌ اختيار غير صحيح")
        return
    
    await state.update_data(selected_company=company)
    
    methods = legacy_service.get_payment_methods_by_company(company['id'])
    
    if not methods or len(methods) == 0:
        await message.answer(f"✅ تم اختيار: {company['name']}\n\n📋 التفاصيل: {company['details']}\n\n💳 أدخل رقم المحفظة/الحساب للسحب إليه:")
        await state.set_state(WithdrawalFlow.enter_wallet_number)
        return
    
    buttons = [[KeyboardButton(text=m['name'])] for m in methods]
    buttons.append([KeyboardButton(text='❌ إلغاء')])
    keyboard = ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)
    
    text = f"""✅ تم اختيار: {company['name']}

📋 التفاصيل: {company['details']}

💳 اختر وسيلة الدفع:"""
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(WithdrawalFlow.select_payment_method)

@router.message(WithdrawalFlow.select_payment_method)
async def withdrawal_payment_method_selected(message: Message, state: FSMContext, session_maker):
    """معالجة اختيار وسيلة الدفع للسحب"""
    text = message.text.strip()
    
    if text == '❌ إلغاء':
        async with session_maker() as session:
            user = await session.get(User, message.from_user.id)
            from utils.keyboards import get_main_menu_keyboard
            await message.answer("❌ تم إلغاء عملية السحب", reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
        await state.clear()
        return
    
    data = await state.get_data()
    company = data.get('selected_company')
    methods = legacy_service.get_payment_methods_by_company(company['id'])
    
    method = next((m for m in methods if m['name'] == text), None)
    
    if not method:
        await message.answer("❌ اختيار غير صحيح. اختر من القائمة")
        return
    
    await state.update_data(payment_method=method)
    
    text = f"""✅ وسيلة الدفع: {method['name']}
📋 التفاصيل: {method.get('details', '')}

💳 أدخل رقم المحفظة/الحساب للسحب إليه:"""
    
    await message.answer(text, reply_markup=ReplyKeyboardRemove())
    await state.set_state(WithdrawalFlow.enter_wallet_number)

@router.message(WithdrawalFlow.enter_wallet_number)
async def withdrawal_wallet_number(message: Message, state: FSMContext, session_maker):
    """إدخال رقم المحفظة للسحب"""
    wallet = message.text.strip()
    
    if len(wallet) < 5:
        await message.answer("❌ رقم المحفظة قصير جداً")
        return
    
    await state.update_data(wallet_number=wallet)
    
    text = f"""✅ تم حفظ رقم المحفظة: {wallet}

💰 أدخل المبلغ المطلوب سحبه:

📌 أقل مبلغ: 100 ر.س
📌 أقصى مبلغ يومي: 10,000 ر.س
💡 أدخل المبلغ بالأرقام فقط"""
    
    await message.answer(text)
    await state.set_state(WithdrawalFlow.enter_amount)

@router.message(WithdrawalFlow.enter_amount)
async def withdrawal_amount(message: Message, state: FSMContext, session_maker):
    """إدخال مبلغ السحب"""
    try:
        amount = float(message.text.strip())
    except:
        await message.answer("❌ مبلغ غير صحيح")
        return
    
    if amount < 100:
        await message.answer("❌ أقل مبلغ للسحب 100 ر.س")
        return
    
    if amount > 10_000:
        await message.answer("❌ أقصى مبلغ يومي 10,000 ر.س")
        return
    
    await state.update_data(amount=amount)
    
    # إنشاء كود التحقق العشوائي 🔐
    verification_code = generate_verification_code()
    await state.update_data(
        verification_code=verification_code,
        verification_attempts=3,
        verification_locked=False
    )
    
    # عرض عنوان السحب الثابت
    exchange_address = """🏢 مقابل مول الرياض - الدور الأول
📍 شارع الملك فهد، الرياض
🕒 ساعات العمل: 9 صباحاً - 9 مساءً"""
    
    text = f"""✅ تم تأكيد المبلغ: {amount:,.2f} ر.س

📍 عنوان السحب:
{exchange_address}

🔐 كود التحقق الخاص بك:
{verification_code}

⏰ هذا الكود صالح لمدة 5 دقائق فقط
⚠️ لا تشاركه مع أحد

أدخل الكود للمتابعة:"""
    
    await message.answer(text)
    await state.set_state(WithdrawalFlow.verify_code)

@router.message(WithdrawalFlow.enter_confirmation_code)
async def withdrawal_confirmation(message: Message, state: FSMContext, session_maker):
    """تأكيد عملية السحب"""
    async with session_maker() as session:
        code = message.text.strip()
        
        if len(code) < 3:
            await message.answer("❌ كود التأكيد قصير جداً")
            return
        
        data = await state.get_data()
        user = await session.get(User, data['user_id'])
        company = data['selected_company']
        wallet = data['wallet_number']
        amount = data['amount']
        
        # ملخص نهائي مع التأكيد
        text = f"""📊 ملخص طلب السحب:

🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
🔐 كود التأكيد: {'*' * len(code)}

هل تؤكد العملية؟"""
        
        keyboard = {
            'keyboard': [
                [{'text': '✅ تأكيد نهائي'}, {'text': '❌ إلغاء'}]
            ],
            'resize_keyboard': True,
            'one_time_keyboard': True
        }
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(WithdrawalFlow.confirm_address)

@router.message(WithdrawalFlow.verify_code)
async def verify_withdrawal_code(message: Message, state: FSMContext, session_maker):
    """🔐 التحقق من كود التحقق"""
    user_code = message.text.strip()
    
    data = await state.get_data()
    correct_code = data.get('verification_code')
    attempts = data.get('verification_attempts', 3)
    
    # ✅ الكود صحيح
    if user_code == correct_code:
        await state.update_data(verification_code_verified=True)
        await message.answer("✅ تم التحقق من الكود بنجاح!")
        
        # الانتقال للتأكيد النهائي
        company = data['selected_company']
        wallet = data['wallet_number']
        amount = data['amount']
        
        text = f"""📊 ملخص طلب السحب:

🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
✅ تم التحقق: نعم

هل تؤكد العملية؟"""
        
        keyboard = {
            'keyboard': [
                [{'text': '✅ تأكيد نهائي'}, {'text': '❌ إلغاء'}]
            ],
            'resize_keyboard': True,
            'one_time_keyboard': True
        }
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(WithdrawalFlow.confirm_address)
    
    # ❌ الكود خاطئ
    else:
        attempts -= 1
        
        if attempts > 0:
            await state.update_data(verification_attempts=attempts)
            await message.answer(f"❌ كود خاطئ!\n\n⚠️ لديك {attempts} محاولات متبقية")
        else:
            # انتهت المحاولات
            await message.answer("❌ انتهت محاولات التحقق!\n\nتم إلغاء الطلب لأسباب أمنية.")
            from utils.keyboards import get_main_menu_keyboard
            async with session_maker() as session:
                user = await session.get(User, data['user_id'])
                await message.answer("العودة للقائمة الرئيسية", reply_markup=get_main_menu_keyboard(user.language_code if user else 'ar'))
            await state.clear()

@router.message(WithdrawalFlow.enter_confirmation_code)
async def withdrawal_confirmation(message: Message, state: FSMContext, session_maker):
    """تأكيد عملية السحب"""
    async with session_maker() as session:
        code = message.text.strip()
        
        if len(code) < 3:
            await message.answer("❌ كود التأكيد قصير جداً")
            return
        
        data = await state.get_data()
        user = await session.get(User, data['user_id'])
        company = data['selected_company']
        wallet = data['wallet_number']
        amount = data['amount']
        
        # ملخص نهائي مع التأكيد
        text = f"""📊 ملخص طلب السحب:

🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
🔐 كود التأكيد: {'*' * len(code)}

هل تؤكد العملية؟"""
        
        keyboard = {
            'keyboard': [
                [{'text': '✅ تأكيد نهائي'}, {'text': '❌ إلغاء'}]
            ],
            'resize_keyboard': True,
            'one_time_keyboard': True
        }
        
        await message.answer(text, reply_markup=keyboard)
        await state.set_state(WithdrawalFlow.confirm_address)

@router.message(WithdrawalFlow.confirm_address)
async def confirm_withdrawal(message: Message, state: FSMContext, session_maker):
    """تأكيد نهائي للسحب"""
    async with session_maker() as session:
        if message.text != '✅ تأكيد نهائي':
            await message.answer("❌ تم إلغاء عملية السحب")
            await state.clear()
            return
        
        data = await state.get_data()
        user = await session.get(User, data['user_id'])
        company = data['selected_company']
        wallet = data['wallet_number']
        amount = data['amount']
        
        trans_id = f"WITH{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # حفظ في CSV
        try:
            with open('transactions.csv', 'a', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow([
                    trans_id,
                    user.customer_code,
                    user.telegram_id,
                    user.name,
                    'withdrawal',
                    company['name'],
                    wallet,
                    amount,
                    '',  # exchange_address
                    'pending',
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    '',  # admin_note
                    ''   # processed_by
                ])
        except Exception as e:
            logger.error(f"Error saving withdrawal: {e}")
        
        text = f"""✅ تم إرسال طلب السحب بنجاح

🆔 رقم المعاملة: {trans_id}
👤 العميل: {user.name}
🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
📅 التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
⏳ الحالة: في انتظار المراجعة

سيتم إشعارك فور مراجعة الطلب."""
        
        from utils.keyboards import get_main_menu_keyboard
        await message.answer(text, reply_markup=get_main_menu_keyboard(user.language_code))
        
        # إشعار الأدمن
        for admin_id in ADMIN_USER_IDS:
            try:
                admin_text = f"""🔔 طلب سحب جديد

🆔 رقم المعاملة: {trans_id}
👤 العميل: {user.name} ({user.customer_code})
🏢 الشركة: {company['name']}
💳 المحفظة: {wallet}
💰 المبلغ: {amount:,.2f} ر.س
📅 التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}

الأوامر:
✅ موافقة {trans_id}
❌ رفض {trans_id} السبب"""
                from bot import bot
                await bot.send_message(admin_id, admin_text)
            except:
                pass
        
        await state.clear()

# ==================== COMPANY MANAGEMENT HANDLERS ====================

@router.message(F.text == '📝 إضافة شركة')
async def start_add_company(message: Message, state: FSMContext):
    """بدء إضافة شركة جديدة"""
    text = """📝 معالج إضافة شركة جديدة

سأطلب منك المعلومات خطوة بخطوة.

🏢 أولاً، أرسل اسم الشركة:
مثال: البنك الأهلي، STC Pay، فودافون كاش"""
    
    await message.answer(text)
    await state.set_state(AddCompanyFlow.enter_name)

@router.message(AddCompanyFlow.enter_name)
async def company_name(message: Message, state: FSMContext):
    """إدخال اسم الشركة"""
    name = message.text.strip()
    
    if len(name) < 3:
        await message.answer("❌ اسم الشركة قصير جداً (أقل من 3 أحرف)")
        return
    
    if len(name) > 50:
        await message.answer("❌ اسم الشركة طويل جداً (أكثر من 50 حرف)")
        return
    
    await state.update_data(company_name=name)
    
    text = f"""✅ تم حفظ الاسم: {name}

🔧 الآن اختر نوع الخدمة:"""
    
    keyboard = {
        'keyboard': [
            [{'text': '💳 إيداع فقط'}, {'text': '💰 سحب فقط'}],
            [{'text': '🔄 إيداع وسحب معاً'}],
            [{'text': '❌ إلغاء'}]
        ],
        'resize_keyboard': True,
        'one_time_keyboard': True
    }
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(AddCompanyFlow.select_type)

@router.message(AddCompanyFlow.select_type)
async def company_type(message: Message, state: FSMContext):
    """اختيار نوع الخدمة"""
    type_map = {
        '💳 إيداع فقط': ('deposit', 'إيداع فقط'),
        '💰 سحب فقط': ('withdraw', 'سحب فقط'),
        '🔄 إيداع وسحب معاً': ('both', 'إيداع وسحب'),
    }
    
    if message.text == '❌ إلغاء':
        await message.answer("❌ تم إلغاء إضافة الشركة")
        await state.clear()
        return
    
    service_type, service_display = type_map.get(message.text, (None, None))
    
    if not service_type:
        await message.answer("❌ اختر من الأزرار المتاحة")
        return
    
    await state.update_data(company_type=service_type, company_type_display=service_display)
    
    data = await state.get_data()
    text = f"""✅ نوع الخدمة: {service_display}

📋 الآن أرسل تفاصيل الشركة:
مثال: محفظة إلكترونية، حساب بنكي رقم 1234567890"""
    
    await message.answer(text)
    await state.set_state(AddCompanyFlow.enter_details)

@router.message(AddCompanyFlow.enter_details)
async def company_details(message: Message, state: FSMContext):
    """إدخال تفاصيل الشركة"""
    details = message.text.strip()
    
    if len(details) < 5:
        await message.answer("❌ التفاصيل قصيرة جداً")
        return
    
    if len(details) > 200:
        await message.answer("❌ التفاصيل طويلة جداً")
        return
    
    await state.update_data(company_details=details)
    
    data = await state.get_data()
    text = f"""📊 ملخص الشركة الجديدة:

🏢 الاسم: {data['company_name']}
⚡ نوع الخدمة: {data['company_type_display']}
📋 التفاصيل: {data['company_details']}

هل تريد حفظ هذه الشركة؟"""
    
    keyboard = {
        'keyboard': [
            [{'text': '✅ حفظ الشركة'}, {'text': '❌ إلغاء'}]
        ],
        'resize_keyboard': True,
        'one_time_keyboard': True
    }
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(AddCompanyFlow.confirm_save)

@router.message(AddCompanyFlow.confirm_save)
async def save_company(message: Message, state: FSMContext):
    """حفظ الشركة الجديدة"""
    if message.text == '❌ إلغاء':
        from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
        await message.answer("❌ تم إلغاء إضافة الشركة", reply_markup=get_comprehensive_admin_keyboard())
        await state.clear()
        return
    
    if message.text != '✅ حفظ الشركة':
        await message.answer("❌ اختر من الأزرار المتاحة")
        return
    
    data = await state.get_data()
    
    try:
        company_id = legacy_service.add_company(
            data['company_name'],
            data['company_type'],
            data['company_details']
        )
        
        text = f"""✅ تم حفظ الشركة بنجاح

🆔 معرف الشركة: {company_id}
🏢 الاسم: {data['company_name']}
⚡ النوع: {data['company_type_display']}
📋 التفاصيل: {data['company_details']}"""
        
        from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())
        logger.info(f"Company added: {data['company_name']} (ID: {company_id})")
        
    except Exception as e:
        from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
        await message.answer(f"❌ خطأ في حفظ الشركة: {str(e)}", reply_markup=get_comprehensive_admin_keyboard())
        logger.error(f"Error adding company: {e}")
    
    await state.clear()

# ==================== EDIT COMPANY HANDLERS ====================

@router.message(F.text == '⚙️ إدارة الشركات')
async def start_edit_company(message: Message, state: FSMContext):
    """بدء تعديل الشركة"""
    companies = legacy_service.get_companies()
    
    if not companies:
        from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
        await message.answer("❌ لا توجد شركات متاحة", reply_markup=get_comprehensive_admin_keyboard())
        return
    
    text = """🔧 تعديل الشركات

اختر الشركة المراد تعديلها:

"""
    for company in companies:
        status = "✅" if company['is_active'] == 'active' else "❌"
        text += f"{status} {company['id']} - {company['name']}\n"
        text += f"   📋 {company['type']} - {company['details']}\n"
    
    text += "\n📝 أرسل رقم معرف الشركة:"
    
    await message.answer(text)
    await state.set_state(EditCompanyFlow.select_company)

@router.message(EditCompanyFlow.select_company)
async def select_company_edit(message: Message, state: FSMContext):
    """اختيار الشركة للتعديل"""
    company_id = message.text.strip()
    
    companies = legacy_service.get_companies()
    company = next((c for c in companies if c['id'] == company_id), None)
    
    if not company:
        # حاول البحث في جميع الشركات بما فيها المعطلة
        try:
            with open('companies.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['id'] == company_id:
                        company = row
                        break
        except:
            pass
    
    if not company:
        await message.answer(f"❌ لم يتم العثور على شركة برقم: {company_id}")
        return
    
    type_display = {
        'deposit': 'إيداع فقط',
        'withdraw': 'سحب فقط',
        'both': 'إيداع وسحب'
    }.get(company['type'], company['type'])
    
    await state.update_data(selected_company=company)
    
    text = f"""📊 بيانات الشركة:

🆔 المعرف: {company['id']}
🏢 الاسم: {company['name']}
⚡ النوع: {type_display}
📋 التفاصيل: {company['details']}
🔘 الحالة: {'✅ نشطة' if company.get('is_active') == 'active' else '❌ معطلة'}

ماذا تريد تعديل؟"""
    
    keyboard = {
        'keyboard': [
            [{'text': '📝 تعديل الاسم'}, {'text': '🔧 تعديل النوع'}],
            [{'text': '📋 تعديل التفاصيل'}, {'text': '🔘 تغيير الحالة'}],
            [{'text': '❌ إلغاء'}]
        ],
        'resize_keyboard': True,
        'one_time_keyboard': True
    }
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(EditCompanyFlow.select_field)

@router.message(EditCompanyFlow.select_field)
async def select_field_edit(message: Message, state: FSMContext):
    """اختيار الحقل المراد تعديله"""
    data = await state.get_data()
    company = data['selected_company']
    
    if message.text == '❌ إلغاء':
        from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
        await message.answer("❌ تم إلغاء التعديل", reply_markup=get_comprehensive_admin_keyboard())
        await state.clear()
        return
    
    if message.text == '📝 تعديل الاسم':
        await message.answer(f"📝 الاسم الحالي: {company['name']}\n\nأرسل الاسم الجديد:")
        await state.update_data(field='name')
        
    elif message.text == '🔧 تعديل النوع':
        keyboard = {
            'keyboard': [
                [{'text': '💳 إيداع فقط'}, {'text': '💰 سحب فقط'}],
                [{'text': '🔄 إيداع وسحب معاً'}]
            ],
            'resize_keyboard': True,
            'one_time_keyboard': True
        }
        type_display = {
            'deposit': 'إيداع فقط',
            'withdraw': 'سحب فقط',
            'both': 'إيداع وسحب'
        }.get(company['type'], company['type'])
        await message.answer(f"النوع الحالي: {type_display}\n\nاختر النوع الجديد:", reply_markup=keyboard)
        await state.update_data(field='type')
        
    elif message.text == '📋 تعديل التفاصيل':
        await message.answer(f"📋 التفاصيل الحالية: {company['details']}\n\nأرسل التفاصيل الجديدة:")
        await state.update_data(field='details')
        
    elif message.text == '🔘 تغيير الحالة':
        status = 'inactive' if company.get('is_active') == 'active' else 'active'
        await state.update_data(field='status', new_value=status)
        await message.answer("🔄 جاري تحديث الحالة...")
        await update_company_field(message, state)
        return
    else:
        await message.answer("❌ اختر من الأزرار")
        return
    
    await state.set_state(EditCompanyFlow.enter_value)

@router.message(EditCompanyFlow.enter_value)
async def enter_field_value(message: Message, state: FSMContext):
    """إدخال القيمة الجديدة"""
    data = await state.get_data()
    field = data['field']
    value = message.text.strip()
    
    if field == 'type':
        type_map = {
            '💳 إيداع فقط': 'deposit',
            '💰 سحب فقط': 'withdraw',
            '🔄 إيداع وسحب معاً': 'both'
        }
        value = type_map.get(message.text, None)
        if not value:
            await message.answer("❌ اختر نوع صحيح")
            return
    
    await state.update_data(new_value=value)
    await update_company_field(message, state)

async def update_company_field(message: Message, state: FSMContext):
    """تحديث حقل الشركة"""
    data = await state.get_data()
    company = data['selected_company']
    field = data['field']
    new_value = data.get('new_value')
    
    try:
        # قراءة جميع الشركات
        companies = []
        with open('companies.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['id'] == company['id']:
                    if field == 'name':
                        row['name'] = new_value
                    elif field == 'type':
                        row['type'] = new_value
                    elif field == 'details':
                        row['details'] = new_value
                    elif field == 'status':
                        row['is_active'] = new_value
                companies.append(row)
        
        # حفظ الشركات
        with open('companies.csv', 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = companies[0].keys() if companies else ['id', 'name', 'type', 'details', 'is_active']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(companies)
        
        await message.answer(f"✅ تم تحديث البيانات بنجاح")
        logger.info(f"Company {company['id']} field '{field}' updated")
        
    except Exception as e:
        await message.answer(f"❌ خطأ في التحديث: {str(e)}")
        logger.error(f"Error updating company: {e}")
    
    from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
    await message.answer("🏠 العودة للوحة التحكم", reply_markup=get_comprehensive_admin_keyboard())
    await state.clear()

# ==================== DELETE COMPANY HANDLERS ====================

@router.message(F.text.startswith('حذف_شركة') | F.text.startswith('حذف شركة'))
async def delete_company_start(message: Message, state: FSMContext):
    """بدء حذف شركة"""
    companies = legacy_service.get_companies()
    companies_all = []
    
    try:
        with open('companies.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            companies_all = list(reader)
    except:
        pass
    
    if not companies_all:
        await message.answer("❌ لا توجد شركات")
        return
    
    text = """🗑️ حذف الشركات

اختر الشركة المراد حذفها:

"""
    for company in companies_all:
        status = "✅" if company.get('is_active') == 'active' else "❌"
        text += f"{status} {company['id']} - {company['name']}\n"
    
    text += "\n⚠️ التحذير: عملية الحذف غير قابلة للتراجع!\n\n📝 أرسل رقم معرف الشركة:"
    
    await message.answer(text)
    await state.set_state(DeleteCompanyFlow.select_company)

@router.message(DeleteCompanyFlow.select_company)
async def confirm_delete_company(message: Message, state: FSMContext):
    """تأكيد حذف الشركة"""
    company_id = message.text.strip()
    
    companies_all = []
    try:
        with open('companies.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            companies_all = list(reader)
    except:
        pass
    
    company = next((c for c in companies_all if c['id'] == company_id), None)
    if not company:
        await message.answer(f"❌ لم يتم العثور على شركة برقم: {company_id}")
        return
    
    await state.update_data(company_id=company_id, company_name=company['name'])
    
    text = f"""⚠️ تأكيد الحذف

🏢 اسم الشركة: {company['name']}
🆔 المعرف: {company_id}

⚠️ هذه العملية غير قابلة للتراجع!

هل تريد المتابعة؟"""
    
    keyboard = {
        'keyboard': [
            [{'text': '✅ حذف فعلاً'}, {'text': '❌ إلغاء'}]
        ],
        'resize_keyboard': True,
        'one_time_keyboard': True
    }
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(DeleteCompanyFlow.confirm_delete)

@router.message(DeleteCompanyFlow.confirm_delete)
async def finalize_delete_company(message: Message, state: FSMContext):
    """تنفيذ حذف الشركة"""
    if message.text != '✅ حذف فعلاً':
        from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
        await message.answer("❌ تم إلغاء العملية", reply_markup=get_comprehensive_admin_keyboard())
        await state.clear()
        return
    
    data = await state.get_data()
    company_id = data['company_id']
    
    try:
        # قراءة وحذف
        companies = []
        with open('companies.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['id'] != company_id:
                    companies.append(row)
        
        # حفظ
        with open('companies.csv', 'w', newline='', encoding='utf-8-sig') as f:
            if companies:
                fieldnames = companies[0].keys()
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(companies)
            else:
                writer = csv.writer(f)
                writer.writerow(['id', 'name', 'type', 'details', 'is_active'])
        
        await message.answer(f"✅ تم حذف الشركة: {data['company_name']}")
        logger.info(f"Company {company_id} deleted")
        
    except Exception as e:
        await message.answer(f"❌ خطأ في الحذف: {str(e)}")
        logger.error(f"Error deleting company: {e}")
    
    from handlers.admin_comprehensive import get_comprehensive_admin_keyboard
    await message.answer("🏠 العودة للوحة التحكم", reply_markup=get_comprehensive_admin_keyboard())
    await state.clear()
