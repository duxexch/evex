# دليل بناء تطبيق VEX للموبايل
# VEX Mobile App Build Guide

## المتطلبات | Prerequisites

### للتطوير | For Development:
- Node.js 18+
- npm أو yarn

### لبناء Android:
- Android Studio
- Android SDK (API 24+)
- Java JDK 17+

### لبناء iOS:
- macOS
- Xcode 15+
- CocoaPods

---

## الخطوة 1: تثبيت الـ Dependencies

```bash
# تثبيت حزم المشروع
npm install

# تثبيت Capacitor CLI
npm install @capacitor/core @capacitor/cli

# تثبيت منصات Android و iOS
npm install @capacitor/android @capacitor/ios

# تثبيت الـ Plugins المطلوبة
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard @capacitor/push-notifications
```

---

## الخطوة 2: بناء المشروع للإنتاج

```bash
# بناء الـ Frontend
npm run build
```

---

## الخطوة 3: إضافة المنصات

```bash
# إضافة Android
npx cap add android

# إضافة iOS (يتطلب macOS)
npx cap add ios
```

---

## الخطوة 4: مزامنة الملفات

```bash
# نسخ الـ build للمنصات
npx cap sync
```

---

## الخطوة 5: فتح المشروع في IDE

```bash
# لـ Android (يفتح Android Studio)
npx cap open android

# لـ iOS (يفتح Xcode)
npx cap open ios
```

---

## الخطوة 6: بناء APK/IPA

### Android APK:
1. افتح المشروع في Android Studio
2. اذهب لـ Build > Build Bundle(s) / APK(s) > Build APK(s)
3. APK يكون في: `android/app/build/outputs/apk/`

### Android Bundle (للمتجر):
1. Build > Generate Signed Bundle / APK
2. اختر Android App Bundle
3. وقّع بمفتاحك الخاص

### iOS IPA:
1. افتح المشروع في Xcode
2. اختر Generic iOS Device
3. Product > Archive
4. Distribute App

---

## الخطوة 7: إضافة الأيقونات

### مجلد الأيقونات:
```
client/public/icons/
├── icon-72.png
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-152.png
├── icon-192.png
├── icon-384.png
└── icon-512.png
```

### لإنشاء الأيقونات تلقائياً:
استخدم أداة مثل:
- https://icon.kitchen
- https://makeappicon.com
- https://appicon.co

---

## إعدادات مهمة

### تغيير اسم التطبيق:
عدّل في `capacitor.config.ts`:
```typescript
appName: 'VEX',
appId: 'click.vixo.app',
```

### تغيير ألوان الـ Splash Screen:
```typescript
plugins: {
  SplashScreen: {
    backgroundColor: '#0f1419',
  }
}
```

---

## تحديث التطبيق

بعد أي تعديل:
```bash
npm run build
npx cap sync
npx cap open android  # أو ios
```

---

## للنشر على المتاجر

### Google Play Store:
1. أنشئ حساب مطور ($25 مرة واحدة)
2. أنشئ تطبيق جديد
3. ارفع AAB (Android App Bundle)
4. أضف الوصف والصور
5. أرسل للمراجعة

### Apple App Store:
1. أنشئ حساب مطور ($99/سنة)
2. أنشئ App ID في Apple Developer
3. أنشئ تطبيق في App Store Connect
4. ارفع IPA عبر Xcode
5. أرسل للمراجعة

---

## ملاحظات مهمة

1. **الـ Server URL**: تأكد أن التطبيق يشير للسيرفر الصحيح
2. **HTTPS مطلوب**: التطبيق يتطلب اتصال آمن
3. **Push Notifications**: تحتاج إعداد Firebase (Android) و APNs (iOS)
4. **Deep Links**: يمكن إضافتها لاحقاً للمشاركة

---

## الدعم

إذا واجهت مشاكل:
1. تأكد من تثبيت جميع الـ dependencies
2. تأكد من إصدارات Android Studio/Xcode
3. شغّل `npx cap doctor` لفحص المشاكل
