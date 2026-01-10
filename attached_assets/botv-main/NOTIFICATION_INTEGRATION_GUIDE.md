# دليل التكامل السريع - نظام الإشعارات

## 1. إعداد قاعدة البيانات

```bash
# تطبيق migration للجداول الجديدة
alembic upgrade head
```

## 2. تكامل الباكند

### 2.1 استيراد الخدمات

```python
from services.control_panel.notification_service import NotificationService
from services.control_panel.notification_events import NotificationEventHandler
from models import NotificationPriority, NotificationType
```

### 2.2 ربط الإشعارات بالعمليات الحرجة

#### في AgentService (عمولات الوكلاء):

```python
# في ملف: services/control_panel/agent_service.py

async def approve_commission(self, commission_id: int, approver_id: int) -> Commission:
    """Approve agent commission and send notification."""
    commission = await self.get_commission_by_id(commission_id)
    
    # Update commission state
    commission.state = CommissionState.APPROVED
    commission.approved_at = datetime.utcnow()
    commission.approved_by_id = approver_id
    
    await self.session.commit()
    await self.session.refresh(commission)
    
    # إرسال إشعار فوري
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_commission_approved(commission, approver_id)
    
    return commission


async def pay_commission(self, commission_id: int, payer_id: int) -> Commission:
    """Mark commission as paid and send notification."""
    commission = await self.get_commission_by_id(commission_id)
    
    commission.state = CommissionState.PAID
    commission.paid_at = datetime.utcnow()
    commission.paid_by_id = payer_id
    
    await self.session.commit()
    await self.session.refresh(commission)
    
    # إرسال إشعار فوري
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_commission_paid(commission, payer_id)
    
    return commission


async def reject_commission(self, commission_id: int, rejector_id: int, reason: str) -> Commission:
    """Reject commission and send notification."""
    commission = await self.get_commission_by_id(commission_id)
    
    commission.state = CommissionState.REJECTED
    commission.rejected_at = datetime.utcnow()
    commission.rejected_by_id = rejector_id
    commission.rejection_reason = reason
    
    await self.session.commit()
    await self.session.refresh(commission)
    
    # إرسال إشعار حرج
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_commission_rejected(commission, rejector_id, reason)
    
    return commission
```

#### في AffiliateService (سحوبات المسوقين):

```python
# في ملف: services/control_panel/affiliate_service.py

async def approve_payout(self, payout_id: int, approver_id: int) -> AffiliatePayout:
    """Approve affiliate payout and send notification."""
    payout = await self.get_payout_by_id(payout_id)
    
    payout.status = AffiliatePayoutStatus.APPROVED
    payout.approved_at = datetime.utcnow()
    payout.approved_by_id = approver_id
    
    await self.session.commit()
    await self.session.refresh(payout)
    
    # إرسال إشعار فوري
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_affiliate_payout_approved(payout, approver_id)
    
    return payout


async def pay_payout(self, payout_id: int, payer_id: int) -> AffiliatePayout:
    """Mark payout as paid and send notification."""
    payout = await self.get_payout_by_id(payout_id)
    
    payout.status = AffiliatePayoutStatus.PAID
    payout.paid_at = datetime.utcnow()
    payout.paid_by_id = payer_id
    
    await self.session.commit()
    await self.session.refresh(payout)
    
    # إرسال إشعار فوري
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_affiliate_payout_paid(payout, payer_id)
    
    return payout


async def reject_payout(self, payout_id: int, rejector_id: int, reason: str) -> AffiliatePayout:
    """Reject payout and send notification."""
    payout = await self.get_payout_by_id(payout_id)
    
    payout.status = AffiliatePayoutStatus.REJECTED
    payout.rejected_at = datetime.utcnow()
    payout.rejected_by_id = rejector_id
    payout.rejection_reason = reason
    
    await self.session.commit()
    await self.session.refresh(payout)
    
    # إرسال إشعار حرج
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_affiliate_payout_rejected(payout, rejector_id, reason)
    
    return payout
```

### 2.3 تنبيهات المعاملات

```python
# في أي خدمة تدير المعاملات

async def check_transaction_fraud(self, transaction_id: int):
    """Check transaction for fraud and send alert if detected."""
    transaction = await self.get_transaction_by_id(transaction_id)
    
    # Logic to detect fraud...
    if fraud_detected:
        event_handler = NotificationEventHandler(self.session)
        await event_handler.on_transaction_alert(
            transaction=transaction,
            alert_type="fraud",
            description=f"تم اكتشاف نشاط مشبوه في المعاملة #{transaction.id}",
            user_id=None  # سيتم البث لجميع المدراء
        )
```

### 2.4 تنبيهات النظام

```python
# إشعار صيانة النظام
event_handler = NotificationEventHandler(session)
await event_handler.on_system_alert(
    title="صيانة النظام",
    body="سيتم إجراء صيانة دورية للنظام من الساعة 12:00 إلى 14:00",
    priority=NotificationPriority.CRITICAL,
    user_id=None  # broadcast لجميع المستخدمين
)

# إشعار تحديث النظام
await event_handler.on_system_alert(
    title="تحديث جديد",
    body="تم تحديث النظام بميزات جديدة للوكلاء والمسوقين",
    priority=NotificationPriority.MEDIUM
)
```

### 2.5 إجراءات مطلوبة من المستخدم

