# 🎮 دليل البدء السريع - نظام الألعاب

## 🚀 التشغيل السريع

### 1. تحديث قاعدة البيانات

```bash
# إنشاء الجداول الجديدة
python -c "from database import init_db; import asyncio; asyncio.run(init_db())"
```

### 2. تثبيت التبعيات الإضافية

```bash
pip install python-magic-bin
```

### 3. إنشاء مجلد الرفع

```bash
mkdir -p /app/uploads/tickets
chmod 755 /app/uploads/tickets
```

### 4. إعادة تشغيل البوت

```bash
python bot_main.py
```

---

## 🎲 إنشاء لعبة جديدة (من Python Shell)

```python
import asyncio
from decimal import Decimal
from database import session_maker
from services.control_panel.gaming_service import GamingService
from models import GameType

async def create_demo_game():
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        game = await gaming_service.create_game(
            name="روليت السعادة",
            description="لعبة روليت مثيرة مع فرص ربح عالية!",
            game_type=GameType.INTERNAL,
            min_bet=Decimal("10.0"),
            max_bet=Decimal("1000.0"),
            payout_min=Decimal("150.0"),  # 150% عند الفوز الأدنى
            payout_max=Decimal("300.0"),  # 300% عند الفوز الأعلى
            house_edge=Decimal("2.5"),    # 2.5% للمنصة
            admin_id=YOUR_ADMIN_USER_ID,  # غيّر هذا
            icon_path="🎰"
        )
        
        print(f"✅ تم إنشاء اللعبة: {game.name} (ID: {game.id})")

# تشغيل
asyncio.run(create_demo_game())
```

---

## 📝 الأوامر المتاحة للمستخدمين

### الألعاب
- `/games` - عرض قائمة الألعاب المتاحة
- `/game_history` - عرض سجل ألعابك

### التذاكر
- `/ticket` - إنشاء تذكرة جديدة (اختيار النوع)
- `/complaint` - شكوى مباشرة
- `/deposit` - طلب إيداع
- `/withdraw` - طلب سحب
- `/my_tickets` - عرض تذاكرك

---

## 🎯 سيناريو تجريبي كامل

### 1. إنشاء لعبة تجريبية

```python
import asyncio
from decimal import Decimal
from database import session_maker
from services.control_panel.gaming_service import GamingService
from models import GameType

async def setup_demo():
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        # لعبة 1: روليت
        roulette = await gaming_service.create_game(
            name="روليت السعادة",
            description="ضع رهانك واختر رقمك المفضل!",
            game_type=GameType.INTERNAL,
            min_bet=Decimal("5.0"),
            max_bet=Decimal("500.0"),
            payout_min=Decimal("180.0"),
            payout_max=Decimal("250.0"),
            house_edge=Decimal("2.0"),
            admin_id=1,  # غيّر هذا
            icon_path="🎰"
        )
        
        # لعبة 2: بلاك جاك
        blackjack = await gaming_service.create_game(
            name="بلاك جاك",
            description="اقترب من 21 واربح!",
            game_type=GameType.INTERNAL,
            min_bet=Decimal("10.0"),
            max_bet=Decimal("1000.0"),
            payout_min=Decimal("150.0"),
            payout_max=Decimal("200.0"),
            house_edge=Decimal("1.5"),
            admin_id=1,
            icon_path="🃏"
        )
        
        # لعبة 3: سلوتس
        slots = await gaming_service.create_game(
            name="ماكينة الحظ",
            description="اسحب واربح الجائزة الكبرى!",
            game_type=GameType.INTERNAL,
            min_bet=Decimal("1.0"),
            max_bet=Decimal("100.0"),
            payout_min=Decimal("100.0"),
            payout_max=Decimal("500.0"),
            house_edge=Decimal("3.0"),
            admin_id=1,
            icon_path="🎰"
        )
        
        print("✅ تم إنشاء 3 ألعاب تجريبية!")
        print(f"1. {roulette.name} (ID: {roulette.id})")
        print(f"2. {blackjack.name} (ID: {blackjack.id})")
        print(f"3. {slots.name} (ID: {slots.id})")

asyncio.run(setup_demo())
```

