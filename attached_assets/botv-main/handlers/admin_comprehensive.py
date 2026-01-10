#!/usr/bin/env python3
"""
Comprehensive Admin Handler - Complete Admin Control Panel
لوحة التحكم الشاملة للأدمن - متوافقة مع comprehensive_bot.py القديم
"""

import logging
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext

from services.i18n import get_text
from utils.auth import admin_required
from config import ADMIN_USER_IDS

logger = logging.getLogger(__name__)
router = Router()

def get_comprehensive_admin_keyboard():
    """لوحة مفاتيح الأدمن الشاملة - نسخة كاملة من comprehensive_bot.py"""
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text='📋 الطلبات المعلقة'),
                KeyboardButton(text='✅ طلبات مُوافقة')
            ],
            [
                KeyboardButton(text='👥 إدارة المستخدمين'),
                KeyboardButton(text='🔍 البحث')
            ],
            [
                KeyboardButton(text='💳 وسائل الدفع'),
                KeyboardButton(text='📊 الإحصائيات')
            ],
            [
                KeyboardButton(text='📊 تقرير Excel احترافي'),
                KeyboardButton(text='💾 نسخة احتياطية فورية')
            ],
            [
                KeyboardButton(text='📢 إرسال جماعي'),
                KeyboardButton(text='🚫 حظر مستخدم')
            ],
            [
                KeyboardButton(text='✅ إلغاء حظر'),
                KeyboardButton(text='📝 إضافة شركة')
            ],
            [
                KeyboardButton(text='⚙️ إدارة الشركات'),
                KeyboardButton(text='📍 إدارة العناوين')
            ],
            [
                KeyboardButton(text='🛠️ تعديل بيانات الدعم')
            ],
            [
                KeyboardButton(text='⚙️ إعدادات النظام'),
                KeyboardButton(text='📨 الشكاوى')
            ],
            [
                KeyboardButton(text='📋 نسخ أوامر سريعة'),
                KeyboardButton(text='📧 إرسال رسالة لعميل')
            ],
            [
                KeyboardButton(text='� إعادة تعيين النظام'),
                KeyboardButton(text='👥 إدارة الأدمن')
            ],
            [
                KeyboardButton(text='🏠 القائمة الرئيسية')
            ]
        ],
        resize_keyboard=True,
        one_time_keyboard=False
    )
    return keyboard

@router.message(Command("admin"))
@admin_required
async def show_comprehensive_admin_panel(message: Message, state: FSMContext):
    """عرض لوحة التحكم الشاملة"""
    admin_welcome = """🔧 لوحة تحكم الأدمن الشاملة

مرحباً بك في لوحة التحكم الشاملة
استخدم الأزرار أدناه للتنقل:

📋 الطلبات المعلقة - عرض الطلبات غير المعالجة
✅ طلبات مُوافقة - عرض الطلبات المقبولة
👥 إدارة المستخدمين - إدارة كاملة للمستخدمين
🔍 البحث - البحث في النظام
💳 وسائل الدفع - إدارة طرق الدفع
📊 الإحصائيات - إحصائيات شاملة
📊 تقرير Excel - تصدير بيانات Excel
💾 نسخة احتياطية - حفظ بيانات النظام
📢 إرسال جماعي - رسائل جماعية
🚫 حظر مستخدم - حظر مستخدمين
✅ إلغاء حظر - إلغاء حظر المستخدمين
📝 إضافة شركة - إضافة شركة دفع جديدة
⚙️ إدارة الشركات - تعديل الشركات
📍 إدارة العناوين - عناوين الصرافة
🛠️ تعديل بيانات الدعم - بيانات التواصل
⚙️ إعدادات النظام - إعدادات متقدمة
📨 الشكاوى - عرض شكاوى المستخدمين
📋 نسخ أوامر سريعة - أوامر جاهزة
📧 إرسال رسالة لعميل - رسالة مباشرة
👥 إدارة الأدمن - إضافة/حذف أدمن"""

    await message.answer(
        admin_welcome,
        reply_markup=get_comprehensive_admin_keyboard()
    )
    await state.clear()

