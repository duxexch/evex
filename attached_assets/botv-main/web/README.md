# نظام الإشعارات الفوري - واجهة React/Next.js

واجهة المستخدم لنظام الإشعارات الفوري لمنصة LangSense Control Panel.

## المزايا

- ✅ إشعارات فورية عبر WebSocket
- ✅ Modal Overlays للإشعارات الحرجة
- ✅ Toast Banners للإشعارات العادية
- ✅ لوحة تاريخ الإشعارات مع فلاتر
- ✅ دعم كامل للغة العربية (RTL)
- ✅ تصميم responsive
- ✅ TypeScript + Tailwind CSS

## التثبيت

```bash
npm install
```

## إعداد البيئة

انسخ ملف `.env.example` إلى `.env`:

```bash
cp .env.example .env
```

حدّث المتغيرات:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## التشغيل

### Development

```bash
npm run dev
```

الواجهة ستعمل على: http://localhost:3001

### Production Build

```bash
npm run build
npm start
```

## الهيكل

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   └── notifications/     # Notification components
│       ├── ModalOverlayNotification.tsx
│       ├── ToastBannerNotification.tsx
│       ├── NotificationHistoryPanel.tsx
│       ├── NotificationContainer.tsx
│       └── index.ts
├── contexts/
│   └── WebSocketContext.tsx  # WebSocket connection management
├── services/
│   └── notificationService.ts  # API client
└── types/
    └── notification.ts    # TypeScript types
```

## الاستخدام

### في أي صفحة

```tsx
import { NotificationHistoryPanel, NotificationContainer } from '@/components/notifications';

export default function MyPage() {
  return (
    <>
      <header>
        <NotificationHistoryPanel />
      </header>
      <NotificationContainer />
      <main>{/* محتوى الصفحة */}</main>
    </>
  );
}
```

### استخدام Hook

```tsx
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const { notifications, unreadCount, markAsRead } = useWebSocket();
  
  return (
    <div>
      <p>إشعارات غير مقروءة: {unreadCount}</p>
    </div>
  );
}
```

## المكونات

### ModalOverlayNotification

للإشعارات الحرجة (CRITICAL) - يحجب سير العمل ويتطلب تفاعل المستخدم.

### ToastBannerNotification

للإشعارات العادية (HIGH/MEDIUM/LOW/INFO) - يظهر في أعلى الصفحة مع fade-out تلقائي.

### NotificationHistoryPanel

لوحة جانبية تعرض تاريخ جميع الإشعارات مع فلاتر.

### NotificationContainer

حاوية تدير عرض الإشعارات تلقائيًا حسب الأولوية.

## التطوير

للمزيد من التفاصيل، راجع:
- [../NOTIFICATION_SYSTEM_README.md](../NOTIFICATION_SYSTEM_README.md)
- [../NOTIFICATION_INTEGRATION_GUIDE.md](../NOTIFICATION_INTEGRATION_GUIDE.md)
