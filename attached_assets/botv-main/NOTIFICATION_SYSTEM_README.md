# نظام الإشعارات الفوري - LangSense

نظام إشعارات متكامل وفوري لتتبع جميع الأحداث الحرجة المتعلقة بالوكلاء والمسوقين بالعمولة.

## المزايا الرئيسية

### الباكند (FastAPI + SQLAlchemy)

1. **نماذج البيانات**:
   - `Notification`: جدول الإشعارات مع idempotency_key، أولوية، نوع، حالة، action_url، read_at، interacted_at، dismissed_at
   - `NotificationEvent`: سجل تدقيق كامل لكل حدث إشعار
   - Enums: `NotificationPriority`, `NotificationType`, `NotificationStatus`

2. **خدمة الإشعارات** (`NotificationService`):
   - إنشاء وبث الإشعارات عبر WebSocket
   - حماية Rate Limiting (50 إشعار/60 ثانية)
   - تسجيل تدقيق كامل في AuditLog
   - إدارة اتصالات WebSocket مع connection pooling
   - Idempotency protection لمنع التكرار

3. **روترات API** (`api/v1/control-panel/notifications/`):
   - `POST /`: إنشاء إشعار جديد (يتطلب `notification:send`)
   - `GET /`: جلب قائمة الإشعارات (يتطلب `notification:view`)
   - `GET /stats`: إحصائيات الإشعارات
   - `POST /{id}/read`: تحديد إشعار كمقروء
   - `POST /{id}/interact`: تسجيل تفاعل مع إشعار
   - `POST /{id}/dismiss`: تجاهل إشعار
   - `POST /broadcast`: بث إشعار لعدة مستخدمين (يتطلب `notification:manage`)
   - `GET /ws`: WebSocket endpoint للإشعارات الفورية

4. **تكامل RBAC**:
   - `notification:view`: عرض الإشعارات
   - `notification:send`: إرسال إشعارات
   - `notification:manage`: إدارة وبث الإشعارات
   - `notification:approve`: الموافقة على الإشعارات

### الواجهة (React/Next.js)

1. **مكونات الإشعارات**:

   - **ModalOverlayNotification**: إشعارات حرجة (CRITICAL) تعرض كـ modal يحجب سير العمل، مع أزرار الإجراءات
   - **ToastBannerNotification**: إشعارات عادية (HIGH/MEDIUM/LOW/INFO) تعرض كـ toast قابل للإزالة مع fade-out تلقائي
   - **NotificationHistoryPanel**: لوحة جانبية تعرض تاريخ جميع الإشعارات مع فلاتر حسب الأولوية والحالة
   - **NotificationContainer**: حاوية تدير عرض الإشعارات حسب الأولوية

2. **إدارة الاتصال**:
   - **WebSocketProvider**: Context يدير اتصال WebSocket، التحديثات الفورية، والحالة
   - إعادة الاتصال التلقائي عند انقطاع الاتصال
   - تحديث الحالة المحلية عند استلام إشعارات جديدة

3. **خدمات API**:
   - `notificationService`: دوال للتفاعل مع API الباكند (getNotifications, markAsRead, dismiss, etc.)

## البنية التقنية

```
web/
├── package.json                        # Dependencies (Next.js, React, axios, date-fns, react-icons)
├── next.config.js                      # Next.js config
├── tsconfig.json                       # TypeScript config
├── tailwind.config.js                  # Tailwind CSS config
└── src/
    ├── app/
    │   ├── layout.tsx                  # Root layout with WebSocketProvider
    │   ├── page.tsx                    # Home page
    │   └── globals.css                 # Global styles
    ├── components/
    │   └── notifications/
    │       ├── ModalOverlayNotification.tsx
    │       ├── ToastBannerNotification.tsx
    │       ├── NotificationHistoryPanel.tsx
    │       ├── NotificationContainer.tsx
    │       └── index.ts
    ├── contexts/
    │   └── WebSocketContext.tsx        # WebSocket connection management
    ├── services/
    │   └── notificationService.ts      # API client
    └── types/
        └── notification.ts             # TypeScript interfaces and enums
```

## التثبيت والتشغيل

### الباكند

