# 🎯 LangSense PWM - دليل التشغيل السريع

## نظرة عامة
**LangSense PWM (Platform Web Management)** - لوحة تحكم ويب كاملة بدون Telegram

---

## ✅ ما تم تغييره

### التغييرات الرئيسية:
1. ✅ **إزالة Telegram Bot** - لا حاجة لـ BOT_TOKEN
2. ✅ **لوحة تحكم ويب فقط** - إدارة كاملة عبر المتصفح
3. ✅ **إزالة aiogram** من المتطلبات
4. ✅ **تبسيط Docker** - خدمة API واحدة فقط
5. ✅ **مصادقة ويب** - Admin username/password

---

## 🚀 التشغيل السريع

### **1. إعداد البيئة**

```bash
cd /var/www/botv-main

# انسخ ملف البيئة
cp .env.example .env

# عدّل الإعدادات
nano .env
```

### **2. ملف .env الجديد**

```bash
# Web Admin Configuration
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPassword123!
ADMIN_USER_IDS=1

# Database
DB_USER=langsense
DB_PASSWORD=YourSecureDBPassword123
DB_NAME=langsense
DB_HOST=localhost
DB_PORT=5432
DATABASE_URL=postgresql+asyncpg://langsense:YourSecureDBPassword123@localhost:5432/langsense

# Redis
REDIS_PASSWORD=YourRedisPassword456
REDIS_URL=redis://:YourRedisPassword456@localhost:6379/0

# Security Keys (توليد عشوائي)
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO
```

### **3. التشغيل بدون Docker**

```bash
# تثبيت PostgreSQL و Redis
sudo apt-get update
sudo apt-get install -y postgresql redis-server

# إعداد قاعدة البيانات
sudo -u postgres psql << EOF
CREATE DATABASE langsense;
CREATE USER langsense WITH PASSWORD 'YourSecureDBPassword123';
GRANT ALL PRIVILEGES ON DATABASE langsense TO langsense;
EOF

# بدء الخدمات
sudo systemctl start postgresql redis-server
sudo systemctl enable postgresql redis-server

# إنشاء البيئة الافتراضية
python3 -m venv venv
source venv/bin/activate

# تثبيت المكتبات
pip install -r requirements.txt

# تشغيل Migrations
alembic upgrade heads

# تشغيل API
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### **4. التشغيل بـ Docker**

```bash
# بناء وتشغيل
docker-compose -f docker-compose.prod.yml up -d

# عرض اللوجات
docker-compose -f docker-compose.prod.yml logs -f api

# التحقق من الحالة
docker-compose -f docker-compose.prod.yml ps
```

---

## 🌐 الوصول للوحة التحكم

### **الروابط:**
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Admin Dashboard**: http://localhost:8000/admin

### **تسجيل الدخول:**
```
Username: admin (من ADMIN_USERNAME في .env)
Password: (من ADMIN_PASSWORD في .env)
```

---

## 📊 الخدمات المتاحة

| الخدمة | البورت | الوصف |
|--------|--------|-------|
| PostgreSQL | 5432 | قاعدة البيانات |
| Redis | 6379 | Cache & Queue |
| PWM API | 8000 | لوحة التحكم الويب |

---

## 🔍 التحقق من التشغيل

```bash
# اختبار Health Check
curl http://localhost:8000/health

# النتيجة المتوقعة:
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}

# اختبار API Docs
curl http://localhost:8000/docs
```

---

## 🛠️ إدارة الخدمات

### **بدون Docker:**
```bash
# إيقاف API
pkill -f "uvicorn api.main"

# إعادة التشغيل
source venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### **مع Docker:**
```bash
# إعادة تشغيل
docker-compose -f docker-compose.prod.yml restart api

# إيقاف
docker-compose -f docker-compose.prod.yml down

# حذف البيانات
docker-compose -f docker-compose.prod.yml down -v
```

---

## 📝 الميزات المتاحة

### ✅ **إدارة المستخدمين**
- إنشاء/تعديل/حذف المستخدمين
- إدارة الأرصدة
- عرض المعاملات

### ✅ **إدارة الألعاب**
- إضافة ألعاب جديدة
- تعديل الإعدادات
- عرض الإحصائيات

### ✅ **التقارير والإحصائيات**
- تقارير مالية
- إحصائيات الألعاب
- نشاط المستخدمين

### ✅ **إدارة الشكاوى**
- عرض الشكاوى
- الرد على الشكاوى
- تتبع الحالة

---

## 🔒 الأمان

### **نقاط الأمان:**
1. ✅ **JWT Authentication** - مصادقة آمنة
2. ✅ **Password Hashing** - تشفير كلمات المرور
3. ✅ **CORS Protection** - حماية من CORS
4. ✅ **Rate Limiting** - تحديد معدل الطلبات
5. ✅ **SQL Injection Prevention** - استخدام ORM
6. ✅ **Environment Variables** - إخفاء البيانات الحساسة

---

## 🐛 استكشاف الأخطاء

### **المشكلة: API لا يعمل**
```bash
# تحقق من اللوجات
docker-compose -f docker-compose.prod.yml logs api

# أو بدون Docker
tail -f logs/api.log
```

### **المشكلة: قاعدة البيانات غير متصلة**
```bash
# تحقق من PostgreSQL
sudo systemctl status postgresql

# اختبار الاتصال
psql -U langsense -d langsense -c "SELECT 1;"
```

### **المشكلة: Redis غير متصل**
```bash
# تحقق من Redis
sudo systemctl status redis-server

# اختبار الاتصال
redis-cli ping
```

---

## 📚 الملفات الرئيسية

```
/var/www/botv-main/
├── .env                    # الإعدادات
├── config.py               # الإعدادات الرئيسية
├── requirements.txt        # المكتبات (بدون aiogram)
├── api/
│   ├── main.py            # FastAPI app
│   └── routes/            # API endpoints
├── docker-compose.prod.yml # Docker (بدون bot)
└── alembic/               # Database migrations
```

---

## 🎯 الخلاصة

### **ما لم يعد موجوداً:**
- ❌ Telegram Bot
- ❌ BOT_TOKEN requirement
- ❌ aiogram library
- ❌ Bot handlers
- ❌ Telegram-specific code

### **ما هو متاح الآن:**
- ✅ لوحة تحكم ويب كاملة
- ✅ API REST شامل
- ✅ مصادقة Admin
- ✅ إدارة شاملة عبر المتصفح
- ✅ تشغيل أبسط وأسرع

---

**المشروع الآن PWM نقي - لوحة تحكم ويب بدون Telegram!** 🚀
