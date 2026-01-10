# 🎮 معمارية نظام الألعاب المتكامل - LangSense

## 📋 تحليل الوضع الحالي

### ما هو موجود (Flying Plane Game):
- ✅ لعبة Flying Plane أساسية في `handlers/flying_plane_game.py`
- ✅ تخزين CSV بسيط في `data/games.csv`
- ✅ GamesService أساسي
- ⚠️ **لا يوجد**: أمان كامل، توقيع رقمي، GameSession صحيح، إدارة الرصيد الآمن

### ما هو ناقص (يجب إضافته):
- ❌ نظام GameSession مُحكم مع توقيع رقمي
- ❌ منع التلاعب المالي
- ❌ نظام الشكاوى/الإيداع/السحب مع رفع الصور
- ❌ لوحة تحكم كاملة لإدارة الألعاب
- ❌ دعم الألعاب الخارجية مع webhook آمن
- ❌ تكامل مع نظام الإشعارات

---

## 🏗️ التصميم المعماري

### 1️⃣ نماذج البيانات (Database Models)

```python
# في models.py

class GameType(str, PyEnum):
    INTERNAL = "internal"    # ألعاب داخلية (Flying Plane)
    EXTERNAL = "external"    # ألعاب خارجية (iframe/API)

class GameStatus(str, PyEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
    MAINTENANCE = "maintenance"
    TESTING = "testing"

class GameOutcome(str, PyEnum):
    WIN = "win"
    LOSE = "lose"
    CANCELLED = "cancelled"
    PENDING = "pending"

class Game(Base):
    """لعبة - النموذج الرئيسي"""
    __tablename__ = 'games'
    
    id: int (PK)
    name: str (unique)
    description: str
    game_type: GameType
    game_launch_url: Optional[str]  # للألعاب الخارجية
    icon_path: str  # مسار الأيقونة (PNG/SVG/GIF)
    
    # حدود المبالغ
    min_bet_amount: Decimal
    max_bet_amount: Decimal
    
    # نسب الربح/الخسارة
    payout_min_percent: Decimal  # 50%
    payout_max_percent: Decimal  # 150%
    house_edge_percent: Decimal  # 5%
    
    # إعدادات اللعبة
    status: GameStatus
    is_featured: bool
    max_sessions_per_day: int
    
    # التكامل مع الإشعارات
    win_notification_threshold: Decimal  # إرسال إشعار إذا الربح > X
    
    created_at, updated_at
    created_by_admin_id

class GameSession(Base):
    """جلسة لعب - القلب الأمني للنظام"""
    __tablename__ = 'game_sessions'
    
    id: int (PK)
    session_id: str (unique, indexed) # UUID
    
    player_id: int (FK → users.id)
    game_id: int (FK → games.id)
    
    bet_amount: Decimal  # المبلغ المخصوم
    start_time: datetime
    end_time: Optional[datetime]
    
    outcome: GameOutcome
    win_amount: Decimal  # 0 إذا خسارة
    profit_loss: Decimal  # + للربح، - للخسارة
    
    # 🔐 التوقيع الرقمي والأمان
    session_token: str  # JWT/HMAC token
    signature: str  # HMAC لمنع التلاعب
    
    # بيانات اللعب (JSON)
    game_data: dict  # {score, time_steps, etc.}
    
    # للألعاب الخارجية
    external_game_session_id: Optional[str]
    webhook_received: bool
    
    # الحماية من التكرار
    idempotency_key: str (unique)
    
    # التتبع
    ip_address: Optional[str]
    user_agent: Optional[str]
    
    created_at, updated_at

class GamePlayerOverride(Base):
    """تجاوزات خاصة للاعب (VIP/Testing)"""
    __tablename__ = 'game_player_overrides'
    
    id: int (PK)
    player_id: int (FK → users.id)
    game_id: int (FK → games.id)
    
    # تجاوزات
    custom_min_bet: Optional[Decimal]
    custom_max_bet: Optional[Decimal]
    custom_payout_percent: Optional[Decimal]
    max_sessions_override: Optional[int]
    
    is_active: bool
    created_at, expires_at

class TicketType(str, PyEnum):
    COMPLAINT = "complaint"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    SUPPORT = "support"
    GAME_ISSUE = "game_issue"

class TicketStatus(str, PyEnum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

class Ticket(Base):
    """تذاكر الدعم / الشكاوى / الإيداع / السحب"""
    __tablename__ = 'tickets'
    
    id: int (PK)
    ticket_number: str (unique)  # AUTO_TICKET_001
    
    user_id: int (FK → users.id)
    ticket_type: TicketType
    status: TicketStatus
    
    # المحتوى
    subject: str
    description: text
    amount: Optional[Decimal]  # للإيداع/السحب
    
    # مسار الصور المرفقة (JSON list)
    attachments: list[str]  # ['uploads/tickets/123_proof.jpg']
    
    # الرد
    admin_response: Optional[str]
    responded_by_admin_id: Optional[int]
    responded_at: Optional[datetime]
    
    created_at, updated_at

class TicketAttachment(Base):
    """مرفقات الصور للتذاكر"""
    __tablename__ = 'ticket_attachments'
    
    id: int (PK)
    ticket_id: int (FK → tickets.id)
    
    file_path: str  # مسار الملف المخزن
    file_name: str  # الاسم الأصلي
    file_size: int  # بالبايتات
    mime_type: str  # image/jpeg, image/png
    
    uploaded_at: datetime
```

