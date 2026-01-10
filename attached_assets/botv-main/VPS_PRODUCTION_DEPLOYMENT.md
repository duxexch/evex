# 🚀 دليل النشر الاحترافي - Ubuntu 24.04 LTS VPS

## المتطلبات الأساسية
- Ubuntu 24.04 LTS VPS
- صلاحيات root أو sudo
- اتصال إنترنت مستقر
- BOT_TOKEN من [@BotFather](https://t.me/BotFather)

---

## 📋 الخطوة 1: تحديث النظام وتثبيت المتطلبات الأساسية

```bash
# تسجيل الدخول كـ root
sudo su -

# تحديث النظام بالكامل
apt update && apt upgrade -y

# تثبيت الأدوات الأساسية
apt install -y \
    git \
    curl \
    wget \
    nano \
    vim \
    htop \
    net-tools \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    build-essential \
    python3-dev \
    libpq-dev \
    ufw

# تفعيل الـ Firewall (اختياري)
ufw allow ssh
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
ufw --force enable
ufw status
```

---

## 📋 الخطوة 2: تثبيت Docker و Docker Compose

```bash
# إزالة نسخ Docker القديمة
apt remove -y docker docker-engine docker.io containerd runc

# إضافة مفتاح GPG الرسمي لـ Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# إضافة مستودع Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# تحديث القائمة وتثبيت Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# تفعيل Docker للبدء التلقائي
systemctl enable docker
systemctl start docker
systemctl status docker

# التحقق من التثبيت
docker --version
docker compose version
```

---

## 📋 الخطوة 3: تثبيت PostgreSQL 16

```bash
# إضافة مستودع PostgreSQL الرسمي
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# تحديث وتثبيت PostgreSQL 16
apt update
apt install -y postgresql-16 postgresql-contrib-16

# تفعيل PostgreSQL
systemctl enable postgresql
systemctl start postgresql
systemctl status postgresql

# التحقق من النسخة
sudo -u postgres psql --version
```

---

## 📋 الخطوة 4: تثبيت Redis 7

```bash
# تثبيت Redis
apt install -y redis-server

# تعديل إعدادات Redis للإنتاج
sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sed -i 's/# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sed -i 's/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

# تفعيل Redis
systemctl enable redis-server
systemctl restart redis-server
systemctl status redis-server

# التحقق من التثبيت
redis-cli ping
# يجب أن يرجع: PONG
```

---

## 📋 الخطوة 5: إنشاء قاعدة البيانات والمستخدم

```bash
# إنشاء قاعدة بيانات المشروع
sudo -u postgres psql << EOF
CREATE DATABASE dotv;
CREATE USER dotv WITH PASSWORD 'm784951m';
GRANT ALL PRIVILEGES ON DATABASE dotv TO dotv;
ALTER DATABASE dotv OWNER TO dotv;

-- منح صلاحيات إضافية (PostgreSQL 15+)
\c dotv
GRANT ALL ON SCHEMA public TO dotv;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dotv;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dotv;

-- عرض قواعد البيانات
\l

-- الخروج
\q
EOF

# التحقق من الاتصال
PGPASSWORD=m784951m psql -h localhost -U dotv -d dotv -c "SELECT version();"
```

---

## 📋 الخطوة 6: استنساخ المشروع من GitHub

```bash
# إنشاء مجلد المشاريع
mkdir -p /var/www
cd /var/www

# حذف أي نسخة قديمة (إذا وُجدت)
rm -rf botv

# استنساخ المشروع
git clone https://github.com/promnes/botv.git
cd botv

# التحقق من الفرع الحالي
git branch
git log --oneline -3

# عرض الملفات
ls -la
```

---

## 📋 الخطوة 7: إعداد ملف البيئة (.env)

```bash
cd /var/www/botv

# إنشاء ملف .env
cat > .env << 'ENVEOF'
# .env - Production Configuration
# ✅ CRITICAL: This file contains sensitive data

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
DB_CONNECTION=pgsql
DB_HOST=host.docker.internal
DB_PORT=5432
DB_DATABASE=dotv
DB_USERNAME=dotv
DB_PASSWORD=m784951m
DATABASE_URL=postgresql+asyncpg://dotv:m784951m@host.docker.internal:5432/dotv

# ============================================================================
# REDIS CACHE
# ============================================================================
REDIS_PASSWORD=
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379/0

# ============================================================================
# API & SERVER
# ============================================================================
PORT=8000
API_PORT=8000
ENVIRONMENT=production
LOG_LEVEL=info
LOG_FILE=bot.log

# ============================================================================
# SECURITY (✅ Secure random keys)
# ============================================================================
ENCRYPTION_KEY=JOZzhl3QQpPiRUpnGl/lo3Mv1ocTMVKeqn4oLyDfUtA=
JWT_SECRET_KEY=YaKNSKJIGU8/jE4kvMFICySybT0YO5BbYMtV/IEnHxw=
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# ============================================================================
# BOT CONFIGURATION
# ============================================================================
BOT_TOKEN=8549135277:AAHxriOUTxrT7lHXzXQsuxe327gMXXScZko
ADMIN_USER_IDS=7146701713

# ============================================================================
# CORS & ALLOWED ORIGINS
# ============================================================================
CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000
FORCE_HTTPS=false
ALLOWED_HOSTS=localhost,127.0.0.1

# ============================================================================
# BROADCAST CONFIGURATION
# ============================================================================
BROADCAST_RATE_LIMIT=30
BROADCAST_CHUNK_SIZE=100
BROADCAST_RETRY_ATTEMPTS=3
BROADCAST_RETRY_DELAY=5

# ============================================================================
# FINANCIAL LIMITS
# ============================================================================
MIN_DEPOSIT=50
MAX_DEPOSIT=10000
MIN_WITHDRAWAL=100
MAX_DAILY_WITHDRAWAL=10000

# ============================================================================
# RATE LIMITING
# ============================================================================
USER_RATE_LIMIT=40
ADMIN_RATE_LIMIT=30
API_RATE_LIMIT=100
DEPOSIT_RATE_LIMIT=10
WITHDRAWAL_RATE_LIMIT=10

# ============================================================================
# LOCALIZATION
# ============================================================================
DEFAULT_LANGUAGE=ar
DEFAULT_COUNTRY=SA

# ============================================================================
# PAGINATION
# ============================================================================
USERS_PER_PAGE=10
ANNOUNCEMENTS_PER_PAGE=5
TRANSACTIONS_PER_PAGE=20

# ============================================================================
# FILE UPLOAD
# ============================================================================
MAX_FILE_SIZE=20
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp

# ============================================================================
# CUSTOMER ID
# ============================================================================
CUSTOMER_ID_PREFIX=C
CUSTOMER_ID_YEAR_FORMAT=2025
ENVEOF

# حماية ملف .env
chmod 600 .env

# التحقق من المحتوى
cat .env | head -20
```

---

## 📋 الخطوة 8: بناء وتشغيل Docker Containers

```bash
cd /var/www/botv

# إنشاء مجلد السجلات
mkdir -p logs
chmod 755 logs

# إيقاف أي حاويات قديمة
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.local-db.yml down 2>/dev/null || true
docker rm -f $(docker ps -aq) 2>/dev/null || true

# بناء الصور (يستغرق 3-5 دقائق)
docker compose -f docker-compose.local-db.yml build --no-cache

# تشغيل الحاويات في الخلفية
docker compose -f docker-compose.local-db.yml up -d

# الانتظار 30 ثانية لبدء الخدمات
sleep 30

# عرض حالة الحاويات
docker compose -f docker-compose.local-db.yml ps
```

---

## 📋 الخطوة 9: التحقق من التشغيل الصحيح

```bash
# 1. عرض سجلات API
docker logs langsense-api --tail 50

# 2. عرض سجلات البوت
docker logs langsense-bot --tail 50

# 3. اختبار API Health Check
curl http://localhost:8000/health
# المتوقع: {"status":"healthy"}

# 4. التحقق من الاتصال بقاعدة البيانات
docker exec langsense-api python -c "
from sqlalchemy import create_engine
engine = create_engine('postgresql+asyncpg://dotv:m784951m@host.docker.internal:5432/dotv'.replace('asyncpg', 'psycopg2'))
conn = engine.connect()
print('✅ Database connection successful')
conn.close()
" 2>/dev/null && echo "✅ DB OK" || echo "❌ DB Failed"

# 5. التحقق من Redis
redis-cli -h localhost -p 6379 ping

# 6. عرض استخدام الموارد
docker stats --no-stream

# 7. فحص الشبكة
docker network ls
docker network inspect botv_langsense-network
```

---

## 📋 الخطوة 10: تشغيل الهجرات (Migrations)

```bash
cd /var/www/botv

# تشغيل هجرات قاعدة البيانات
docker exec -it langsense-api alembic upgrade head

# أو يدوياً:
docker exec -it langsense-api python -c "
from alembic.config import Config
from alembic import command
alembic_cfg = Config('alembic.ini')
command.upgrade(alembic_cfg, 'head')
print('✅ Migrations completed')
"
```

---

## 📋 الخطوة 11: اختبار البوت على Telegram

```bash
# 1. احصل على معلومات البوت
curl -X GET "https://api.telegram.org/bot8549135277:AAHxriOUTxrT7lHXzXQsuxe327gMXXScZko/getMe"

# 2. افتح Telegram وابحث عن البوت
# 3. أرسل الأمر: /start
# 4. تحقق من السجلات:
docker logs langsense-bot --tail 100 -f
```

---

## 🔧 أوامر الإدارة اليومية

### عرض حالة الخدمات
```bash
cd /var/www/botv
docker compose -f docker-compose.local-db.yml ps
systemctl status postgresql redis-server
```

### إعادة تشغيل الخدمات
```bash
# إعادة تشغيل جميع الحاويات
docker compose -f docker-compose.local-db.yml restart

# إعادة تشغيل البوت فقط
docker compose -f docker-compose.local-db.yml restart bot

# إعادة تشغيل API فقط
docker compose -f docker-compose.local-db.yml restart api
```

### عرض السجلات المباشرة
```bash
# سجلات البوت (مباشر)
docker logs -f langsense-bot

# سجلات API (مباشر)
docker logs -f langsense-api

# سجلات جميع الحاويات
docker compose -f docker-compose.local-db.yml logs -f
```

### تحديث المشروع
```bash
cd /var/www/botv
git pull origin main
docker compose -f docker-compose.local-db.yml down
docker compose -f docker-compose.local-db.yml build --no-cache
docker compose -f docker-compose.local-db.yml up -d
```

### نسخ احتياطي لقاعدة البيانات
```bash
# إنشاء نسخة احتياطية
sudo -u postgres pg_dump dotv > /root/backups/dotv_$(date +%Y%m%d_%H%M%S).sql

# استعادة نسخة احتياطية
sudo -u postgres psql dotv < /root/backups/dotv_20260105_120000.sql
```

### تنظيف Docker
```bash
# إزالة الحاويات المتوقفة
docker container prune -f

# إزالة الصور غير المستخدمة
docker image prune -a -f

# إزالة الأحجام غير المستخدمة
docker volume prune -f

# تنظيف شامل
docker system prune -a -f --volumes
```

---

## 🛡️ أمان إضافي (اختياري ولكن موصى به)

### تثبيت Fail2Ban
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### إعداد SSL مع Let's Encrypt (إذا كان لديك دومين)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### إعداد Nginx كـ Reverse Proxy
```bash
apt install -y nginx

cat > /etc/nginx/sites-available/botv << 'NGINXEOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF

ln -s /etc/nginx/sites-available/botv /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 📊 مراقبة الأداء

```bash
# استخدام الموارد
htop

# استخدام Docker
docker stats

# مساحة القرص
df -h

# حجم السجلات
du -sh /var/www/botv/logs/*

# اتصالات الشبكة
netstat -tulpn | grep -E '(8000|6379|5432)'
```

---

## ❌ استكشاف الأخطاء

### البوت لا يستجيب
```bash
# تحقق من السجلات
docker logs langsense-bot --tail 100

# تحقق من BOT_TOKEN
grep BOT_TOKEN /var/www/botv/.env

# أعد تشغيل البوت
docker compose -f docker-compose.local-db.yml restart bot
```

### API لا يعمل
```bash
# تحقق من المنفذ 8000
netstat -tulpn | grep 8000

# تحقق من السجلات
docker logs langsense-api --tail 100

# اختبار الاتصال
curl -v http://localhost:8000/health
```

### فشل الاتصال بقاعدة البيانات
```bash
# تحقق من PostgreSQL
systemctl status postgresql

# اختبار الاتصال
PGPASSWORD=m784951m psql -h localhost -U dotv -d dotv -c "SELECT 1"

# تحقق من الـ host.docker.internal
docker exec langsense-api ping -c 3 host.docker.internal
```

---

## ✅ قائمة التحقق النهائية

- [ ] PostgreSQL يعمل (`systemctl status postgresql`)
- [ ] Redis يعمل (`systemctl status redis-server`)
- [ ] Docker يعمل (`systemctl status docker`)
- [ ] قاعدة البيانات `dotv` موجودة
- [ ] ملف `.env` محدّث وآمن (chmod 600)
- [ ] API يستجيب (`curl http://localhost:8000/health`)
- [ ] Bot يعمل ويستجيب على Telegram
- [ ] السجلات لا تحتوي على أخطاء
- [ ] Firewall مفعّل ومضبوط
- [ ] النسخ الاحتياطية مجدولة (اختياري)

---

## 📞 الدعم

في حالة وجود مشاكل:
1. تحقق من السجلات: `docker logs langsense-bot`
2. تحقق من `.env`: `cat /var/www/botv/.env`
3. تحقق من حالة الخدمات: `docker compose ps`
4. راجع قسم استكشاف الأخطاء أعلاه

---

**🎉 تهانينا! المشروع يعمل الآن في بيئة الإنتاج**
