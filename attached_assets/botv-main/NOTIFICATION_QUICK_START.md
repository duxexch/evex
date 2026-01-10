# 🚀 البدء السريع - نظام الإشعارات

دليل مختصر للمطورين للبدء باستخدام نظام الإشعارات في 5 دقائق.

## ⚡ الإعداد السريع

### 1. قاعدة البيانات (30 ثانية)

```bash
# تطبيق migration
alembic upgrade head
```

### 2. تشغيل الباكند (30 ثانية)

```bash
# في المجلد الرئيسي
uvicorn api.main:app --reload --port 8000
```

### 3. تشغيل الواجهة (دقيقتين)

```bash
cd web
npm install           # أول مرة فقط
cp .env.example .env  # أول مرة فقط
npm run dev
```

الواجهة على: http://localhost:3001

---

## 📝 أمثلة الاستخدام

### مثال 1: إرسال إشعار بسيط (الباكند)

```python
from services.control_panel.notification_service import NotificationService
from models import NotificationPriority, NotificationType

# في أي service أو endpoint
async def my_function(session, user_id):
    service = NotificationService(session)
    
    await service.create_and_broadcast(
        user_id=user_id,
        title="عملية ناجحة",
        body="تمت العملية بنجاح",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
```

### مثال 2: ربط بحدث حرج (الباكند)

```python
from services.control_panel.notification_events import NotificationEventHandler

# في AgentService.approve_commission()
async def approve_commission(self, commission_id: int, approver_id: int):
    commission = await self.get_commission_by_id(commission_id)
    commission.state = CommissionState.APPROVED
    await self.session.commit()
    
    # إرسال إشعار تلقائي
    handler = NotificationEventHandler(self.session)
    await handler.on_commission_approved(commission, approver_id)
    
    return commission
```

### مثال 3: عرض الإشعارات (الواجهة)

```tsx
// في أي صفحة
import { NotificationHistoryPanel, NotificationContainer } from '@/components/notifications';

export default function MyPage() {
  return (
    <>
      <header>
        <h1>لوحة التحكم</h1>
        <NotificationHistoryPanel />  {/* أيقونة الجرس */}
      </header>
      
      <NotificationContainer />  {/* Modals & Toasts */}
      
      <main>
        {/* محتوى الصفحة */}
      </main>
    </>
  );
}
```

### مثال 4: الوصول للإشعارات برمجيًا (الواجهة)

```tsx
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const { notifications, unreadCount, markAsRead } = useWebSocket();
  
  return (
    <div>
      <span>إشعارات غير مقروءة: {unreadCount}</span>
      
      {notifications.slice(0, 3).map(notif => (
        <div key={notif.id} onClick={() => markAsRead(notif.id)}>
          <h4>{notif.title}</h4>
          <p>{notif.body}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 الحالات الشائعة

### ✅ موافقة عمولة وكيل

```python
# في AgentService
handler = NotificationEventHandler(session)
await handler.on_commission_approved(commission, approver_id)
```

### ✅ رفض سحب مسوق

```python
# في AffiliateService
handler = NotificationEventHandler(session)
await handler.on_affiliate_payout_rejected(payout, rejector_id, reason="السبب")
```

### ✅ تنبيه نظام للجميع

```python
handler = NotificationEventHandler(session)
await handler.on_system_alert(
    title="صيانة النظام",
    body="سيتم إجراء صيانة من 12:00 إلى 14:00",
    priority=NotificationPriority.CRITICAL,
    user_id=None  # broadcast للجميع
)
```

### ✅ إجراء مطلوب من مستخدم محدد

```python
handler = NotificationEventHandler(session)
await handler.on_user_action_required(
    user_id=admin_id,
    title="مراجعة مطلوبة",
    body="يوجد 5 مستندات تحتاج مراجعة",
    action_url="/control-panel/documents",
    priority=NotificationPriority.HIGH
)
```

---

## 🔍 اختبار سريع

### اختبار WebSocket

```python
# في Python REPL أو Jupyter
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/api/v1/control-panel/notifications/ws?token=YOUR_JWT"
    async with websockets.connect(uri) as ws:
        print("متصل!")
        msg = await ws.recv()
        print(f"إشعار: {json.loads(msg)['title']}")

asyncio.run(test())
```

### اختبار API

```bash
# إنشاء إشعار
curl -X POST http://localhost:8000/api/v1/control-panel/notifications \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "title": "اختبار",
    "body": "هذا إشعار تجريبي",
    "notification_type": "GENERAL",
    "priority": "HIGH"
  }'

# جلب الإشعارات
curl http://localhost:8000/api/v1/control-panel/notifications \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 📖 التوثيق الكامل

للمزيد من التفاصيل:

- **نظرة عامة**: [NOTIFICATION_SYSTEM_README.md](NOTIFICATION_SYSTEM_README.md)
- **دليل التكامل**: [NOTIFICATION_INTEGRATION_GUIDE.md](NOTIFICATION_INTEGRATION_GUIDE.md)
- **تقرير الإنجاز**: [NOTIFICATION_SYSTEM_COMPLETION_REPORT.md](NOTIFICATION_SYSTEM_COMPLETION_REPORT.md)
- **فهرس الملفات**: [NOTIFICATION_SYSTEM_FILES_INDEX.md](NOTIFICATION_SYSTEM_FILES_INDEX.md)

---

## 🆘 مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| WebSocket لا يتصل | تحقق من JWT token وURL |
| الإشعارات لا تظهر | تحقق من WebSocketProvider في layout.tsx |
| Rate limiting | انتظر 60 ثانية أو اضبط الحد في notification_service.py |
| Migration خطأ | تحقق من اتصال قاعدة البيانات |

---

## ✅ Checklist قبل الإنتاج

- [ ] تطبيق migration: `alembic upgrade head`
- [ ] إعداد متغيرات البيئة في `web/.env`
- [ ] اختبار WebSocket connection
- [ ] اختبار جميع الأحداث الحرجة
- [ ] مراجعة صلاحيات RBAC
- [ ] إعداد monitoring للنظام

---

**النظام جاهز! استمتع بالإشعارات الفورية** 🎉