```python
# طلب مراجعة مستند
await event_handler.on_user_action_required(
    user_id=admin_user_id,
    title="مراجعة مستندات مطلوبة",
    body="يوجد 5 مستندات جديدة تحتاج إلى مراجعة",
    action_url="/control-panel/documents/pending",
    priority=NotificationPriority.HIGH
)
```

## 3. تكامل الواجهة (React/Next.js)

### 3.1 إعداد المشروع

```bash
cd web
npm install
cp .env.example .env
```

### 3.2 تحديث متغيرات البيئة

```env
# web/.env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 3.3 دمج المكونات في التطبيق

```tsx
// web/src/app/layout.tsx
import { WebSocketProvider } from '@/contexts/WebSocketContext';

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </body>
    </html>
  );
}
```

```tsx
// web/src/app/page.tsx أو أي صفحة
import { NotificationHistoryPanel, NotificationContainer } from '@/components/notifications';

export default function Dashboard() {
  return (
    <>
      <header>
        <h1>لوحة التحكم</h1>
        <NotificationHistoryPanel />
      </header>
      
      <NotificationContainer />
      
      <main>
        {/* محتوى الصفحة */}
      </main>
    </>
  );
}
```

### 3.4 استخدام hook للوصول للإشعارات

```tsx
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const { 
    notifications, 
    unreadCount, 
    isConnected,
    markAsRead,
    dismiss 
  } = useWebSocket();
  
  return (
    <div>
      <p>إشعارات غير مقروءة: {unreadCount}</p>
      <p>حالة الاتصال: {isConnected ? 'متصل' : 'غير متصل'}</p>
      
      {notifications.slice(0, 5).map(notif => (
        <div key={notif.id}>
          <h4>{notif.title}</h4>
          <p>{notif.body}</p>
          <button onClick={() => markAsRead(notif.id)}>
            تحديد كمقروء
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 4. تشغيل النظام

### 4.1 تشغيل الباكند

```bash
# في المجلد الرئيسي
uvicorn api.main:app --reload --port 8000
```

### 4.2 تشغيل الواجهة

```bash
cd web
npm run dev
```

الواجهة ستعمل على: http://localhost:3001

## 5. اختبار النظام

### 5.1 اختبار الباكند

```bash
pytest tests/control_panel/test_notification_service.py -v
pytest tests/control_panel/test_notification_api.py -v
pytest tests/control_panel/test_notification_websocket.py -v
```

### 5.2 اختبار WebSocket يدويًا

```python
import asyncio
import websockets
import json

async def test_websocket():
    token = "your_jwt_token_here"
    uri = f"ws://localhost:8000/api/v1/control-panel/notifications/ws?token={token}"
    
    async with websockets.connect(uri) as websocket:
        print("متصل بـ WebSocket")
        
        while True:
            message = await websocket.recv()
            notification = json.loads(message)
            print(f"إشعار جديد: {notification['title']}")

asyncio.run(test_websocket())
```

### 5.3 اختبار API يدويًا

```bash
# إنشاء إشعار
curl -X POST http://localhost:8000/api/v1/control-panel/notifications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "title": "اختبار إشعار",
    "body": "هذا إشعار تجريبي",
    "notification_type": "GENERAL",
    "priority": "HIGH"
  }'

# جلب الإشعارات
curl http://localhost:8000/api/v1/control-panel/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# إحصائيات الإشعارات
curl http://localhost:8000/api/v1/control-panel/notifications/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 6. نصائح التطوير

### 6.1 تخصيص المكونات

يمكنك تخصيص ألوان وأنماط المكونات في:
- `web/src/components/notifications/ModalOverlayNotification.tsx`
- `web/src/components/notifications/ToastBannerNotification.tsx`
- `web/src/app/globals.css`

### 6.2 إضافة أنواع إشعارات جديدة

1. أضف النوع الجديد في `models.py`:
```python
class NotificationType(str, Enum):
    # ... الأنواع الموجودة
    NEW_TYPE = "NEW_TYPE"
```

2. أنشئ معالج في `notification_events.py`:
```python
async def on_new_event(self, entity, actor_id):
    await self.notification_service.create_and_broadcast(
        user_id=entity.user_id,
        title="عنوان الإشعار",
        body="محتوى الإشعار",
        notification_type=NotificationType.NEW_TYPE,
        priority=NotificationPriority.HIGH
    )
```

3. حدّث TypeScript types في `web/src/types/notification.ts`

### 6.3 مراقبة الأداء

```python
# في notification_service.py
import time

async def create_and_broadcast(self, ...):
    start = time.time()
    result = await self._create_and_broadcast_impl(...)
    duration = time.time() - start
    
    if duration > 1.0:  # أكثر من ثانية
        logger.warning(f"Slow notification broadcast: {duration:.2f}s")
    
    return result
```

## 7. الدعم والاستكشاف

### 7.1 سجلات النظام

```bash
# فحص سجلات الباكند
tail -f logs/notification_service.log

# فحص سجلات الواجهة
cd web && npm run dev -- --debug
```

### 7.2 مشاكل شائعة

**مشكلة**: WebSocket لا يتصل
- **الحل**: تأكد من أن JWT token صالح وأن URL صحيح

**مشكلة**: الإشعارات لا تظهر في الواجهة
- **الحل**: افحص console في المتصفح، تأكد من WebSocketProvider محاط بجميع المكونات

**مشكلة**: Rate limiting يمنع الإشعارات
- **الحل**: اضبط الحدود في `notification_service.py` أو انتظر 60 ثانية

---

✅ **النظام جاهز للإنتاج!**
