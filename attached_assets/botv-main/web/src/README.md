# Source Code - React/Next.js Application

دليل المطورين لفهم بنية الكود المصدري للواجهة.

## 📁 هيكل المجلد

```
src/
├── app/                    # Next.js App Router
├── components/             # React Components
├── contexts/               # React Contexts
├── services/              # API Services
└── types/                 # TypeScript Types
```

---

## 🎯 app/ - Next.js Application

### layout.tsx
**الدور**: Root layout للتطبيق بأكمله

**المكونات الرئيسية**:
- يلف جميع الصفحات بـ `WebSocketProvider`
- يضبط `lang="ar"` و `dir="rtl"` للدعم العربي
- يستورد `globals.css`

```tsx
<WebSocketProvider>
  {children}  {/* جميع الصفحات هنا */}
</WebSocketProvider>
```

### page.tsx
**الدور**: الصفحة الرئيسية (Home page)

**المكونات المستخدمة**:
- `<NotificationHistoryPanel />`: أيقونة الجرس في الهيدر
- `<NotificationContainer />`: لعرض Modals وToasts

### globals.css
**الدور**: Tailwind CSS imports + styles عامة

---

## 🧩 components/notifications/ - مكونات الإشعارات

### ModalOverlayNotification.tsx
**متى يُستخدم**: للإشعارات **CRITICAL** فقط

**الميزات**:
- Modal يحجب الشاشة بالكامل
- أزرار إجراءات (اتخاذ إجراء / تجاهل)
- تلقائيًا `markAsRead` عند الفتح
- أيقونات مختلفة حسب الأولوية
- شريط ملون علوي حسب الأولوية

**Props**:
```tsx
interface Props {
  notification: Notification;
  onClose: () => void;
  onAction?: () => void;
}
```

### ToastBannerNotification.tsx
**متى يُستخدم**: للإشعارات HIGH, MEDIUM, LOW, INFO

**الميزات**:
- يظهر في أعلى الصفحة
- fade-out تلقائي بعد 8 ثوانٍ (قابل للتخصيص)
- قابل للنقر (ينقل للـ action_url)
- قابل للإزالة يدويًا
- ألوان مختلفة حسب الأولوية

**Props**:
```tsx
interface Props {
  notification: Notification;
  onClose: () => void;
  autoHideDuration?: number;  // default: 8000ms
}
```

### NotificationHistoryPanel.tsx
**متى يُستخدم**: لعرض تاريخ جميع الإشعارات

**الميزات**:
- لوحة جانبية منزلقة من اليسار
- عداد للإشعارات غير المقروءة
- فلاتر حسب الأولوية والحالة
- pagination تلقائي
- عرض الوقت النسبي بالعربية
- أزرار لـ mark as read و dismiss

**استخدام**:
```tsx
<header>
  <h1>العنوان</h1>
  <NotificationHistoryPanel />  {/* أيقونة الجرس */}
</header>
```

### NotificationContainer.tsx
**متى يُستخدم**: دائمًا! في كل صفحة تحتاج إشعارات

**الدور**:
- يستمع للإشعارات الجديدة من WebSocket
- يوجّه الإشعارات حسب الأولوية:
  - **CRITICAL** → `ModalOverlayNotification`
  - **HIGH/MEDIUM/LOW/INFO** → `ToastBannerNotification`
- يدير تكديس Toast notifications

**استخدام**:
```tsx
<NotificationContainer />  {/* في أي صفحة */}
```

### index.ts
**الدور**: تصدير جميع المكونات

```tsx
export { ModalOverlayNotification } from './ModalOverlayNotification';
export { ToastBannerNotification } from './ToastBannerNotification';
export { NotificationHistoryPanel } from './NotificationHistoryPanel';
export { NotificationContainer } from './NotificationContainer';
```

---

## 🔌 contexts/WebSocketContext.tsx

**الدور**: إدارة اتصال WebSocket والحالة العامة للإشعارات

### الميزات الرئيسية

1. **اتصال WebSocket**:
   - اتصال تلقائي عند mount
   - إعادة اتصال تلقائية بعد 5 ثوانٍ من الانقطاع
   - استلام إشعارات فورية

2. **إدارة الحالة**:
   - `notifications`: قائمة جميع الإشعارات
   - `unreadCount`: عدد الإشعارات غير المقروءة
   - `isConnected`: حالة اتصال WebSocket

3. **الدوال**:
   - `addNotification()`: إضافة إشعار يدويًا
   - `markAsRead()`: تحديد إشعار كمقروء
   - `markAsInteracted()`: تسجيل تفاعل
   - `dismiss()`: إخفاء إشعار

### استخدام الـ Context

```tsx
// في أي مكون
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const { 
    notifications,     // جميع الإشعارات
    unreadCount,       // عدد غير المقروءة
    isConnected,       // حالة الاتصال
    markAsRead,        // دالة
    dismiss            // دالة
  } = useWebSocket();
  
  return <div>إشعارات: {unreadCount}</div>;
}
```

