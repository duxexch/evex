# 🚀 دليل التطبيق السريع

**ابدأ هنا:** خطة خطوة بخطوة لتطبيق الميزات المفقودة

---

## ⚡ البدء السريع (اليوم)

### خطوة 1: كود التحقق للسحب (3 ساعات) 🔴 حرج

#### الملفات المطلوب تعديلها:
- `handlers/financial_operations.py`
- `models.py` (اختياري)
- `utils/keyboards.py` (اختياري)

#### الخطوات:

**1.1 - إضافة State جديد**
```python
# في handlers/financial_operations.py

class WithdrawalFlow(StatesGroup):
    # موجود بالفعل:
    select_company = State()
    select_payment_method = State()
    enter_wallet_number = State()
    enter_amount = State()
    confirm_address = State()
    
    # إضافة هذا:
    enter_confirmation_code = State()  # ← جديد
    verify_code = State()               # ← جديد
```

**1.2 - إضافة دالة توليد الكود**
```python
import random

def generate_verification_code():
    """إنشاء كود تحقق عشوائي"""
    return str(random.randint(1000, 9999))  # 4 أرقام
```

**1.3 - إضافة معالج المرحلة**
```python
@router.message(WithdrawalFlow.enter_amount)
async def process_withdrawal_amount(message: Message, state: FSMContext, session_maker):
    """معالجة إدخال المبلغ والانتقال لطلب الكود"""
    
    # جزء موجود: التحقق من الحد الأدنى والأقصى
    amount = float(message.text)
    # ... تحقق من الحدود ...
    
    # إنشاء كود التحقق
    verification_code = generate_verification_code()
    
    # حفظ الكود في state
    data = await state.get_data()
    data['verification_code'] = verification_code
    data['verification_attempts'] = 3
    await state.update_data(data)
    
    # إرسال الكود للمستخدم
    message_text = f"""✅ تم حفظ المبلغ: {amount}

🔐 كود التحقق الخاص بك:
{verification_code}

⏰ هذا الكود صالح لمدة 5 دقائق فقط
⚠️ لا تشاركه مع أحد

أدخل الكود للمتابعة:"""
    
    await message.answer(message_text)
    
    # الانتقال للحالة التالية
    await state.set_state(WithdrawalFlow.enter_confirmation_code)
```

**1.4 - معالج التحقق من الكود**
```python
@router.message(WithdrawalFlow.enter_confirmation_code)
async def verify_code(message: Message, state: FSMContext, session_maker):
    """التحقق من كود المستخدم"""
    
    data = await state.get_data()
    correct_code = data.get('verification_code')
    attempts = data.get('verification_attempts', 3)
    
    if message.text == correct_code:
        # ✅ الكود صحيح
        await message.answer("✅ تم تحقق الكود بنجاح!")
        
        # حفظ المعاملة
        async with session_maker() as session:
            # ... إنشاء Outbox record ...
            pass
        
        # مسح الحالة والعودة للقائمة الرئيسية
        await state.clear()
        await message.answer("القائمة الرئيسية...", reply_markup=get_main_menu_keyboard())
        
    else:
        # ❌ الكود خاطئ
        attempts -= 1
        
        if attempts > 0:
            await message.answer(f"❌ كود خاطئ ({attempts} محاولات متبقية)")
            data['verification_attempts'] = attempts
            await state.update_data(data)
        else:
            # انتهت المحاولات
            await message.answer("❌ انتهت محاولات التحقق. تم إلغاء الطلب.")
            await state.clear()
            await message.answer("القائمة الرئيسية...", reply_markup=get_main_menu_keyboard())
```

**✅ نهاية الخطوة 1**

---

### خطوة 2: العناوين المحفوظة (2 ساعات) 🔴 حرج

#### الملفات المطلوب تعديلها:
- `models.py` - إضافة جدول جديد
- `handlers/financial_operations.py` - معالج الاختيار

#### الخطوات:

