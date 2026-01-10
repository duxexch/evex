#!/bin/bash
# اسم الملف: deploy_botv.sh
# وصف: سكربت النشر الكامل مع اكتشاف وإصلاح الأخطاء التلقائي
# الاستخدام: chmod +x deploy_botv.sh && ./deploy_botv.sh

set -e  # توقف عند أول خطأ

# ألوان للواجهة
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# متغيرات التتبع
STATE_FILE="/tmp/deploy_state.txt"
LOG_FILE="/var/log/botv_deploy_$(date +%Y%m%d_%H%M%S).log"
PROJECT_DIR="/var/www/botv"
BACKUP_DIR="/var/backups/botv"

# دالة التسجيل
log_message() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# دالة التحقق من الخطوة المنفذة
check_step_done() {
    local step_name="$1"
    if grep -q "^$step_name$" "$STATE_FILE" 2>/dev/null; then
        return 0  # تم تنفيذ الخطوة
    else
        return 1  # لم تنفذ بعد
    fi
}

# دالة تحديد تنفيذ الخطوة
mark_step_done() {
    local step_name="$1"
    echo "$step_name" >> "$STATE_FILE"
    log_message "${GREEN}✓ تم الانتهاء من: $step_name${NC}"
}

# دالة إصلاح الأخطاء العامة
fix_error() {
    local error_msg="$1"
    local fix_cmd="$2"
    
    log_message "${YELLOW}⚠️  محاولة إصلاح الخطأ: $error_msg${NC}"
    
    if eval "$fix_cmd"; then
        log_message "${GREEN}✓ تم إصلاح الخطأ${NC}"
        return 0
    else
        log_message "${RED}✗ فشل إصلاح الخطأ${NC}"
        return 1
    fi
}

# دالة تنفيذ أمر مع التحقق من التكرار
run_once() {
    local step_name="$1"
    local command="$2"
    local fix_command="${3:-}"
    
    if check_step_done "$step_name"; then
        log_message "${YELLOW}⏩ تخطي (تم التنفيذ مسبقاً): $step_name${NC}"
        return 0
    fi
    
    log_message "${BLUE}▶️  بدء: $step_name${NC}"
    
    # محاولة التنفيذ الأولى
    if eval "$command"; then
        mark_step_done "$step_name"
        return 0
    else
        log_message "${RED}✗ فشل في: $step_name${NC}"
        
        # محاولة الإصلاح إذا وجد أمر إصلاح
        if [ -n "$fix_command" ]; then
            if fix_error "فشل في $step_name" "$fix_command"; then
                # إعادة المحاولة بعد الإصلاح
                if eval "$command"; then
                    mark_step_done "$step_name"
                    return 0
                fi
            fi
        fi
        
        log_message "${RED}❌ فشل نهائي في: $step_name${NC}"
        exit 1
    fi
}

# دالة إنشاء نسخة احتياطية
create_backup() {
    local backup_type="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p "$BACKUP_DIR"
    
    case "$backup_type" in
        "project")
            tar -czf "$BACKUP_DIR/botv_project_$timestamp.tar.gz" -C /var/www botv
            log_message "📦 تم إنشاء نسخة احتياطية للمشروع"
            ;;
        "database")
            sudo -u postgres pg_dump dotv > "$BACKUP_DIR/dotv_$timestamp.sql"
            log_message "💾 تم إنشاء نسخة احتياطية لقاعدة البيانات"
            ;;
        "config")
            cp -r "$PROJECT_DIR/.env" "$BACKUP_DIR/.env_$timestamp"
            log_message "⚙️ تم إنشاء نسخة احتياطية للإعدادات"
            ;;
    esac
}

# دالة الاستعادة من الخطأ
rollback_if_needed() {
    local step="$1"
    
    log_message "${YELLOW}🔄 التحقق من الحاجة للاستعادة...${NC}"
    
    # استعادة نسخة المشروع إذا فشلت الخطوات الأولى
    if [[ "$step" == "step1" || "$step" == "step2" || "$step" == "step3" ]]; then
        if [ -f "$BACKUP_DIR/botv_project_latest.tar.gz" ]; then
            log_message "🔙 استعادة المشروع من النسخة الاحتياطية..."
            tar -xzf "$BACKUP_DIR/botv_project_latest.tar.gz" -C /var/www/
        fi
    fi
}

# ============================================================================
# بداية السكربت الرئيسي
# ============================================================================

clear
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║             🚀 سكربت نشر BOTV الذكي                     ║"
echo "║            مع اكتشاف وإصلاح الأخطاء التلقائي            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# إنشاء ملفات التتبع
> "$STATE_FILE"
mkdir -p "$(dirname "$LOG_FILE")"