---

## 2️⃣ تدفق العمل (Workflow)

### A. بدء اللعب (Internal Game)
```
1. المستخدم يختار اللعبة ويحدد مبلغ الدخول
2. Backend يتحقق من:
   ✓ الرصيد كافٍ
   ✓ المبلغ ضمن الحدود
   ✓ اللعبة نشطة
3. Backend ينشئ GameSession:
   - يخصم bet_amount من الرصيد
   - ينشئ session_token (JWT مع expiry)
   - يحسب signature (HMAC)
4. اللعبة تبدأ
5. اللعبة ترسل النتيجة إلى Backend
6. Backend يتحقق من signature
7. Backend يُحدّث الرصيد:
   - إذا فوز: رصيد + win_amount
   - إذا خسارة: لا شيء (المبلغ مخصوم مسبقًا)
8. Backend يسجل في AuditLog
9. إرسال إشعار إذا ربح كبير
```

### B. بدء اللعب (External Game)
```
1-3. نفس الخطوات السابقة
4. Backend يُنشئ launch_url مع token:
   https://external-game.com/play?token=JWT_TOKEN
5. اللعبة الخارجية تفك JWT للحصول على session_id
6. اللعبة تُنفذ وترسل النتيجة عبر Webhook:
   POST /api/v1/games/webhook/result
   {
     "session_id": "...",
     "outcome": "win",
     "win_amount": 1500.00,
     "signature": "HMAC..."
   }
7. Backend يتحقق من signature
8-9. نفس الخطوات السابقة
```

---

## 3️⃣ الأمان والحماية

### التوقيع الرقمي (Digital Signature)
```python
import hmac
import hashlib
import secrets

SECRET_KEY = settings.GAME_SESSION_SECRET_KEY

def create_session_signature(session_id: str, player_id: int, bet_amount: Decimal) -> str:
    """إنشاء توقيع للجلسة"""
    message = f"{session_id}|{player_id}|{bet_amount}|{datetime.utcnow().isoformat()}"
    return hmac.new(
        SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

def verify_signature(session_id: str, signature: str) -> bool:
    """التحقق من صحة التوقيع"""
    session = get_session(session_id)
    expected = create_session_signature(
        session.session_id,
        session.player_id,
        session.bet_amount
    )
    return hmac.compare_digest(expected, signature)
```

### منع التلاعب
- ✅ كل session له idempotency_key فريد
- ✅ التوقيع الرقمي لكل نتيجة
- ✅ session_token ينتهي بعد 30 دقيقة
- ✅ لا يمكن إعادة استخدام نفس session
- ✅ Rate limiting: 10 جلسات/دقيقة
- ✅ Audit log لكل عملية

---

## 4️⃣ الخدمات (Services)

### GamingService
```python
class GamingService:
    async def start_game_session(
        user_id: int,
        game_id: int,
        bet_amount: Decimal
    ) -> GameSession
    
    async def end_game_session(
        session_id: str,
        outcome: GameOutcome,
        win_amount: Decimal,
        signature: str
    ) -> GameSession
    
    async def validate_game_result(
        session: GameSession,
        outcome: dict,
        signature: str
    ) -> bool
    
    async def calculate_payout(
        game: Game,
        bet_amount: Decimal,
        outcome: GameOutcome
    ) -> Decimal
```

### TicketService
```python
class TicketService:
    async def create_ticket(
        user_id: int,
        ticket_type: TicketType,
        subject: str,
        description: str,
        amount: Optional[Decimal],
        attachments: List[UploadFile]
    ) -> Ticket
    
    async def upload_attachment(
        ticket_id: int,
        file: UploadFile
    ) -> TicketAttachment
    
    async def respond_to_ticket(
        ticket_id: int,
        admin_id: int,
        response: str,
        new_status: TicketStatus
    ) -> Ticket
```

---

## 5️⃣ API Endpoints