**2.1 - إضافة Model جديد في models.py**
```python
class WithdrawalAddress(Base):
    """جدول العناوين المحفوظة للسحب"""
    __tablename__ = 'withdrawal_addresses'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.telegram_id'))
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(100))  # مثل "المنزل", "العمل"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    
    user: Mapped['User'] = relationship('User', back_populates='withdrawal_addresses')
```

**2.2 - تحديث User Model (إضافة العلاقة)**
```python
class User(Base):
    # ... الحقول الموجودة ...
    
    # إضافة هذا:
    withdrawal_addresses: Mapped[list['WithdrawalAddress']] = relationship(
        'WithdrawalAddress',
        back_populates='user',
        cascade='all, delete-orphan'
    )
```

**2.3 - إضافة معالج الاختيار في handlers/financial_operations.py**
```python
@router.message(F.text.in_(['💸 طلب سحب', '💳 سحب']))
async def start_withdrawal_select_address(message: Message, state: FSMContext, session_maker):
    """بدء السحب - اختيار العنوان"""
    
    user_id = message.from_user.id
    
    async with session_maker() as session:
        # جلب العناوين المحفوظة
        stmt = select(WithdrawalAddress).filter(
            WithdrawalAddress.user_id == user_id,
            WithdrawalAddress.is_active == True
        )
        addresses = await session.scalars(stmt)
        addresses = addresses.all()
        
        text = "💳 اختر عنوان السحب:\n\n"
        buttons = []
        
        # عرض العناوين المحفوظة
        for addr in addresses:
            label = addr.label or f"العنوان {len(buttons) + 1}"
            button_text = f"✅ {label}"
            buttons.append([{'text': button_text}])
            text += f"✅ {label}\n{addr.address}\n\n"
        
        # خيار عنوان جديد
        buttons.append([{'text': '➕ عنوان جديد'}])
        buttons.append([{'text': '❌ إلغاء'}])
        
        reply_keyboard = {
            'keyboard': buttons,
            'resize_keyboard': True,
            'one_time_keyboard': True
        }
        
        await message.answer(text, reply_markup=reply_keyboard)
        await state.set_state(WithdrawalFlow.confirm_address)
```

**✅ نهاية الخطوة 2**

---

### خطوة 3: تغيير العملة (2 ساعات) 🔴 حرج

#### الملفات المطلوب تعديلها:
- `handlers/start.py` - إضافة خيار العملة
- `models.py` - حقل العملة (موجود بالفعل)
- `utils/keyboards.py` - لوحة المفاتيح

#### الخطوات:

**3.1 - إضافة دالة عرض العملات**
```python
# في handlers/start.py أو handlers/currency.py (ملف جديد)

CURRENCIES = {
    'SAR': {'name': 'الريال السعودي', 'symbol': '﷼', 'min_deposit': 50, 'max_deposit': 10000},
    'USD': {'name': 'الدولار الأمريكي', 'symbol': '$', 'min_deposit': 10, 'max_deposit': 2000},
    'EUR': {'name': 'اليورو', 'symbol': '€', 'min_deposit': 8, 'max_deposit': 1500},
    'AED': {'name': 'درهم الإمارات', 'symbol': 'د.إ', 'min_deposit': 180, 'max_deposit': 36000},
}

async def show_currency_selection(message: Message, session_maker):
    """عرض الخيارات المتاحة"""
    
    text = "💱 اختر عملتك المفضلة:\n\n"
    buttons = []
    
    for code, info in CURRENCIES.items():
        button_text = f"{info['symbol']} {info['name']}"
        buttons.append([{'text': button_text}])
        text += f"{info['symbol']} {code} - {info['name']}\n"
        text += f"   💰 من {info['min_deposit']} إلى {info['max_deposit']}\n\n"
    
    reply_keyboard = {
        'keyboard': buttons,
        'resize_keyboard': True,
        'one_time_keyboard': True
    }
    
    await message.answer(text, reply_markup=reply_keyboard)
```