# ==================== معالجات الأزرار ====================

@router.message(F.text == '📋 الطلبات المعلقة')
@admin_required
async def show_pending_requests(message: Message, session_maker):
    """عرض الطلبات المعلقة"""
    async with session_maker() as session:
        from models import Outbox, OutboxStatus
        from sqlalchemy import select, func
        
        # جلب عدد الطلبات المعلقة
        pending_deposits = await session.scalar(
            select(func.count(Outbox.id))
            .where(Outbox.status == OutboxStatus.PENDING)
            .where(Outbox.type == 'deposit')
        )
        
        pending_withdrawals = await session.scalar(
            select(func.count(Outbox.id))
            .where(Outbox.status == OutboxStatus.PENDING)
            .where(Outbox.type == 'withdrawal')
        )
        
        text = f"""📋 الطلبات المعلقة

💰 طلبات الإيداع المعلقة: {pending_deposits}
💸 طلبات السحب المعلقة: {pending_withdrawals}
━━━━━━━━━━━━━━━━━━━━━━━━
📊 إجمالي الطلبات المعلقة: {pending_deposits + pending_withdrawals}

استخدم لوحة التحكم لمعالجة الطلبات"""
        
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '✅ طلبات مُوافقة')
@admin_required
async def show_approved_requests(message: Message, session_maker):
    """عرض الطلبات المُوافقة"""
    async with session_maker() as session:
        from models import Outbox, OutboxStatus
        from sqlalchemy import select, func
        
        approved_count = await session.scalar(
            select(func.count(Outbox.id))
            .where(Outbox.status == OutboxStatus.APPROVED)
        )
        
        text = f"""✅ الطلبات المُوافقة

📊 عدد الطلبات الموافقة: {approved_count}

استخدم لوحة التحكم لعرض التفاصيل"""
        
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '👥 إدارة المستخدمين')
@admin_required
async def manage_users(message: Message, session_maker):
    """إدارة المستخدمين"""
    async with session_maker() as session:
        from models import User
        from sqlalchemy import select, func
        
        total_users = await session.scalar(select(func.count(User.id)))
        active_users = await session.scalar(
            select(func.count(User.id)).where(User.is_active == True)
        )
        banned_users = await session.scalar(
            select(func.count(User.id)).where(User.is_banned == True)
        )
        
        text = f"""👥 إدارة المستخدمين

📊 إجمالي المستخدمين: {total_users}
✅ المستخدمون النشطون: {active_users}
🚫 المستخدمون المحظورون: {banned_users}

استخدم الأزرار للبحث وإدارة المستخدمين"""
        
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '🔍 البحث')
@admin_required
async def search_prompt(message: Message, state: FSMContext):
    """طلب البحث"""
    await message.answer(
        "🔍 البحث في النظام\n\nأرسل:\n• رقم العميل (C-2025-000001)\n• رقم الهاتف\n• الاسم",
        reply_markup=get_comprehensive_admin_keyboard()
    )