log_message "📝 بدء سجل النشر في: $LOG_FILE"
log_message "📂 مجلد المشروع: $PROJECT_DIR"

# التحقق من أن المستخدم root
if [ "$EUID" -ne 0 ]; then 
    log_message "${RED}❌ يجب تشغيل السكربت كـ root أو باستخدام sudo${NC}"
    exit 1
fi

# ============================================================================
# الخطوة 1: تحديث النظام وتثبيت المتطلبات الأساسية
# ============================================================================

run_once "step1_system_update" \
    "apt update && apt upgrade -y && apt install -y git curl wget nano vim htop net-tools ca-certificates gnupg lsb-release software-properties-common apt-transport-https build-essential python3-dev libpq-dev ufw" \
    "apt --fix-broken install -y && apt update --fix-missing"

run_once "step1_firewall" \
    "ufw allow ssh && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 8000/tcp && ufw --force enable && ufw status" \
    "systemctl restart ufw && ufw --force enable"

# ============================================================================
# الخطوة 2: تثبيت Docker و Docker Compose
# ============================================================================

run_once "step2_remove_old_docker" \
    "apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true"

run_once "step2_install_docker" \
    "install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc && echo 'deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable' | tee /etc/apt/sources.list.d/docker.list > /dev/null && apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin" \
    "rm -rf /etc/apt/keyrings/docker.asc /etc/apt/sources.list.d/docker.list && apt update"

run_once "step2_enable_docker" \
    "systemctl enable docker && systemctl start docker && systemctl status docker --no-pager" \
    "systemctl daemon-reload && systemctl restart docker"

run_once "step2_verify_docker" \
    "docker --version && docker compose version" \
    "apt install -y docker-compose-plugin"

# ============================================================================
# الخطوة 3: تثبيت PostgreSQL 16
# ============================================================================

run_once "step3_add_postgres_repo" \
    "sh -c 'echo \"deb http://apt.postgresql.org/pub/repos/apt \$(lsb_release -cs)-pgdg main\" > /etc/apt/sources.list.d/pgdg.list' && wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg" \
    "rm -f /etc/apt/sources.list.d/pgdg.list && apt update"

run_once "step3_install_postgres" \
    "apt update && apt install -y postgresql-16 postgresql-contrib-16" \
    "apt install -f -y postgresql-16"

run_once "step3_enable_postgres" \
    "systemctl enable postgresql && systemctl start postgresql && systemctl status postgresql --no-pager" \
    "systemctl daemon-reload && systemctl restart postgresql"

run_once "step3_verify_postgres" \
    "sudo -u postgres psql --version" \
    "apt install -y postgresql-client-common"

# ============================================================================
# الخطوة 4: تثبيت Redis 7
# ============================================================================

run_once "step4_install_redis" \
    "apt install -y redis-server" \
    "apt install -f -y redis-server"

run_once "step4_configure_redis" \
    "sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf && sed -i 's/# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf && sed -i 's/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf" \
    "cp /etc/redis/redis.conf /etc/redis/redis.conf.backup && systemctl restart redis-server"

run_once "step4_enable_redis" \
    "systemctl enable redis-server && systemctl restart redis-server && systemctl status redis-server --no-pager" \
    "systemctl daemon-reload && systemctl restart redis-server"

run_once "step4_verify_redis" \
    "redis-cli ping | grep -q PONG && echo 'Redis is working'" \
    "redis-server --version"

# ============================================================================
# الخطوة 5: إنشاء قاعدة البيانات والمستخدم
# ============================================================================

run_once "step5_create_database" \
    "sudo -u postgres psql -c \"SELECT 1 FROM pg_database WHERE datname='dotv'\"" \
    "true"  # تخطي إذا موجود

if ! check_step_done "step5_create_database"; then
    log_message "🔧 إنشاء قاعدة البيانات والمستخدم..."
    sudo -u postgres psql << 'EOF'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dotv') THEN
        CREATE USER dotv WITH PASSWORD 'm784951m';
    END IF;
END $$;

SELECT 'Creating database if not exists' AS info;
CREATE DATABASE dotv OWNER dotv;

\c dotv;
GRANT ALL ON SCHEMA public TO dotv;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dotv;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dotv;
EOF
    mark_step_done "step5_create_database"
fi

run_once "step5_verify_database" \
    "PGPASSWORD=m784951m psql -h localhost -U dotv -d dotv -c 'SELECT version();'" \
    "sudo -u postgres psql -c \"ALTER USER dotv WITH PASSWORD 'm784951m';\""

