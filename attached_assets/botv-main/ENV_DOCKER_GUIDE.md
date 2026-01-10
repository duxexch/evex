# 🔐 إدارة ملف .env في Docker - دليل سريع

## ✅ الطريقة الصحيحة (المطبقة حالياً)

### **ملف .env يبقى خارج Docker image**

```bash
# على السيرفر:
/var/www/botv/
├── .env                          # ← هنا على الـ host
├── docker-compose.prod.yml       # يقرأ .env من هنا
└── Dockerfile.api.prod           # لا ينسخ .env داخل الصورة
```

---

## 📋 كيف يعمل النظام

### 1️⃣ **Docker Compose يقرأ .env من الخارج**

```yaml
# docker-compose.prod.yml:
api:
  env_file:
    - .env  # ← يقرأ من الـ host عند التشغيل
  environment:
    DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@...
```

### 2️⃣ **المتغيرات تُمرر للـ container كـ environment variables**

```bash
# عند التشغيل:
docker compose up -d

# الـ container يستلم:
- BOT_TOKEN=xxx
- DATABASE_URL=postgresql://...
- REDIS_URL=redis://...
# إلخ...
```

### 3️⃣ **.dockerignore يمنع نسخ .env في الصورة**

```dockerignore
.env
.env.*
!.env.example
```

---

## 🚀 خطوات الإعداد على السيرفر

### **الطريقة 1: نسخ من template**
```bash
cd /var/www/botv
cp .env.production.template .env
nano .env  # تعديل القيم الحقيقية
```

### **الطريقة 2: إنشاء ملف جديد**
```bash
cd /var/www/botv
cat > .env << 'EOF'
# Bot Configuration
BOT_TOKEN=your_real_token_here
ADMIN_USER_IDS=123456789,987654321

# Database
DB_USER=langsense
DB_PASSWORD=your_secure_password_here
DB_NAME=langsense
DB_HOST=postgres
DB_PORT=5432
DATABASE_URL=postgresql+asyncpg://langsense:your_password@postgres:5432/langsense

# Redis
REDIS_PASSWORD=your_redis_password
REDIS_URL=redis://:your_redis_password@redis:6379/0

# Security
JWT_SECRET_KEY=generate_random_32_chars_here
ENCRYPTION_KEY=generate_random_32_chars_here

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO

# CORS
CORS_ORIGINS=https://yourdomain.com

# Rate Limits
USER_RATE_LIMIT=5
ADMIN_RATE_LIMIT=30
API_RATE_LIMIT=100
EOF

chmod 600 .env  # حماية الملف
```

### **التشغيل:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 🔒 الأمان

### ✅ **ما يجب فعله:**
- [x] ملف .env على الـ host فقط
- [x] استخدام `.dockerignore` لمنع نسخه
- [x] `chmod 600 .env` (قراءة فقط للمالك)
- [x] عدم رفع .env للـ git
- [x] استخدام كلمات مرور قوية

### ❌ **ما لا يجب فعله:**
- [ ] نسخ .env داخل Dockerfile (`COPY .env .`)
- [ ] استخدام `ENV` في Dockerfile للأسرار
- [ ] رفع .env لـ git
- [ ] مشاركة .env عبر الإنترنت
- [ ] استخدام كلمات مرور ضعيفة

---

## 🔍 التحقق من الإعداد

### **1. تأكد أن .env موجود على الـ host:**
```bash
ls -la /var/www/botv/.env
# يجب أن يظهر: -rw------- 1 user user 1234 Jan 6 .env
```

### **2. تأكد أن المتغيرات وصلت للـ container:**
```bash
# للـ API:
docker exec langsense-api env | grep DATABASE_URL

# للـ Bot:
docker exec langsense-bot env | grep BOT_TOKEN
```

### **3. تأكد أن .env غير موجود في الصورة:**
```bash
docker run --rm langsense-api ls -la /app/.env
# يجب أن يقول: No such file or directory ✅
```

---

## 🆚 المقارنة

| الطريقة | الأمان | المرونة | الاستخدام |
|---------|--------|---------|-----------|
| **env_file (حالياً)** ✅ | عالي | عالية | سهل التعديل بدون rebuild |
| ENV في Dockerfile ❌ | منخفض | منخفضة | يحتاج rebuild لكل تغيير |
| Docker secrets 🔐 | عالي جداً | متوسطة | للـ production المعقد |

---

## 📝 ملفات .env المتاحة

```bash
.env                        # الملف النشط (مخصص)
.env.example               # نموذج للمطورين
.env.production            # قيم الإنتاج (نموذج)
.env.production.template   # Template للنسخ
```

### **استخدام:**
```bash
# للتطوير:
cp .env.example .env

# للإنتاج:
cp .env.production.template .env
# ثم تعديل القيم الحقيقية
```

---

## 🎯 الخلاصة

### **✅ نعم، ملف .env خارجي ويجب ضبطه على السيرفر:**

1. **إنشاء .env على السيرفر** من template
2. **تعديل القيم** بالبيانات الحقيقية
3. **حماية الملف** بـ `chmod 600`
4. **Docker Compose يقرأه تلقائياً** عند التشغيل
5. **.dockerignore يمنع نسخه** في الصورة

### **لا تحتاج:**
- ❌ نسخ .env داخل Dockerfile
- ❌ إعادة build عند تغيير المتغيرات
- ❌ تضمين الأسرار في الصورة

---

**تم إضافة `.dockerignore` للمشروع لحماية الملفات الحساسة** ✅