@router.message(F.text == '💳 وسائل الدفع')
@admin_required
async def payment_methods(message: Message):
    """عرض وسائل الدفع"""
    from services.legacy_service import legacy_service
    
    # الدالة ليست async - استخدمها مباشرة
    companies = legacy_service.get_companies()
    
    text = "💳 وسائل الدفع المتاحة:\n\n"
    if companies:
        for company in companies:
            status = "✅" if company.get('is_active') == 'active' else "❌"
            text += f"{status} {company['name']} - {company['type']}\n"
    else:
        text += "لا توجد وسائل دفع مسجلة حالياً."
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '📊 الإحصائيات')
@admin_required
async def show_statistics(message: Message, session_maker):
    """عرض الإحصائيات الشاملة"""
    async with session_maker() as session:
        from models import User, Outbox
        from sqlalchemy import select, func
        from decimal import Decimal
        
        # إحصائيات المستخدمين
        total_users = await session.scalar(select(func.count(User.id)))
        active_users = await session.scalar(
            select(func.count(User.id)).where(User.is_active == True)
        )
        
        # إحصائيات المعاملات
        total_transactions = await session.scalar(select(func.count(Outbox.id)))
        
        # إجمالي الإيداعات
        total_deposits = await session.scalar(
            select(func.sum(User.total_deposited))
        ) or Decimal('0')
        
        # إجمالي السحوبات
        total_withdrawals = await session.scalar(
            select(func.sum(User.total_withdrawn))
        ) or Decimal('0')
        
        text = f"""📊 الإحصائيات الشاملة

👥 المستخدمون:
━━━━━━━━━━━━━━━━
• إجمالي المستخدمين: {total_users}
• المستخدمون النشطون: {active_users}

💰 المعاملات المالية:
━━━━━━━━━━━━━━━━
• إجمالي المعاملات: {total_transactions}
• إجمالي الإيداعات: {total_deposits:,.2f} ر.س
• إجمالي السحوبات: {total_withdrawals:,.2f} ر.س

📈 الصافي: {(total_deposits - total_withdrawals):,.2f} ر.س"""
        
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '🏠 القائمة الرئيسية')
async def back_to_main_menu(message: Message, session_maker):
    """العودة للقائمة الرئيسية"""
    from handlers.start import show_main_menu, get_user_by_telegram_id
    
    async with session_maker() as session:
        user = await get_user_by_telegram_id(session, message.from_user.id)
        if user:
            await show_main_menu(message, user, session)

@router.message(F.text == '📊 تقرير Excel احترافي')
@admin_required
async def generate_excel_report(message: Message, session_maker):
    """توليد تقرير Excel احترافي"""
    async with session_maker() as session:
        from models import User, Outbox
        from sqlalchemy import select, func
        from decimal import Decimal
        import datetime
        
        # جمع الإحصائيات
        total_users = await session.scalar(select(func.count(User.id)))
        active_users = await session.scalar(
            select(func.count(User.id)).where(User.is_active == True)
        )
        total_transactions = await session.scalar(select(func.count(Outbox.id)))
        total_deposits = await session.scalar(
            select(func.sum(User.total_deposited))
        ) or Decimal('0')
        
        text = f"""📊 تقرير Excel احترافي

تاريخ التقرير: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}

━━━━━━━━━━━━━━━━━━━━━━━━━
📊 إحصائيات المستخدمين:
• إجمالي المستخدمين: {total_users}
• المستخدمون النشطون: {active_users}

💰 إحصائيات المالية:
• إجمالي المعاملات: {total_transactions}
• إجمالي الإيداعات: {total_deposits:,.2f} ر.س

✅ سيتم إرسال الملف قريباً"""
        
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '💾 نسخة احتياطية فورية')
@admin_required
async def manual_backup(message: Message):
    """إنشاء نسخة احتياطية فورية"""
    import shutil
    import datetime
    
    backup_name = f"backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    
    try:
        # إنشاء نسخة احتياطية من ملفات CSV
        shutil.make_archive(
            backup_name.replace('.zip', ''),
            'zip',
            '.',
            base_dir='.'
        )
        
        text = f"""💾 نسخة احتياطية فورية

✅ تم إنشاء النسخة الاحتياطية بنجاح
📁 اسم الملف: {backup_name}
🕒 التاريخ: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

✅ البيانات المحفوظة:
• ملفات CSV
• قاعدة البيانات
• جميع المعاملات"""
        
        await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())
    except Exception as e:
        await message.answer(
            f"❌ خطأ في النسخ الاحتياطي:\n{str(e)}",
            reply_markup=get_comprehensive_admin_keyboard()
        )