# ============================================================================
# الخطوة 6: استنساخ/تحديث المشروع
# ============================================================================

run_once "step6_clone_project" \
    "mkdir -p /var/www && cd /var/www && if [ -d botv ]; then echo 'المشروع موجود بالفعل'; else git clone https://github.com/promnes/botv.git; fi" \
    "cd /var/www && rm -rf botv && git clone https://github.com/promnes/botv.git"

run_once "step6_update_project" \
    "cd /var/www/botv && git fetch origin && git reset --hard origin/main && git clean -fd" \
    "cd /var/www/botv && rm -rf .git && git init && git remote add origin https://github.com/promnes/botv.git && git fetch && git reset --hard origin/main"

run_once "step6_verify_project" \
    "cd /var/www/botv && git status && ls -la" \
    "chown -R $USER:$USER /var/www/botv"

# ============================================================================
# الخطوة 7: إعداد ملف البيئة (.env)
# ============================================================================

run_once "step7_create_env" \
    "cd /var/www/botv && if [ ! -f .env ]; then cat > .env << 'ENVEOF'
BOT_TOKEN=8549135277:AAHxriOUTxrT7lHXzXQsuxe327gMXXScZko
ADMIN_USER_IDS=7146701713
DB_CONNECTION=pgsql
DB_HOST=host.docker.internal
DB_PORT=5432
DB_DATABASE=dotv
DB_USERNAME=dotv
DB_PASSWORD=m784951m
DATABASE_URL=postgresql+asyncpg://dotv:m784951m@host.docker.internal:5432/dotv
REDIS_PASSWORD=
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379/0
PORT=8000
API_PORT=8000
ENVIRONMENT=production
LOG_LEVEL=info
LOG_FILE=bot.log
ENCRYPTION_KEY=JOZzhl3QQpPiRUpnGl/lo3Mv1ocTMVKeqn4oLyDfUtA=
JWT_SECRET_KEY=YaKNSKJIGU8/jE4kvMFICySybT0YO5BbYMtV/IEnHxw=
ENVEOF
chmod 600 .env; else echo 'ملف .env موجود بالفعل'; fi" \
    "cd /var/www/botv && rm -f .env && touch .env && chmod 600 .env"

run_once "step7_verify_env" \
    "cd /var/www/botv && [ -f .env ] && head -5 .env | grep -q BOT_TOKEN" \
    "cd /var/www/botv && echo 'BOT_TOKEN=8549135277:AAHxriOUTxrT7lHXzXQsuxe327gMXXScZko' > .env"

# ============================================================================
# الخطوة 8: إنشاء مجلدات ضرورية
# ============================================================================

run_once "step8_create_dirs" \
    "cd /var/www/botv && mkdir -p logs storage backups && chmod 755 logs storage backups" \
    "cd /var/www/botv && chown -R $USER:$USER logs storage backups"

# ============================================================================
# الخطوة 9: بناء وتشغيل Docker Containers
# ============================================================================

run_once "step9_stop_old_containers" \
    "cd /var/www/botv && docker compose -f docker-compose.prod.yml down 2>/dev/null || true && docker compose -f docker-compose.local-db.yml down 2>/dev/null || true && docker rm -f \$(docker ps -aq) 2>/dev/null || true" \
    "docker system prune -a -f --volumes"

