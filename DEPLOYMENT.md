# دليل نشر VEX على Hostinger VPS
# VEX Deployment Guide for Hostinger VPS

هذا الدليل يشرح خطوة بخطوة كيفية نشر مشروع VEX على سيرفر Hostinger VPS.
يمكن لأي شخص غير مبرمج اتباع هذه الخطوات.

---

## المتطلبات الأساسية

قبل البدء، تأكد من توفر:

1. **سيرفر VPS من Hostinger** - Ubuntu 22.04 أو أحدث (مُوصى به: 2GB RAM على الأقل)
2. **اسم نطاق (Domain)** - مثل: `yourdomain.com`
3. **بيانات الدخول SSH** - اسم المستخدم وكلمة المرور أو المفتاح
4. **برنامج SSH** - مثل PuTTY (Windows) أو Terminal (Mac/Linux)

---

## الخطوة 1: الاتصال بالسيرفر

### على Windows:
1. حمّل برنامج [PuTTY](https://www.putty.org/)
2. افتح PuTTY وأدخل عنوان IP الخاص بسيرفرك
3. اضغط "Open" ثم أدخل اسم المستخدم (عادةً `root`) وكلمة المرور

### على Mac/Linux:
افتح Terminal واكتب:
```bash
ssh root@YOUR_SERVER_IP
```
استبدل `YOUR_SERVER_IP` بعنوان IP سيرفرك.

---

## الخطوة 2: تحديث النظام وتثبيت الأدوات الأساسية

انسخ والصق الأوامر التالية واحدة تلو الأخرى:

```bash
# تحديث قائمة الحزم
sudo apt update

# تحديث جميع الحزم المثبتة
sudo apt upgrade -y

# تثبيت الأدوات الأساسية
sudo apt install -y curl wget git build-essential
```

**إذا ظهر خطأ:**
- `Permission denied` → تأكد أنك دخلت بـ root أو استخدم `sudo` قبل الأمر
- `Unable to locate package` → شغّل `sudo apt update` أولاً

---

## الخطوة 3: تثبيت Node.js 20

```bash
# إضافة مستودع NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# تثبيت Node.js
sudo apt install -y nodejs

# التحقق من التثبيت
node --version
npm --version
```

**يجب أن ترى:**
- Node.js: `v20.x.x`
- npm: `10.x.x`

**إذا ظهر خطأ:**
- `node: command not found` → أعد تشغيل الأمر الأول
- `EACCES permission denied` → شغّل `sudo npm install -g npm`

---

## الخطوة 4: تثبيت PostgreSQL

```bash
# تثبيت PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# بدء الخدمة
sudo systemctl start postgresql
sudo systemctl enable postgresql

# التحقق من الحالة
sudo systemctl status postgresql
```

**يجب أن ترى:** `Active: active (running)`

### إنشاء قاعدة البيانات والمستخدم:

```bash
# الدخول إلى PostgreSQL
sudo -u postgres psql

# داخل PostgreSQL، اكتب الأوامر التالية:
```

```sql
-- إنشاء مستخدم للتطبيق (غيّر YOUR_PASSWORD بكلمة مرور قوية)
CREATE USER vex_user WITH PASSWORD 'YOUR_PASSWORD';

-- إنشاء قاعدة البيانات
CREATE DATABASE vex_db OWNER vex_user;

-- منح الصلاحيات
GRANT ALL PRIVILEGES ON DATABASE vex_db TO vex_user;

-- الخروج
\q
```

**احتفظ بهذه المعلومات:**
- اسم المستخدم: `vex_user`
- كلمة المرور: `YOUR_PASSWORD` (التي اخترتها)
- اسم قاعدة البيانات: `vex_db`

**إذا ظهر خطأ:**
- `role already exists` → المستخدم موجود مسبقاً، تابع للخطوة التالية
- `permission denied` → تأكد أنك تستخدم `sudo -u postgres psql`

---

## الخطوة 5: تثبيت Nginx

```bash
# تثبيت Nginx
sudo apt install -y nginx

# بدء الخدمة
sudo systemctl start nginx
sudo systemctl enable nginx

# التحقق من الحالة
sudo systemctl status nginx
```

**للاختبار:** افتح متصفحك وادخل عنوان IP السيرفر - يجب أن ترى صفحة Nginx الافتراضية.

---

## الخطوة 6: تثبيت PM2 (مدير العمليات)

```bash
# تثبيت PM2 عالمياً
sudo npm install -g pm2

# التحقق من التثبيت
pm2 --version
```

---

## الخطوة 7: إعداد جدار الحماية (Firewall)

```bash
# تفعيل UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# التحقق من الحالة
sudo ufw status
```

**يجب أن ترى:** OpenSSH و Nginx Full مسموح بهما

---

## الخطوة 8: رفع المشروع للسيرفر

### الطريقة 1: باستخدام Git (مُوصى بها)

```bash
# إنشاء مجلد للتطبيق
sudo mkdir -p /var/www/vex
cd /var/www/vex

# استنساخ المشروع (استبدل بـ رابط مستودعك)
sudo git clone YOUR_REPOSITORY_URL .
```

### الطريقة 2: رفع الملفات يدوياً

1. استخدم برنامج مثل [FileZilla](https://filezilla-project.org/)
2. اتصل بالسيرفر عبر SFTP
3. ارفع ملفات المشروع إلى `/var/www/vex`

---

## الخطوة 9: إعداد المتغيرات البيئية

```bash
# الانتقال لمجلد المشروع
cd /var/www/vex

# إنشاء ملف البيئة
sudo nano .env
```

**أضف المحتوى التالي (عدّل القيم حسب إعداداتك):**

```env
# ==================== إعدادات أساسية ====================
NODE_ENV=production
PORT=5000

# ==================== قاعدة البيانات ====================
# صيغة الرابط: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://vex_user:YOUR_PASSWORD@localhost:5432/vex_db

# ==================== الأمان ====================
# مفتاح سري طويل وعشوائي (32 حرف على الأقل)
# يمكنك توليده من: https://randomkeygen.com/
SESSION_SECRET=اكتب_مفتاح_سري_طويل_وعشوائي_هنا_32_حرف_على_الأقل
JWT_SECRET=اكتب_مفتاح_jwt_سري_طويل_وعشوائي_هنا

# ==================== النطاق ====================
# عنوان موقعك الكامل
APP_URL=https://yourdomain.com
```

**لحفظ الملف:**
- اضغط `Ctrl + X`
- اضغط `Y` للتأكيد
- اضغط `Enter`

### شرح المتغيرات:

| المتغير | الوصف | مثال |
|---------|-------|------|
| `NODE_ENV` | وضع التشغيل | `production` |
| `PORT` | منفذ التطبيق | `5000` |
| `DATABASE_URL` | رابط قاعدة البيانات | `postgresql://user:pass@localhost:5432/db` |
| `SESSION_SECRET` | مفتاح تشفير الجلسات | سلسلة عشوائية طويلة |
| `JWT_SECRET` | مفتاح JWT | سلسلة عشوائية طويلة |
| `APP_URL` | عنوان الموقع | `https://yourdomain.com` |

---

## الخطوة 10: تثبيت المكتبات وبناء المشروع

```bash
cd /var/www/vex

# تثبيت المكتبات
npm install

# بناء المشروع للإنتاج
npm run build

# تشغيل migrations قاعدة البيانات
npm run db:push
```

**إذا ظهر خطأ:**
- `npm ERR! code ENOENT` → تأكد أنك في المجلد الصحيح: `cd /var/www/vex`
- `FATAL: password authentication failed` → تحقق من كلمة مرور PostgreSQL في DATABASE_URL
- `connection refused` → تأكد أن PostgreSQL يعمل: `sudo systemctl status postgresql`

---

## الخطوة 11: تشغيل التطبيق بـ PM2

```bash
cd /var/www/vex

# تشغيل التطبيق
pm2 start npm --name "vex" -- start

# التحقق من الحالة
pm2 status

# لعرض السجلات
pm2 logs vex

# حفظ الإعدادات للتشغيل التلقائي عند إعادة تشغيل السيرفر
pm2 startup
pm2 save
```

**أوامر PM2 المفيدة:**

| الأمر | الوظيفة |
|-------|---------|
| `pm2 status` | عرض حالة التطبيقات |
| `pm2 logs vex` | عرض السجلات |
| `pm2 restart vex` | إعادة تشغيل التطبيق |
| `pm2 stop vex` | إيقاف التطبيق |
| `pm2 delete vex` | حذف التطبيق |

---

## الخطوة 12: إعداد Nginx

```bash
# إنشاء ملف تكوين Nginx
sudo nano /etc/nginx/sites-available/vex
```

**أضف المحتوى التالي (استبدل yourdomain.com بنطاقك):**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # الحد الأقصى لحجم الملفات المرفوعة
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

**حفظ وتفعيل:**

```bash
# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/vex /etc/nginx/sites-enabled/

# حذف الموقع الافتراضي
sudo rm /etc/nginx/sites-enabled/default

# اختبار التكوين
sudo nginx -t

# إعادة تشغيل Nginx
sudo systemctl reload nginx
```

**إذا ظهر خطأ في `nginx -t`:**
- تحقق من الأقواس والفواصل المنقوطة في الملف
- تأكد من عدم وجود أخطاء إملائية

---

## الخطوة 13: تفعيل HTTPS (SSL)

```bash
# تثبيت Certbot
sudo apt install -y certbot python3-certbot-nginx

# الحصول على شهادة SSL (استبدل بنطاقك وإيميلك)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# اتبع التعليمات:
# 1. أدخل بريدك الإلكتروني
# 2. اقبل الشروط (Y)
# 3. اختر إعادة التوجيه التلقائي لـ HTTPS (2)
```

**التجديد التلقائي:**
```bash
# اختبار التجديد
sudo certbot renew --dry-run

# التجديد يتم تلقائياً، لكن يمكنك إضافة cron job:
sudo crontab -e
# أضف السطر التالي:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## الخطوة 14: إعداد النطاق في Hostinger

1. سجّل دخول إلى لوحة تحكم Hostinger
2. اذهب إلى **Domains** → **DNS Zone**
3. أضف سجل A Record:
   - **Name:** `@`
   - **Points to:** عنوان IP السيرفر
   - **TTL:** 14400
4. أضف سجل A Record للـ www:
   - **Name:** `www`
   - **Points to:** عنوان IP السيرفر
   - **TTL:** 14400
5. انتظر حتى 24 ساعة لتفعيل DNS

---

## دليل حل المشاكل الشائعة

### 1. التطبيق لا يعمل

```bash
# تحقق من حالة PM2
pm2 status

# اعرض السجلات
pm2 logs vex --lines 50

# أعد تشغيل التطبيق
pm2 restart vex
```

**أسباب شائعة:**
- خطأ في ملف `.env`
- قاعدة البيانات لا تعمل
- خطأ في الكود

### 2. خطأ في الاتصال بقاعدة البيانات

```bash
# تحقق من حالة PostgreSQL
sudo systemctl status postgresql

# إذا لم تكن تعمل
sudo systemctl start postgresql

# اختبر الاتصال
sudo -u postgres psql -c "SELECT 1;"
```

**حلول:**
- تحقق من `DATABASE_URL` في `.env`
- تأكد من كلمة المرور الصحيحة
- تأكد أن المستخدم والقاعدة موجودين

### 3. الموقع لا يفتح

```bash
# تحقق من Nginx
sudo nginx -t
sudo systemctl status nginx

# تحقق من جدار الحماية
sudo ufw status

# تحقق من التطبيق
curl http://localhost:5000
```

### 4. خطأ 502 Bad Gateway

```bash
# السبب الأكثر شيوعاً: التطبيق لا يعمل
pm2 status
pm2 restart vex

# تحقق من المنفذ
netstat -tlnp | grep 5000
```

### 5. خطأ 504 Gateway Timeout

```bash
# زد وقت الانتظار في Nginx
sudo nano /etc/nginx/sites-available/vex

# أضف داخل location /:
proxy_connect_timeout 300;
proxy_send_timeout 300;
proxy_read_timeout 300;

# أعد تشغيل Nginx
sudo systemctl reload nginx
```

### 6. نفاد الذاكرة (Memory)

```bash
# تحقق من الذاكرة
free -m

# أنشئ swap file (إذا لم يكن موجوداً)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# للتفعيل الدائم
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 7. مشاكل الصلاحيات

```bash
# إصلاح صلاحيات مجلد المشروع
sudo chown -R $USER:$USER /var/www/vex
sudo chmod -R 755 /var/www/vex
```

### 8. SSL لا يعمل

```bash
# أعد تثبيت الشهادة
sudo certbot --nginx -d yourdomain.com

# تحقق من الشهادة
sudo certbot certificates

# إذا انتهت الصلاحية
sudo certbot renew
```

### 9. WebSocket لا يعمل

تأكد من إعداد Nginx الصحيح للـ WebSocket:

```nginx
location /ws {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### 10. التطبيق بطيء

```bash
# تحقق من استخدام الموارد
htop

# أعد تشغيل الخدمات
pm2 restart vex
sudo systemctl restart nginx
sudo systemctl restart postgresql
```

---

## أوامر مفيدة للصيانة

```bash
# تحديث المشروع من Git
cd /var/www/vex
git pull
npm install
npm run build
pm2 restart vex

# نسخ احتياطي لقاعدة البيانات
pg_dump -U vex_user vex_db > backup_$(date +%Y%m%d).sql

# استعادة النسخة الاحتياطية
psql -U vex_user vex_db < backup_file.sql

# مراقبة استخدام الموارد
htop

# مراقبة مساحة القرص
df -h

# عرض سجلات النظام
sudo journalctl -xe
```

---

## قائمة التحقق النهائية

قبل الإعلان عن جاهزية الموقع، تحقق من:

- [ ] التطبيق يعمل: `pm2 status` يُظهر "online"
- [ ] الموقع يفتح: `https://yourdomain.com`
- [ ] HTTPS مفعّل: يظهر قفل أخضر في المتصفح
- [ ] تسجيل الدخول يعمل
- [ ] قاعدة البيانات تعمل
- [ ] WebSocket يعمل (الدردشة/الألعاب)
- [ ] التشغيل التلقائي مفعّل: `pm2 startup` و `pm2 save`

---

## الدعم والمساعدة

إذا واجهت مشكلة:

1. راجع سجلات التطبيق: `pm2 logs vex`
2. راجع سجلات Nginx: `sudo tail -f /var/log/nginx/error.log`
3. راجع سجلات النظام: `sudo journalctl -xe`

---

تم إعداد هذا الدليل بتاريخ: يناير 2026
