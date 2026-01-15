# دليل ترتيب تشغيل السكريبتات
# VEX Scripts Execution Order Guide

هذا الملف يشرح ترتيب تشغيل السكريبتات ووظيفة كل واحد منها.
This file explains the order of running scripts and the function of each one.

---

## ⚠️ تحذيرات مهمة / Important Warnings

### 1. DATABASE_URL Configuration
عند استخدام VPS محلي (مثل Hostinger)، تأكد من:
When using local VPS (like Hostinger), make sure:

```bash
# ✅ صحيح / Correct (VPS/Server)
DATABASE_URL=postgresql://vex_user:password@localhost:5432/vex_db?sslmode=disable

# ❌ خطأ / Wrong (Docker format)
DATABASE_URL=postgresql://vex_user:password@db:5432/vex_db
```

**الأخطاء الشائعة / Common Mistakes:**
- `PGHOST=db` بدلاً من `PGHOST=localhost`
- نسيان `?sslmode=disable` للـ PostgreSQL المحلي
- اسم قاعدة بيانات خاطئ

### 2. Build Verification
قبل تشغيل التطبيق، تأكد من وجود ملف البناء:
Before starting the app, verify the build file exists:

```bash
# تحقق من وجود الملف
ls -la dist/index.cjs

# إذا لم يكن موجوداً، ابني المشروع
npm run build
```

### 3. Environment Variables for PM2
PM2 لا يحمل ملف .env تلقائياً! يجب تحميله أولاً:
PM2 doesn't load .env automatically! You must load it first:

```bash
# الطريقة الصحيحة / Correct way
export $(cat .env | grep -v '^#' | xargs)
pm2 start "node dist/index.cjs" --name "vex"
```

---

## 📋 جدول السكريبتات / Scripts Table

| # | السكريبت / Script | الوظيفة / Function | متى تستخدمه / When to Use |
|---|-------------------|---------------------|---------------------------|
| 1 | `install.sh` | التثبيت الكامل | مرة واحدة على سيرفر جديد |
| 2 | `start.sh` | تشغيل التطبيق | عند الحاجة لتشغيل يدوي |
| 3 | `update.sh` | تحديث الكود | عند توفر تحديثات جديدة |
| 4 | `backup-db.sh` | نسخ احتياطي | قبل أي تغييرات أو يومياً |
| 5 | `restore-db.sh` | استعادة البيانات | عند الحاجة لاستعادة |
| 6 | `troubleshoot.sh` | تشخيص المشاكل | عند حدوث أي مشكلة |
| 7 | `seed-admin.sh` | إنشاء مستخدم Admin | تلقائياً أثناء التثبيت |

---

## 🚀 التثبيت الأول / First Time Installation

### الخطوة 1: رفع الملفات للسيرفر
```bash
# من جهازك المحلي
scp -r ./vex-project root@YOUR_SERVER_IP:/root/
```

### الخطوة 2: تشغيل سكريبت التثبيت
```bash
# على السيرفر
cd /root/vex-project
chmod +x scripts/*.sh
sudo bash scripts/install.sh
```

### ماذا يفعل install.sh:
1. ✅ يحدث نظام التشغيل
2. ✅ يثبت Node.js 20
3. ✅ يثبت PostgreSQL
4. ✅ يثبت Nginx
5. ✅ يثبت PM2
6. ✅ يعد جدار الحماية
7. ✅ ينشئ قاعدة البيانات
8. ✅ يبني المشروع **ويتحقق من البناء**
9. ✅ ينشئ مستخدم Admin تلقائياً
10. ✅ يحمل متغيرات البيئة قبل PM2
11. ✅ يعد شهادة SSL
12. ✅ يشغل التطبيق

### الخيارات المتاحة:
```bash
# تثبيت كامل
sudo bash scripts/install.sh

# تخطي SSL (إعداده لاحقاً)
sudo bash scripts/install.sh --skip-ssl

# تخطي جدار الحماية
sudo bash scripts/install.sh --skip-fw

# عرض المساعدة
sudo bash scripts/install.sh --help
```

---

## 👤 مستخدم Admin الافتراضي / Default Admin User

بعد التثبيت، يتم إنشاء مستخدم Admin تلقائياً:
After installation, an admin user is created automatically:

| الحقل | القيمة |
|-------|--------|
| Username | `admin` |
| Password | `admin123` |
| Email | `admin@yourdomain.com` |

⚠️ **مهم جداً**: غيّر كلمة المرور فوراً بعد الدخول الأول!
⚠️ **IMPORTANT**: Change the password immediately after first login!

### إنشاء Admin يدوياً (إذا لزم الأمر):
```bash
cd /var/www/vex
export $(cat .env | grep -v '^#' | xargs)
bash scripts/seed-admin.sh
```

---