### 2. إضافة رصيد تجريبي لمستخدم

```python
import asyncio
from decimal import Decimal
from sqlalchemy import select, update
from database import session_maker
from models import User

async def add_test_balance(user_id: int, amount: Decimal):
    async with session_maker() as session:
        # الحصول على المستخدم
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one()
        
        # إضافة الرصيد
        user.balance += amount
        
        await session.commit()
        print(f"✅ تم إضافة {amount} إلى رصيد المستخدم {user_id}")
        print(f"الرصيد الجديد: {user.balance}")

# إضافة 1000 للمستخدم
asyncio.run(add_test_balance(YOUR_USER_ID, Decimal("1000.0")))
```

### 3. اختبار اللعبة

**في Telegram Bot:**
1. أرسل `/games`
2. اختر "🎰 روليت السعادة"
3. سترى:
   - رصيدك الحالي
   - الحد الأدنى/الأقصى للرهان
   - أزرار رهان سريعة
4. اختر مبلغ الرهان (أو أدخل مبلغاً مخصصاً)
5. اختر النتيجة: ✅ فوز / ❌ خسارة
6. سترى النتيجة مع الرصيد الجديد

### 4. اختبار التذاكر

**في Telegram Bot:**
1. أرسل `/deposit`
2. أدخل عنوان: "طلب إيداع رصيد"
3. أدخل وصف: "أريد إيداع 500 في حسابي"
4. أدخل المبلغ: 500
5. ارفع صورة إيصال (اختياري)
6. اضغط "✅ إنهاء وإرسال التذكرة"
7. سترى رقم التذكرة والحالة

---

## 🔍 التحقق من النظام

### 1. التحقق من الجداول

```python
import asyncio
from sqlalchemy import select, func
from database import session_maker
from models import Game, GameSession, Ticket

async def check_tables():
    async with session_maker() as session:
        # عدد الألعاب
        games_count = await session.scalar(select(func.count(Game.id)))
        print(f"📊 عدد الألعاب: {games_count}")
        
        # عدد الجلسات
        sessions_count = await session.scalar(select(func.count(GameSession.id)))
        print(f"📊 عدد الجلسات: {sessions_count}")
        
        # عدد التذاكر
        tickets_count = await session.scalar(select(func.count(Ticket.id)))
        print(f"📊 عدد التذاكر: {tickets_count}")

asyncio.run(check_tables())
```

### 2. عرض إحصائيات لعبة

```python
import asyncio
from sqlalchemy import select
from database import session_maker
from models import Game

async def game_stats(game_id: int):
    async with session_maker() as session:
        result = await session.execute(select(Game).where(Game.id == game_id))
        game = result.scalar_one()
        
        print(f"\n🎮 {game.name}")
        print(f"📊 إجمالي الجلسات: {game.total_sessions}")
        print(f"💰 إجمالي الرهانات: {game.total_bet_amount}")
        print(f"🏆 إجمالي المكاسب: {game.total_win_amount}")
        print(f"📈 الربح الصافي: {game.total_bet_amount - game.total_win_amount}")

asyncio.run(game_stats(1))  # غيّر الرقم
```

---

## 🛠️ استكشاف الأخطاء

### خطأ: "Game not found"
- تأكد من وجود ألعاب نشطة في قاعدة البيانات
- تأكد من `status = ACTIVE`

### خطأ: "Insufficient balance"
- تحقق من رصيد المستخدم
- أضف رصيد تجريبي باستخدام السكريبت أعلاه

### خطأ: "Invalid file type"
- تأكد من رفع صور فقط (JPEG, PNG, GIF, WebP)
- تحقق من حجم الملف (أقل من 10MB)

### خطأ: "Session expired"
- الجلسات تنتهي بعد ساعة
- ابدأ جلسة جديدة

---

## 📞 الدعم والأسئلة

للأسئلة أو المشاكل، راجع:
- `GAMING_SYSTEM_IMPLEMENTATION_REPORT.md` - التقرير الشامل
- `GAMING_SYSTEM_ARCHITECTURE.md` - المعمار التقني
- الكود المصدري في `services/` و `handlers/`

---

**جاهز للعب! 🎮🎰🎲**