```python
# ألعاب
POST   /api/v1/games                    # إنشاء لعبة جديدة (admin)
GET    /api/v1/games                    # قائمة الألعاب
GET    /api/v1/games/{id}               # تفاصيل لعبة
PUT    /api/v1/games/{id}               # تحديث لعبة (admin)
DELETE /api/v1/games/{id}               # حذف لعبة (admin)
POST   /api/v1/games/{id}/upload-icon  # رفع أيقونة (admin)

# جلسات اللعب
POST   /api/v1/game-sessions/start     # بدء جلسة
POST   /api/v1/game-sessions/end       # إنهاء جلسة
GET    /api/v1/game-sessions/my         # جلساتي
POST   /api/v1/games/webhook/result    # نتائج الألعاب الخارجية

# التذاكر
POST   /api/v1/tickets                  # إنشاء تذكرة
GET    /api/v1/tickets                  # قائمة التذاكر
GET    /api/v1/tickets/{id}             # تفاصيل تذكرة
POST   /api/v1/tickets/{id}/respond    # الرد على تذكرة (admin)
POST   /api/v1/tickets/{id}/attach     # رفع صورة للتذكرة
```

---

## 6️⃣ التكامل مع الإشعارات

```python
# في نهاية كل جلسة لعب
if outcome == GameOutcome.WIN and win_amount > game.win_notification_threshold:
    await notification_service.create_and_broadcast(
        user_id=player_id,
        title="🎉 فوز كبير!",
        body=f"تهانينا! ربحت {win_amount} SAR في لعبة {game.name}",
        notification_type=NotificationType.GAME_BIG_WIN,
        priority=NotificationPriority.HIGH,
        action_url=f"/games/{game_id}/session/{session_id}"
    )

# عند إنشاء تذكرة جديدة
await notification_service.create_and_broadcast(
    user_id=None,  # broadcast لكل الأدمن
    title="🎫 تذكرة جديدة",
    body=f"تذكرة {ticket_type} جديدة من {user.username}",
    notification_type=NotificationType.NEW_TICKET,
    priority=NotificationPriority.MEDIUM
)
```

---

## 7️⃣ خطة التنفيذ

### المرحلة 1: نماذج البيانات (يوم 1)
- ✅ إضافة Game, GameSession, Ticket إلى models.py
- ✅ Migration للجداول الجديدة
- ✅ Indexes وConstraints

### المرحلة 2: الخدمات الأساسية (يوم 2)
- ✅ GamingService مع التوقيع الرقمي
- ✅ TicketService مع رفع الصور
- ✅ تكامل مع Transaction وAuditLog

### المرحلة 3: API Endpoints (يوم 3)
- ✅ endpoints الألعاب
- ✅ endpoints الجلسات
- ✅ endpoints التذاكر
- ✅ RBAC permissions

### المرحلة 4: لوحة التحكم (يوم 4)
- ✅ إدارة الألعاب (CRUD)
- ✅ رفع الأيقونات
- ✅ إدارة التذاكر
- ✅ عرض الإحصائيات

### المرحلة 5: واجهة المستخدم (يوم 5)
- ✅ قائمة الألعاب مع الأيقونات
- ✅ صفحة اللعبة مع عرض الرصيد
- ✅ إنشاء تذاكر مع رفع الصور
- ✅ عرض تاريخ الجلسات

### المرحلة 6: التكامل والاختبار (يوم 6)
- ✅ تكامل مع نظام الإشعارات
- ✅ اختبارات الأمان
- ✅ اختبارات الأداء
- ✅ توثيق شامل

---

## 8️⃣ الأولويات الأمنية

### ⚠️ نقاط حرجة:
1. ✅ لا تعديل رصيد مباشر - فقط عبر Transaction
2. ✅ كل GameSession يجب أن يكون موقعًا رقميًا
3. ✅ webhook الخارجي يجب أن يُتحقق من signature
4. ✅ رفع الصور يجب أن يخضع لـ MIME validation
5. ✅ Rate limiting على كل endpoints
6. ✅ كل خطوة في AuditLog

### 🔐 معايير الأمان:
- JWT للـ external games مع expiry 30 دقيقة
- HMAC SHA-256 للتوقيع الرقمي
- Idempotency keys لمنع duplicate sessions
- IP tracking لكل session
- Double-spend protection
- Session expiry بعد 1 ساعة من البدء

---

**الهدف**: نظام ألعاب grade casino، آمن، قابل للتوسع، محمي من التلاعب، مُتكامل بالكامل مع الأنظمة الموجودة.

**التسليم**: 6 أيام، كود production-ready، توثيق شامل، اختبارات كاملة.