## 🔄 التحديث / Updating

### متى تحدث:
- عند توفر ميزات جديدة
- عند إصلاح أخطاء
- بشكل دوري (أسبوعياً)

### كيفية التحديث:
```bash
cd /var/www/vex
sudo bash scripts/update.sh
```

### ⚠️ ملف .env آمن 100% - لن يتم تعديله أبداً!

### ماذا يفعل update.sh v3.0:

```
┌─────────────────────────────────────────────────────────────┐
│  1️⃣ فحوصات قبل البدء (Preflight Checks)                    │
│     ├── هل .env موجود؟                                      │
│     ├── هل PM2 يعمل؟                                        │
│     ├── هل git متصل بـ GitHub؟                              │
│     └── هل هناك تحديثات متاحة؟                              │
│                                                             │
│  2️⃣ نسخة احتياطية كاملة (Full Backup)                      │
│     ├── ملفات المشروع → backup_TIMESTAMP.tar.gz            │
│     └── قاعدة البيانات → db_backup_TIMESTAMP.sql.gz        │
│                                                             │
│  3️⃣ سحب التحديثات (Pull Updates)                           │
│     └── git pull من GitHub                                  │
│                                                             │
│  4️⃣ بناء المشروع (Build)                                   │
│     ├── npm ci --omit=dev (إنتاج فقط)                       │
│     ├── npm run build                                       │
│     └── ❌ إذا فشل → استعادة تلقائية!                        │
│                                                             │
│  5️⃣ تشغيل بدون توقف (Zero-Downtime)                        │
│     └── pm2 reload (لا يوقف الموقع)                         │
│                                                             │
│  6️⃣ انتظار تأكيدك                                          │
│     └── "اختبر موقعك ثم اكتب yes أو no"                     │
│                                                             │
│  7️⃣ حسب ردك:                                               │
│     ├── yes → حفظ التحديثات ✅                               │
│     └── no → استعادة النسخة القديمة ↩️                       │
└─────────────────────────────────────────────────────────────┘
```

### مميزات السكربت الجديد:
| الميزة | الوصف |
|--------|-------|
| **Zero-Downtime** | لا يوقف الموقع أثناء التحديث (pm2 reload) |
| **تأكيد المستخدم** | ينتظر موافقتك قبل الإنهاء (5 دقائق timeout) |
| **استعادة تلقائية** | يستعيد النسخة القديمة عند الفشل أو timeout |
| **.env آمن** | لا يعدّل ملف الإعدادات أبداً |
| **إنتاج فقط** | يثبت dependencies الإنتاج فقط |
| **استعادة يدوية** | `bash scripts/update.sh --rollback` |

### ⚠️ ملاحظة مهمة عن قاعدة البيانات:
إذا كان التحديث يتضمن تغييرات في قاعدة البيانات (migrations)، وفشل التحديث **بعد** تطبيق الـ migrations:
- ستُستعاد البيانات من النسخة الاحتياطية
- لكن قد يكون هناك عدم توافق مؤقت بين الكود والـ schema
- **الحل**: شغّل `npm run db:push` بعد الاستعادة للتأكد من التوافق

---

## 💾 النسخ الاحتياطي / Backup

### متى تنسخ:
- قبل أي تحديث ✅
- يومياً (تلقائياً) ✅
- قبل أي تغييرات كبيرة ✅

### كيفية النسخ:
```bash
# نسخ كامل
bash scripts/backup-db.sh

# نسخ الهيكل فقط
bash scripts/backup-db.sh --schema-only

# نسخ البيانات فقط
bash scripts/backup-db.sh --data-only

# تحديد اسم الملف
bash scripts/backup-db.sh -o my_backup.sql.gz
```

### إعداد النسخ التلقائي:
```bash
# فتح crontab
crontab -e

# إضافة نسخ يومي الساعة 3 صباحاً
0 3 * * * /var/www/vex/scripts/backup-db.sh
```

---

## 🔙 الاستعادة / Restore

### متى تستعيد:
- عند فقدان البيانات
- عند الحاجة للرجوع لنسخة سابقة
- بعد خطأ في التحديث

### كيفية الاستعادة:
```bash
# عرض النسخ المتاحة واختيار واحدة
bash scripts/restore-db.sh

# استعادة ملف محدد
bash scripts/restore-db.sh /path/to/backup.sql.gz
```

⚠️ **تحذير**: الاستعادة ستستبدل جميع البيانات الحالية!

---

## 🔧 تشخيص المشاكل / Troubleshooting

### متى تستخدمه:
- عند توقف التطبيق
- عند ظهور أخطاء
- للفحص الدوري

### كيفية التشخيص:
```bash
# فحص فقط (بدون إصلاح)
bash scripts/troubleshoot.sh

# فحص مع إصلاح تلقائي
sudo bash scripts/troubleshoot.sh --fix
```