**3.2 - معالج تحديث العملة**
```python
async def save_currency_preference(message: Message, session_maker):
    """حفظ تفضيل العملة"""
    
    user_id = message.from_user.id
    selected_text = message.text
    
    # البحث عن العملة
    selected_code = None
    for code, info in CURRENCIES.items():
        if selected_text == f"{info['symbol']} {info['name']}":
            selected_code = code
            break
    
    if not selected_code:
        await message.answer("❌ عملة غير صحيحة")
        return
    
    # تحديث في قاعدة البيانات
    async with session_maker() as session:
        user = await session.get(User, user_id)
        if user:
            user.currency_code = selected_code
            await session.commit()
    
    # إرسال تأكيد
    info = CURRENCIES[selected_code]
    text = f"""✅ تم تحديث العملة بنجاح!

💰 العملة الجديدة: {info['name']}
🔣 الرمز: {info['symbol']}

💡 الحدود الجديدة:
   أقل إيداع: {info['min_deposit']} {info['symbol']}
   أقصى إيداع: {info['max_deposit']} {info['symbol']}

تم تطبيق على جميع معاملاتك."""
    
    await message.answer(text, reply_markup=get_main_menu_keyboard())
```

**✅ نهاية الخطوة 3**

---

### خطوة 4: تحسين الإشعارات (1.5 ساعة) 🔴 حرج

#### المفهوم:
```python
# في كل عملية جديدة، أرسل إشعار للأدمن:

[عملية] → [إنشاء Outbox] → [إرسال إشعار للأدمن]

مثال:
[إيداع جديد] → [DEP123456] → [📊 إشعار في Telegram]
```

#### التطبيق:
```python
# في handlers/financial_operations.py

async def notify_admin_deposit(transaction_id, user, amount, company):
    """إشعار الأدمن بإيداع جديد"""
    
    message = f"""📊 إيداع جديد!

🆔 رقم المعاملة: {transaction_id}
👤 المستخدم: {user.first_name} ({user.customer_code})
💰 المبلغ: {amount} {user.currency_code}
🏢 الشركة: {company}
📅 الوقت: {datetime.now().strftime('%Y-%m-%d %H:%M')}

[✅ موافقة] [❌ رفض]"""
    
    # إرسال للأدمن
    for admin_id in ADMIN_USER_IDS:
        try:
            # استخدام bot API مباشر أو broadcast_service
            from services.broadcast_service import broadcast_service
            await broadcast_service.send_message(admin_id, message)
        except:
            pass
```

---

## 📅 جدول التطبيق

### اليوم (الآن)
```
⏰ 9:00 - 12:00   → تطبيق كود التحقق
⏰ 12:00 - 14:00  → تطبيق العناوين المحفوظة
⏰ 14:00 - 15:30  → تطبيق تغيير العملة
⏰ 15:30 - 17:00  → تحسين الإشعارات
⏰ 17:00 - 18:00  → اختبار شامل

✅ النتيجة: 4 ميزات حرجة مكتملة
```

### غداً
```
⏰ 9:00 - 10:00   → المرحلة 2 - بداية
⏰ ... عمل متوازي ...
⏰ 17:00 - 18:00  → اختبار شامل

✅ النتيجة: 4 ميزات مهمة مكتملة
```

---

## ✅ قائمة التحقق

### قبل البدء
- [ ] تأكد من وجود البيئة الصحيحة
- [ ] نسخ احتياطي من قاعدة البيانات
- [ ] قراءة الملفات ذات الصلة
- [ ] فهم الأكواد الموجودة

### أثناء التطبيق
- [ ] اختبر كل ميزة على حدة
- [ ] تحقق من معالجة الأخطاء
- [ ] تأكد من الرسائل الواضحة
- [ ] اختبر مع المستخدمين

### بعد التطبيق
- [ ] اختبار شامل
- [ ] اختبار الأدمن
- [ ] اختبار الحدود والحالات الحدية
- [ ] جمع الملاحظات

---

## 🎯 الهدف النهائي

**بعد 2.5 يوم من الآن:**
```
النسبة الحالية:  56% من الميزات
الهدف المستهدف: 90% من الميزات
─────────────────────────
النقص:          34% من الميزات

✅ بعد التطبيق: 90% من الميزات
🎉 نظام متطابق تماماً مع القديم!
```

---

**استعد للبدء الآن!** 🚀