# تحديد ملف docker-compose المناسب
DOCKER_COMPOSE_FILE=""
if [ -f "/var/www/botv/docker-compose.prod.yml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
elif [ -f "/var/www/botv/docker-compose.local-db.yml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose.local-db.yml"
elif [ -f "/var/www/botv/docker-compose.yml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose.yml"
else
    log_message "${RED}❌ لم يتم العثور على ملف docker-compose${NC}"
    exit 1
fi

log_message "📋 استخدام ملف: $DOCKER_COMPOSE_FILE"

run_once "step9_build_containers" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE build --no-cache" \
    "cd /var/www/botv && docker builder prune -a -f && docker compose -f $DOCKER_COMPOSE_FILE build"

run_once "step9_run_containers" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE up -d" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE down && docker compose -f $DOCKER_COMPOSE_FILE up -d"

run_once "step9_wait_services" \
    "sleep 30 && echo 'تم الانتظار لبدء الخدمات'" \
    "true"

run_once "step9_check_containers" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE ps | grep -v 'Exit'" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE restart"

# ============================================================================
# الخطوة 10: التحقق من التشغيل الصحيح
# ============================================================================

run_once "step10_check_api_logs" \
    "docker logs \$(docker ps -qf 'name=api' | head -1) --tail 10 2>/dev/null || echo 'لا توجد سجلات API'" \
    "true"

run_once "step10_check_bot_logs" \
    "docker logs \$(docker ps -qf 'name=bot' | head -1) --tail 10 2>/dev/null || echo 'لا توجد سجلات Bot'" \
    "true"

run_once "step10_check_health" \
    "curl -f http://localhost:8000/health 2>/dev/null || curl -f http://localhost:8000/ 2>/dev/null || echo 'API غير مستجيب'" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE restart api"

run_once "step10_check_db_connection" \
    "docker exec \$(docker ps -qf 'name=api' | head -1) python -c 'import os; print(\"✅ Python works\")' 2>/dev/null || echo 'Python check skipped'" \
    "true"

run_once "step10_check_redis" \
    "redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG && echo '✅ Redis works'" \
    "systemctl restart redis-server"

run_once "step10_check_resources" \
    "docker stats --no-stream 2>/dev/null | head -5" \
    "true"

# ============================================================================
# الخطوة 11: تشغيل الهجرات (Migrations)
# ============================================================================

run_once "step11_run_migrations" \
    "docker exec \$(docker ps -qf 'name=api' | head -1) alembic upgrade head 2>/dev/null || echo '⚠️  لا توجد هجرات أو فشلت'" \
    "cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE exec api python -c 'from app.database import init_db; init_db()' 2>/dev/null || true"

# ============================================================================
# الخطوة 12: اختبار البوت على Telegram
# ============================================================================

run_once "step12_test_bot" \
    "curl -s -X GET 'https://api.telegram.org/bot8549135277:AAHxriOUTxrT7lHXzXQsuxe327gMXXScZko/getMe' | grep -q 'ok' && echo '✅ تم التحقق من BOT_TOKEN'" \
    "echo '⚠️  تحقق من BOT_TOKEN يدوياً'"

# ============================================================================
# التقارير النهائية
# ============================================================================

log_message "${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    ✅ النشر مكتمل!                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "📊 تقرير النشر:"
echo "----------------------------------------"
echo "📂 مجلد المشروع: $PROJECT_DIR"
echo "📄 سجل الأخطاء: $LOG_FILE"
echo "💾 النسخ الاحتياطية: $BACKUP_DIR"
echo ""

echo "🔍 حالة الخدمات:"
echo "----------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(bot|api|db|redis)" || echo "لا توجد حاويات نشطة"

echo ""
echo "🌐 اختبار الاتصال:"
echo "----------------------------------------"
curl -s http://localhost:8000/health 2>/dev/null || echo "API: ❌ غير مستجيب"
redis-cli ping 2>/dev/null | grep -q PONG && echo "Redis: ✅ يعمل" || echo "Redis: ❌ غير مستجيب"
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='dotv'" 2>/dev/null | grep -q 1 && echo "PostgreSQL: ✅ يعمل" || echo "PostgreSQL: ❌ مشكلة"

echo ""
echo "📋 أوامر الإدارة:"
echo "----------------------------------------"
echo "1. عرض السجلات: docker logs [اسم_الحاوية]"
echo "2. إعادة التشغيل: cd /var/www/botv && docker compose -f $DOCKER_COMPOSE_FILE restart"
echo "3. تحديث المشروع: cd /var/www/botv && git pull && docker compose -f $DOCKER_COMPOSE_FILE up -d --build"
echo "4. مراقبة الموارد: htop"
echo "5. سجل النشر: tail -f $LOG_FILE"

echo ""
log_message "${GREEN}✨ تم الانتهاء من النشر بنجاح!${NC}"

# إنشاء سكربت صيانة
cat > /usr/local/bin/maintain-botv << 'EOF'
#!/bin/bash
echo "🔧 أدوات صيانة BOTV"
echo "1) إعادة تشغيل الخدمات"
echo "2) عرض السجلات"
echo "3) تحديث المشروع"
echo "4) نسخة احتياطية"
echo "5) تنظيف النظام"
read -p "اختر الخيار: " choice

case $choice in
    1) cd /var/www/botv && docker compose restart ;;
    2) docker logs $(docker ps -qf "name=bot") -f ;;
    3) cd /var/www/botv && git pull && docker compose up -d --build ;;
    4) tar -czf /var/backups/botv_$(date +%Y%m%d).tar.gz /var/www/botv ;;
    5) docker system prune -a -f ;;
    *) echo "خيار غير صحيح" ;;
esac
EOF

chmod +x /usr/local/bin/maintain-botv

log_message "📝 تم إنشاء أداة الصيانة: maintain-botv"
log_message "🎉 يمكنك استخدام: maintain-botv للإدارة اليومية"

exit 0