### ما يفحصه:
1. ✅ متطلبات النظام (ذاكرة، قرص)
2. ✅ Node.js و npm
3. ✅ PM2 وحالة التطبيق
4. ✅ PostgreSQL
5. ✅ Nginx
6. ✅ المنافذ (5000, 80, 443)
7. ✅ ملفات المشروع
8. ✅ شهادة SSL
9. ✅ السجلات الأخيرة

---

## ▶️ التشغيل اليدوي / Manual Start

### متى تستخدمه:
- للتشغيل المحلي
- للاختبار
- عند عدم استخدام PM2

### كيفية التشغيل:
```bash
cd /var/www/vex
bash scripts/start.sh
```

---

## 📝 أوامر سريعة / Quick Commands

بعد التثبيت، تتوفر هذه الأوامر السريعة:

```bash
# عرض حالة التطبيق
vex-status

# عرض السجلات
vex-logs
vex-logs 100   # آخر 100 سطر

# إعادة تشغيل
vex-restart

# مراقبة PM2
pm2 monit
```

---

## 🔄 سيناريوهات شائعة / Common Scenarios

### 1️⃣ التطبيق لا يعمل
```bash
# تشخيص
sudo bash scripts/troubleshoot.sh --fix

# أو إعادة تشغيل يدوية
cd /var/www/vex
export $(cat .env | grep -v '^#' | xargs)
pm2 delete vex
pm2 start "node dist/index.cjs" --name "vex"
pm2 save
```

### 2️⃣ خطأ في قاعدة البيانات
```bash
# التحقق من DATABASE_URL
cat .env | grep DATABASE_URL

# تأكد من وجود ?sslmode=disable للـ VPS
# DATABASE_URL=...@localhost:5432/vex_db?sslmode=disable

# إعادة تشغيل PostgreSQL
sudo systemctl restart postgresql

# اختبار الاتصال
bash scripts/troubleshoot.sh
```

### 3️⃣ ملف البناء مفقود (dist/index.cjs)
```bash
cd /var/www/vex

# إعادة البناء
npm run build

# التحقق
ls -la dist/index.cjs

# إعادة التشغيل
export $(cat .env | grep -v '^#' | xargs)
pm2 restart vex
```

### 4️⃣ PM2 لا يقرأ متغيرات البيئة
```bash
cd /var/www/vex

# تحميل المتغيرات وإعادة التشغيل
pm2 delete vex
export $(cat .env | grep -v '^#' | xargs)
pm2 start "node dist/index.cjs" --name "vex"
pm2 save
```

### 5️⃣ الموقع لا يظهر
```bash
# فحص Nginx
sudo nginx -t
sudo systemctl restart nginx

# فحص شهادة SSL
sudo certbot renew
```

### 6️⃣ نفاد الذاكرة
```bash
# فحص الذاكرة
free -m

# إضافة swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 7️⃣ استعادة من كارثة
```bash
# 1. تثبيت جديد
sudo bash scripts/install.sh

# 2. استعادة قاعدة البيانات
bash scripts/restore-db.sh /path/to/backup.sql.gz
```

### 8️⃣ لا يوجد مستخدم Admin
```bash
cd /var/www/vex
export $(cat .env | grep -v '^#' | xargs)
bash scripts/seed-admin.sh
```

---

## 📞 الدعم / Support

إذا واجهت مشاكل:

1. شغل `bash scripts/troubleshoot.sh`
2. راجع السجلات: `pm2 logs vex`
3. تحقق من الوثائق في `DEPLOYMENT.md`

---

## ✅ قائمة التحقق قبل النشر / Pre-Deployment Checklist

- [ ] تم إعداد اسم النطاق
- [ ] DNS يشير للسيرفر
- [ ] كلمات مرور قوية جاهزة
- [ ] نسخة احتياطية من البيانات القديمة
- [ ] تم اختبار الاتصال بالسيرفر
- [ ] تأكد من استخدام `localhost` وليس `db` في DATABASE_URL
- [ ] تأكد من وجود `?sslmode=disable` في DATABASE_URL

---

## 🔍 ملخص الإصلاحات / Fixes Summary

تم إصلاح المشاكل التالية التي كانت تظهر أثناء النشر:

| المشكلة | الإصلاح |
|---------|---------|
| `PGHOST=db` خطأ | تغيير الافتراضي إلى `localhost` |
| SSL Error مع PostgreSQL | إضافة `?sslmode=disable` |
| `dist/index.cjs` مفقود | إضافة تحقق بعد البناء |
| PM2 لا يقرأ .env | تحميل المتغيرات قبل التشغيل |
| لا يوجد مستخدم Admin | إضافة `seed-admin.sh` تلقائي |

---

**آخر تحديث / Last Updated**: January 2026