@router.message(F.text == '📢 إرسال جماعي')
@admin_required
async def broadcast_prompt(message: Message, state: FSMContext):
    """طلب الرسالة للبث الجماعي"""
    await message.answer(
        """📢 إرسال جماعي

أرسل الرسالة التي تريد إرسالها لجميع المستخدمين:
(يمكنك استخدام التنسيق والصور والرموز التعبيرية)

📝 ملاحظة: سيتم إرسال الرسالة لجميع المستخدمين النشطين""",
        reply_markup=get_comprehensive_admin_keyboard()
    )
    await state.set_state("waiting_broadcast_message")

@router.message(F.text.in_(['🚫 حظر مستخدم', '✅ إلغاء حظر']))
@admin_required
async def ban_unban_menu(message: Message, state: FSMContext):
    """قائمة الحظر/إلغاء الحظر"""
    if message.text == '🚫 حظر مستخدم':
        await message.answer(
            """🚫 حظر مستخدم

أرسل رقم العميل للحظر:
مثال: C-2025-000001

أو استخدم الأمر:
حظر C-2025-000001 سبب الحظر""",
            reply_markup=get_comprehensive_admin_keyboard()
        )
    else:
        await message.answer(
            """✅ إلغاء حظر

أرسل رقم العميل لإلغاء حظره:
مثال: C-2025-000001

أو استخدم الأمر:
الغاء_حظر C-2025-000001""",
            reply_markup=get_comprehensive_admin_keyboard()
        )

@router.message(F.text == '📝 إضافة شركة')
@admin_required
async def add_company_wizard(message: Message, state: FSMContext):
    """معالج إضافة شركة جديدة"""
    await message.answer(
        """📝 إضافة شركة جديدة

الرجاء إدخال بيانات الشركة:

1️⃣ اسم الشركة:""",
        reply_markup=get_comprehensive_admin_keyboard()
    )
    await state.set_state("adding_company_name")