### تدفق البيانات

```
WebSocket (Backend)
    ↓
WebSocketContext (استلام إشعار جديد)
    ↓
notifications state (تحديث)
    ↓
NotificationContainer (يستمع للتحديثات)
    ↓
ModalOverlayNotification / ToastBannerNotification (عرض)
```

---

## 🌐 services/notificationService.ts

**الدور**: Client API للتفاعل مع الباكند

### الدوال المتاحة

```tsx
const notificationService = {
  // جلب قائمة الإشعارات
  getNotifications(limit = 50, offset = 0): Promise<Notification[]>
  
  // جلب إحصائيات
  getStats(): Promise<NotificationStats>
  
  // تحديد كمقروء
  markAsRead(notificationId: number): Promise<void>
  
  // تسجيل تفاعل
  markAsInteracted(notificationId: number): Promise<void>
  
  // إخفاء إشعار
  dismiss(notificationId: number): Promise<void>
}
```

### استخدام

```tsx
import { notificationService } from '@/services/notificationService';

// جلب الإشعارات
const notifications = await notificationService.getNotifications(10, 0);

// تحديد كمقروء
await notificationService.markAsRead(123);
```

### Authentication

جميع الطلبات تستخدم JWT token من `localStorage`:

```tsx
headers: { 
  Authorization: `Bearer ${localStorage.getItem('token')}` 
}
```

---

## 📘 types/notification.ts

**الدور**: TypeScript type definitions

### Enums

```tsx
enum NotificationPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

enum NotificationType {
  AGENT_COMMISSION_APPROVED = 'AGENT_COMMISSION_APPROVED',
  AGENT_COMMISSION_PAID = 'AGENT_COMMISSION_PAID',
  // ... 8 أنواع أخرى
}

enum NotificationStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  INTERACTED = 'INTERACTED',
  DISMISSED = 'DISMISSED',
  FAILED = 'FAILED'
}
```

### Interfaces

```tsx
interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  action_url?: string;
  idempotency_key?: string;
  read_at?: string;
  interacted_at?: string;
  dismissed_at?: string;
  event_id?: number;
  actor_id?: number;
  created_at: string;
  updated_at: string;
}

interface NotificationStats {
  total_notifications: number;
  unread_count: number;
  by_priority: Record<NotificationPriority, number>;
  by_status: Record<NotificationStatus, number>;
}
```

---

## 🎨 التخصيص

### تغيير الألوان

في المكونات، ابحث عن `getPriorityColor()` أو `getPriorityStyles()`:

```tsx
// في ModalOverlayNotification.tsx
const getPriorityColor = () => {
  switch (notification.priority) {
    case NotificationPriority.CRITICAL:
      return 'bg-red-600';      // ← غيّر هنا
    case NotificationPriority.HIGH:
      return 'bg-orange-500';   // ← غيّر هنا
    // ...
  }
};
```

### تغيير مدة عرض Toast

```tsx
<ToastBannerNotification
  notification={notif}
  onClose={handleClose}
  autoHideDuration={5000}  // ← 5 ثوانٍ بدلاً من 8
/>
```

### إضافة نوع إشعار جديد

1. أضف في `types/notification.ts`:
```tsx
enum NotificationType {
  // ... الأنواع الموجودة
  NEW_TYPE = 'NEW_TYPE'
}
```

2. حدّث الأيقونة في `ModalOverlayNotification.tsx` أو `ToastBannerNotification.tsx` إذا لزم الأمر.

---

## 🧪 نصائح التطوير

### 1. Hot Reload

عند تحرير أي ملف `.tsx`، التطبيق يُحدّث تلقائيًا.

### 2. TypeScript Errors

```bash
# فحص الأخطاء بدون تشغيل
npm run build
```

### 3. Console Logs

افتح Developer Tools في المتصفح لرؤية:
- WebSocket connection logs
- Notification reception logs
- Any errors

### 4. React DevTools

استخدم React DevTools لفحص:
- WebSocketContext state
- Props المكونات
- Component tree

---

## 📦 Dependencies الرئيسية

```json
{
  "next": "^14.1.0",           // Next.js framework
  "react": "^18.2.0",          // React library
  "react-dom": "^18.2.0",      // React DOM
  "axios": "^1.6.5",           // HTTP client
  "date-fns": "^3.2.0",        // Date formatting (للغة العربية)
  "react-icons": "^5.0.1"      // Icons
}
```

---

## 🔗 الروابط المفيدة

- [Next.js Docs](https://nextjs.org/docs)
- [React Context API](https://react.dev/reference/react/createContext)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [date-fns locale](https://date-fns.org/v3.2.0/docs/I18n)

---

**للمزيد من المعلومات، راجع [../NOTIFICATION_INTEGRATION_GUIDE.md](../NOTIFICATION_INTEGRATION_GUIDE.md)**