```bash
# تثبيت المتطلبات
pip install -r requirements.txt

# تشغيل FastAPI
uvicorn api.main:app --reload --port 8000
```

### الواجهة

```bash
cd web

# تثبيت المتطلبات
npm install

# إنشاء ملف .env
cp .env.example .env

# تشغيل Next.js
npm run dev
```

الواجهة ستعمل على: http://localhost:3001

## متغيرات البيئة

### الواجهة (web/.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## الاستخدام

### 1. إنشاء إشعار من الباكند

```python
from services.control_panel.notification_service import NotificationService
from models import NotificationPriority, NotificationType

service = NotificationService(session)

# إنشاء وبث إشعار حرج
await service.create_and_broadcast(
    user_id=123,
    title="موافقة عمولة جديدة",
    body="تمت الموافقة على عمولة بقيمة 500 ريال",
    notification_type=NotificationType.AGENT_COMMISSION_APPROVED,
    priority=NotificationPriority.HIGH,
    action_url="/commissions/456"
)
```

### 2. بث لعدة مستخدمين

```python
# بث إشعار لجميع الوكلاء
await service.create_and_broadcast(
    user_id=None,  # سيتم البث لجميع المتصلين
    title="تحديث النظام",
    body="سيتم صيانة النظام من 12:00 إلى 14:00",
    notification_type=NotificationType.SYSTEM_ALERT,
    priority=NotificationPriority.CRITICAL
)
```

### 3. استخدام المكونات في React

```tsx
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { NotificationHistoryPanel, NotificationContainer } from '@/components/notifications';

export default function App() {
  return (
    <WebSocketProvider>
      <header>
        <NotificationHistoryPanel />
      </header>
      <NotificationContainer />
      <main>{/* Your content */}</main>
    </WebSocketProvider>
  );
}
```

## الأولويات والعرض

| الأولوية | العرض | الوصف |
|---------|------|-------|
| CRITICAL | Modal Overlay | يحجب سير العمل، يتطلب إجراء |
| HIGH | Toast Banner (برتقالي) | إشعار عاجل، fade-out بعد 8 ثواني |
| MEDIUM | Toast Banner (أصفر) | إشعار متوسط الأهمية |
| LOW | Toast Banner (أزرق) | إشعار منخفض الأهمية |
| INFO | Toast Banner (رمادي) | إشعار معلوماتي |

## أنواع الإشعارات

- `AGENT_COMMISSION_APPROVED`: موافقة على عمولة وكيل
- `AGENT_COMMISSION_PAID`: دفع عمولة وكيل
- `AGENT_COMMISSION_REJECTED`: رفض عمولة وكيل
- `AFFILIATE_PAYOUT_APPROVED`: موافقة على سحب مسوق
- `AFFILIATE_PAYOUT_PAID`: دفع سحب مسوق
- `AFFILIATE_PAYOUT_REJECTED`: رفض سحب مسوق
- `TRANSACTION_ALERT`: تنبيه معاملة
- `SYSTEM_ALERT`: تنبيه نظام
- `USER_ACTION_REQUIRED`: إجراء مطلوب من المستخدم
- `GENERAL`: عام

## الميزات الأمنية

1. **RBAC Integration**: جميع endpoints محمية بصلاحيات RBAC
2. **Rate Limiting**: 50 إشعار لكل مستخدم كل 60 ثانية
3. **Idempotency Keys**: منع تكرار الإشعارات
4. **Audit Logging**: تسجيل كامل لجميع الإجراءات في AuditLog
5. **JWT Authentication**: حماية WebSocket بـ JWT tokens

## الاختبارات (قيد التطوير)

```bash
# اختبارات الباكند
pytest tests/test_notification_service.py -v

# اختبارات الواجهة
cd web && npm test
```

## التطوير المستقبلي

- [ ] إضافة Push Notifications للهواتف
- [ ] دعم Email/SMS fallback
- [ ] لوحة تحكم إحصائية متقدمة
- [ ] تخصيص تفضيلات الإشعارات لكل مستخدم
- [ ] دعم القوالب والترجمات

## الدعم

للمساعدة أو الإبلاغ عن مشاكل، يرجى فتح Issue في المستودع.

---

**الإصدار**: 1.0.0  
**التاريخ**: 2024
