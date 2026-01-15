# دليل ترتيب تشغيل السكريبتات
# VEX Scripts Execution Order Guide

هذا الملف يشرح ترتيب تشغيل السكريبتات ووظيفة كل واحد منها.
This file explains the order of running scripts and the function of each one.

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
8. ✅ يبني المشروع
9. ✅ يعد شهادة SSL
10. ✅ يشغل التطبيق

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

### ماذا يفعل update.sh:
1. ✅ ينشئ نسخة احتياطية
2. ✅ يسحب آخر التغييرات من git
3. ✅ يحدث المكتبات
4. ✅ يعيد بناء المشروع
5. ✅ يشغل الترحيلات
6. ✅ يعيد تشغيل التطبيق

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
pm2 restart vex
```

### 2️⃣ قاعدة البيانات لا تعمل
```bash
# التحقق من PostgreSQL
sudo systemctl status postgresql

# إعادة تشغيل PostgreSQL
sudo systemctl restart postgresql

# التحقق من الاتصال
bash scripts/troubleshoot.sh
```

### 3️⃣ الموقع لا يظهر
```bash
# فحص Nginx
sudo nginx -t
sudo systemctl restart nginx

# فحص شهادة SSL
sudo certbot renew
```

### 4️⃣ نفاد الذاكرة
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

### 5️⃣ استعادة من كارثة
```bash
# 1. تثبيت جديد
sudo bash scripts/install.sh

# 2. استعادة قاعدة البيانات
bash scripts/restore-db.sh /path/to/backup.sql.gz
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

---

**آخر تحديث / Last Updated**: January 2026