@router.message(F.text == '⚙️ إدارة الشركات')
@admin_required
async def manage_companies(message: Message, session_maker):
    """إدارة الشركات"""
    from services.legacy_service import legacy_service
    
    companies = legacy_service.get_companies()
    
    text = "⚙️ إدارة الشركات\n\n"
    text += "قائمة الشركات المتاحة:\n\n"
    
    for i, company in enumerate(companies, 1):
        status = "✅ نشطة" if company.get('is_active') == 'active' else "❌ غير نشطة"
        text += f"{i}. {company['name']}\n"
        text += f"   النوع: {company['type']}\n"
        text += f"   الحالة: {status}\n"
        text += f"   التفاصيل: {company.get('details', 'N/A')}\n\n"
    
    text += "\n💡 استخدم الأوامر:\n"
    text += "📝 إضافة شركة\n"
    text += "تعديل [اسم_الشركة]\n"
    text += "حذف [اسم_الشركة]"
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '📍 إدارة العناوين')
@admin_required
async def manage_addresses(message: Message, session_maker):
    """إدارة عناوين الصرافة"""
    from services.legacy_service import legacy_service
    
    text = """📍 إدارة عناوين الصرافة

العناوين المتاحة:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 شارع الملك فهد، الرياض
📍 مقابل مول الرياض - الدور الأول
🕒 ساعات العمل: 9 صباحاً - 9 مساءً

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 للإضافة/التعديل:
تعديل_عنوان [العنوان_الجديد]"""
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '🛠️ تعديل بيانات الدعم')
@admin_required
async def edit_support_data(message: Message):
    """تعديل بيانات الدعم"""
    text = """🛠️ تعديل بيانات الدعم

البيانات الحالية:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 رقم الهاتف: +966501234567
💬 حساب التليجرام: @support_bot
📧 البريد الإلكتروني: support@dux.com
🕒 ساعات العمل: 9AM - 9PM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 للتعديل استخدم:
تعديل_هاتف [الرقم_الجديد]
تعديل_بريد [البريد_الجديد]
تعديل_ساعات [الساعات_الجديدة]"""
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '⚙️ إعدادات النظام')
@admin_required
async def system_settings(message: Message):
    """إعدادات النظام"""
    text = """⚙️ إعدادات النظام المتقدمة

⚙️ الإعدادات الحالية:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 الحد الأدنى للإيداع: 50 ر.س
💰 الحد الأدنى للسحب: 100 ر.س
💰 الحد الأقصى للسحب اليومي: 10,000 ر.س
🌐 العملة الافتراضية: الريال السعودي
🔔 تفعيل الإشعارات: نعم
🔐 وضع الأمان: عالي

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 لتعديل أي إعداد:
تعديل_حد_إيداع [المبلغ_الجديد]
تعديل_حد_سحب [المبلغ_الجديد]"""
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '📨 الشكاوى')
@admin_required
async def show_complaints(message: Message, session_maker):
    """عرض الشكاوى"""
    from services.legacy_service import legacy_service
    import csv
    
    text = "📨 الشكاوى المستقبلة\n\n"
    
    try:
        with open('complaints.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            complaints = list(reader)
        
        if complaints:
            pending = [c for c in complaints if c.get('status') != 'resolved']
            resolved = [c for c in complaints if c.get('status') == 'resolved']
            
            text += f"⏳ شكاوى معلقة: {len(pending)}\n"
            text += f"✅ شكاوى مُحلّة: {len(resolved)}\n"
            text += f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            
            for i, complaint in enumerate(pending[:5], 1):  # عرض أول 5 شكاوى
                text += f"{i}. من: {complaint.get('customer_id')}\n"
                text += f"   الرسالة: {complaint.get('message', 'N/A')[:50]}...\n"
                text += f"   التاريخ: {complaint.get('date', 'N/A')}\n\n"
        else:
            text += "✅ لا توجد شكاوى حتى الآن!"
    except:
        text += "⚠️ لم يتم العثور على ملف الشكاوى"
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '📋 نسخ أوامر سريعة')
@admin_required
async def quick_commands(message: Message):
    """عرض الأوامر السريعة"""
    text = """📋 نسخ أوامر سريعة

✅ الأوامر المتاحة:

1️⃣ الموافقة على طلب:
   موافقة DEP123456

2️⃣ رفض طلب:
   رفض DEP123456 السبب

3️⃣ البحث عن عميل:
   بحث C-2025-000001

4️⃣ حظر مستخدم:
   حظر C-2025-000001 السبب

5️⃣ إلغاء حظر:
   الغاء_حظر C-2025-000001

6️⃣ عرض معرف الحساب:
   /myid

7️⃣ عرض الإحصائيات:
   احصائيات

💡 يمكنك نسخ أي أمر واستخدامه مباشرة!"""
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

@router.message(F.text == '📧 إرسال رسالة لعميل')
@admin_required
async def send_user_message(message: Message, state: FSMContext):
    """إرسال رسالة مباشرة لعميل"""
    await message.answer(
        """📧 إرسال رسالة لعميل

أرسل رقم العميل المراد إرساله الرسالة:
مثال: C-2025-000001""",
        reply_markup=get_comprehensive_admin_keyboard()
    )
    await state.set_state("sending_message_customer_id")

@router.message(F.text == '🔄 إعادة تعيين النظام')
@admin_required
async def reset_system(message: Message):
    """إعادة تعيين النظام"""
    text = """🔄 إعادة تعيين النظام

⚠️ هذه العملية حساسة جداً!

تحذير:
- سيتم مسح بعض البيانات المؤقتة
- البيانات الأساسية ستبقى محفوظة
- سيتم إنشاء نسخة احتياطية تلقائياً

لتنفيذ الأمر:
رسالة النص "تأكيد_إعادة_تعيين"

💡 ملاحظة: هذه خطوة غير قابلة للتراجع"""
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())

