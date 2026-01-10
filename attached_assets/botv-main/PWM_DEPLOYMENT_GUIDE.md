# 🚀 PWM Deployment Guide

## نشر نظام إدارة المشروع (PWM)

هذا الدليل يشرح كيفية نشر PWM على بيئة الإنتاج.

---

## 📋 المتطلبات

- **Docker & Docker Compose**
- **PostgreSQL 13+** (أو عبر Docker)
- **Nginx/Reverse Proxy**
- **SSL Certificate** (Let's Encrypt)

---

## 🐳 النشر عبر Docker

### 1. إعداد ملف .env.pwm

```bash
cp pwm/.env.pwm.example pwm/.env.pwm
```

قم بتحديث المتغيرات التالية:

```env
PWM_ENV=production
JWT_SECRET_KEY=<generated-secure-key>
PWM_DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/pwm_db
PWM_CORS_ORIGINS=["https://yourdomain.com", "https://pwm.yourdomain.com"]
NEXT_PUBLIC_PWM_API_BASE=https://yourdomain.com/pwm/api
```

### 2. بناء الصور

```bash
# Build PWM API image
docker build -f pwm/Dockerfile.pwm -t pwm-api:latest .

# Build PWM Web image
docker build -f pwm/frontend/Dockerfile -t pwm-web:latest ./pwm/frontend
```

### 3. تشغيل الخدمات

```bash
# Using docker-compose
docker compose -f docker-compose.prod.yml up -d pwm-api pwm-web

# Check status
docker compose -f docker-compose.prod.yml ps
```

### 4. تشغيل الهجرات

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec pwm-api \
  alembic -c database/alembic.ini upgrade head
```

---

## 🌐 Nginx Configuration

تم تحديث `nginx.conf` مع المسارات التالية:

```nginx
# PWM API
location /pwm/api/ {
    proxy_pass http://pwm-api:8011/;
    # ... proxy headers ...
}

# PWM Web
location /pwm/ {
    proxy_pass http://pwm-web:3012/;
    # ... proxy headers ...
}
```

### إعادة تحميل Nginx

```bash
docker exec <nginx-container> nginx -s reload
```

---

## 🔒 الأمان

### 1. JWT Secret Key

```bash
# Generate a secure key
openssl rand -hex 32
```

### 2. SSL/TLS

```bash
# Let's Encrypt setup
certbot certonly --standalone -d yourdomain.com
```

### 3. Database Password

استخدم كلمات مرور قوية في الإنتاج:

```env
PWM_DATABASE_URL=postgresql+asyncpg://pwm_user:STRONG_PASSWORD@postgres:5432/pwm_db
```

---

## 📊 المراقبة والصحة

### Health Check Endpoints

```bash
# API Health
curl https://yourdomain.com/pwm/api/health

# Web Health
curl https://yourdomain.com/pwm/
```

### Logs

```bash
# View API logs
docker compose -f docker-compose.prod.yml logs -f pwm-api

# View Web logs
docker compose -f docker-compose.prod.yml logs -f pwm-web
```

---

## 🔄 التحديثات والصيانة

### تحديث الصور

```bash
# Build new images
docker compose -f docker-compose.prod.yml build

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### النسخ الاحتياطي

```bash
# Backup database
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U pwm_user pwm_db > pwm_db_backup.sql

# Backup volumes
docker volume ls | grep pwm
```

---

## 📝 سجل النشر

| التاريخ | الإصدار | الملاحظات |
|--------|---------|----------|
| 2026-01-07 | 1.0.0 | النشر الأول |

---

## 🆘 استكشاف الأخطاء

### لا يمكن الاتصال بقاعدة البيانات

```bash
# تحقق من حالة PostgreSQL
docker compose ps postgres

# تحقق من السجلات
docker compose logs postgres
```

### الـ Frontend لا يحمل

```bash
# تحقق من متغيرات البيئة
docker compose -f docker-compose.prod.yml exec pwm-web env

# تحقق من الاتصال بـ API
docker compose -f docker-compose.prod.yml exec pwm-web curl http://pwm-api:8011/health
```

### مشاكل الـ CORS

تحقق من `PWM_CORS_ORIGINS` في `.env.pwm`:

```env
PWM_CORS_ORIGINS=["https://yourdomain.com", "https://pwm.yourdomain.com"]
```

---

## ✅ قائمة التحقق قبل النشر

- [ ] تغيير `JWT_SECRET_KEY` إلى قيمة آمنة
- [ ] تحديث `PWM_DATABASE_URL` ببيانات المرحلة الإنتاجية
- [ ] تحديث `PWM_CORS_ORIGINS` بالنطاقات الصحيحة
- [ ] إعداد SSL/TLS
- [ ] عمل نسخة احتياطية من قاعدة البيانات
- [ ] اختبار الهجرات
- [ ] اختبار الاتصال بـ API
- [ ] اختبار الواجهة الأمامية
- [ ] إعداد المراقبة والتنبيهات
- [ ] توثيق عملية النشر

---

**آخر تحديث**: يناير 2026