# ==================== معالجات إضافية ====================

@router.message(F.text.startswith('موافقة'))
@admin_required
async def approve_transaction_command(message: Message, session_maker):
    """الموافقة على معاملة من النص"""
    words = message.text.split()
    trans_id = None
    for word in words:
        if word.startswith('DEP') or word.startswith('WTH'):
            trans_id = word
            break
    
    if trans_id:
        async with session_maker() as session:
            from models import Outbox, OutboxStatus
            from sqlalchemy import select
            
            result = await session.execute(
                select(Outbox).where(Outbox.id == trans_id)
            )
            transaction = result.scalar_one_or_none()
            
            if transaction:
                transaction.status = OutboxStatus.APPROVED
                await session.commit()
                await message.answer(
                    f"✅ تمت الموافقة على المعاملة {trans_id}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
            else:
                await message.answer(
                    f"❌ لم يتم العثور على المعاملة {trans_id}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
    else:
        await message.answer(
            "❌ لم يتم العثور على رقم المعاملة\n\nمثال: موافقة DEP123456",
            reply_markup=get_comprehensive_admin_keyboard()
        )

@router.message(F.text.startswith('رفض'))
@admin_required
async def reject_transaction_command(message: Message, session_maker):
    """رفض معاملة من النص"""
    words = message.text.split()
    trans_id = None
    reason_start = -1
    
    for i, word in enumerate(words):
        if word.startswith('DEP') or word.startswith('WTH'):
            trans_id = word
            reason_start = i + 1
            break
    
    if trans_id:
        reason = ' '.join(words[reason_start:]) if reason_start != -1 and reason_start < len(words) else 'غير محدد'
        
        async with session_maker() as session:
            from models import Outbox, OutboxStatus
            from sqlalchemy import select
            
            result = await session.execute(
                select(Outbox).where(Outbox.id == trans_id)
            )
            transaction = result.scalar_one_or_none()
            
            if transaction:
                transaction.status = OutboxStatus.REJECTED
                if not transaction.extra_data:
                    transaction.extra_data = {}
                transaction.extra_data['rejection_reason'] = reason
                await session.commit()
                
                await message.answer(
                    f"❌ تم رفض المعاملة {trans_id}\nالسبب: {reason}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
            else:
                await message.answer(
                    f"❌ لم يتم العثور على المعاملة {trans_id}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
    else:
        await message.answer(
            "❌ لم يتم العثور على رقم المعاملة\n\nمثال: رفض DEP123456 سبب الرفض",
            reply_markup=get_comprehensive_admin_keyboard()
        )

@router.message(F.text.startswith('بحث'))
@admin_required
async def search_command(message: Message, session_maker):
    """البحث في النظام"""
    query = message.text.replace('بحث ', '').strip()
    
    if not query:
        await message.answer(
            "❌ أرسل: بحث [رقم العميل/الهاتف/الاسم]",
            reply_markup=get_comprehensive_admin_keyboard()
        )
        return
    
    async with session_maker() as session:
        from models import User
        from sqlalchemy import select, or_
        
        # البحث في قاعدة البيانات
        result = await session.execute(
            select(User).where(
                or_(
                    User.customer_code.like(f"%{query}%"),
                    User.first_name.like(f"%{query}%"),
                    User.username.like(f"%{query}%")
                )
            ).limit(10)
        )
        users = result.scalars().all()
        
        if users:
            text = f"🔍 نتائج البحث عن: {query}\n\n"
            for user in users:
                phone = user.phone_encrypted.decode('utf-8') if user.phone_encrypted else 'غير محدد'
                text += f"👤 {user.first_name}\n"
                text += f"🆔 {user.customer_code}\n"
                text += f"📱 {phone}\n"
                text += f"━━━━━━━━━━━━━━━━━━\n"
            
            await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())
        else:
            # البحث في CSV إذا لم يتم العثور في قاعدة البيانات
            from services.legacy_service import legacy_service
            
            text = "🔍 البحث في ملفات CSV...\n\n"
            found = False
            
            import csv
            try:
                with open('users.csv', 'r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if (query in row.get('customer_id', '') or 
                            query in row.get('name', '') or 
                            query in row.get('phone', '')):
                            text += f"👤 {row['name']}\n"
                            text += f"🆔 {row['customer_id']}\n"
                            text += f"📱 {row['phone']}\n"
                            text += f"━━━━━━━━━━━━━━━━━━\n"
                            found = True
            except:
                pass
            
            if found:
                await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())
            else:
                await message.answer(
                    f"❌ لم يتم العثور على نتائج لـ: {query}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )

@router.message(F.text.startswith('حظر'))
@admin_required
async def ban_user_command(message: Message, session_maker):
    """حظر مستخدم"""
    parts = message.text.split(' ', 2)
    if len(parts) >= 3:
        customer_id = parts[1]
        reason = parts[2]
        
        async with session_maker() as session:
            from models import User
            from sqlalchemy import select
            
            result = await session.execute(
                select(User).where(User.customer_code == customer_id)
            )
            user = result.scalar_one_or_none()
            
            if user:
                user.is_banned = True
                await session.commit()
                
                await message.answer(
                    f"🚫 تم حظر المستخدم\n\n"
                    f"🆔 رقم العميل: {customer_id}\n"
                    f"📝 السبب: {reason}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
            else:
                await message.answer(
                    f"❌ لم يتم العثور على العميل: {customer_id}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
    else:
        await message.answer(
            "❌ الصيغة الصحيحة:\nحظر [رقم_العميل] [سبب_الحظر]\n\nمثال: حظر C-2025-000001 مخالفة الشروط",
            reply_markup=get_comprehensive_admin_keyboard()
        )

@router.message(F.text.startswith(('الغاء_حظر', 'الغاء حظر')))
@admin_required
async def unban_user_command(message: Message, session_maker):
    """إلغاء حظر مستخدم"""
    customer_id = message.text.replace('الغاء_حظر ', '').replace('الغاء حظر ', '').strip()
    
    if customer_id:
        async with session_maker() as session:
            from models import User
            from sqlalchemy import select
            
            result = await session.execute(
                select(User).where(User.customer_code == customer_id)
            )
            user = result.scalar_one_or_none()
            
            if user:
                user.is_banned = False
                await session.commit()
                
                await message.answer(
                    f"✅ تم إلغاء حظر المستخدم\n\n🆔 رقم العميل: {customer_id}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
            else:
                await message.answer(
                    f"❌ لم يتم العثور على العميل: {customer_id}",
                    reply_markup=get_comprehensive_admin_keyboard()
                )
    else:
        await message.answer(
            "❌ الصيغة الصحيحة:\nالغاء_حظر [رقم_العميل]\n\nمثال: الغاء_حظر C-2025-000001",
            reply_markup=get_comprehensive_admin_keyboard()
        )

@router.message(F.text == '👥 إدارة الأدمن')
@admin_required
async def manage_admins(message: Message, session_maker):
    """إدارة الأدمن والصلاحيات"""
    from config import ADMIN_USER_IDS
    
    text = "👥 إدارة الأدمن\n\n"
    text += f"📊 عدد الأدمن الحاليين: {len(ADMIN_USER_IDS)}\n\n"
    text += "قائمة الأدمن:\n"
    
    for i, admin_id in enumerate(ADMIN_USER_IDS, 1):
        text += f"{i}. معرف: {admin_id}\n"
    
    text += "\n💡 للإضافة/الحذف:\n"
    text += "إضافة_أدمن [معرف_المستخدم]\n"
    text += "حذف_أدمن [معرف_المستخدم]"
    
    await message.answer(text, reply_markup=get_comprehensive_admin_keyboard())
