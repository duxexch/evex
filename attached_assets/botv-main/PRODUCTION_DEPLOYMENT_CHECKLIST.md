# Production Deployment Checklist - Ubuntu 24.04 VPS

## 🚨 Critical Issues & Fixes

| Issue / Missing Item | Location / File | Type | Suggested Fix / Command |
|---------------------|-----------------|------|-------------------------|
| **Missing alembic.ini** | Root directory | Critical | Create Alembic config for database migrations |
| **Missing systemd service files** | /etc/systemd/system/ | Critical | Create bot.service and api.service for persistent running |
| **Missing production deployment script** | Root directory | Critical | Create `deploy.sh` orchestration script |
| **Missing nginx SSL configuration** | nginx.conf | Security | Add SSL/TLS config for HTTPS |
| **Missing health check endpoint** | api/main.py | Monitoring | Already has /health but needs testing |
| **Missing log rotation config** | /etc/logrotate.d/ | Operations | Create logrotate config for bot.log and api.log |
| **Missing backup/restore scripts** | scripts/ | Operations | Already exist but need productionization |
| **No .env production template** | Root directory | Security | .env.production exists but incomplete |
| **Missing process manager config** | Root directory | Critical | Create PM2 or systemd configs |
| **Missing firewall rules** | VPS | Security | Setup UFW rules |
| **No SSL certificates setup** | /etc/letsencrypt/ | Security | Setup certbot for Let's Encrypt |
| **Missing monitoring/alerts** | N/A | Operations | Setup basic monitoring scripts |
| **Hardcoded CORS origins** | api/main.py | Security | Uses ["*"], must restrict in production |
| **No database backup cron** | /etc/cron.d/ | Operations | Schedule automated backups |
| **Missing requirements freeze** | requirements.txt | Dependencies | Pin all dependency versions |
| **No error tracking** | All Python files | Monitoring | Add Sentry or similar error tracking |
| **Missing API docs generation** | api/main.py | Operations | FastAPI auto-docs available at /docs |
| **No rate limiting on API** | api/main.py | Security | Add SlowAPI middleware |
| **Mobile app API URL hardcoded** | mobile-app/src/constants/config.js | Critical | Must point to production domain |
| **No database connection pooling limits** | config.py | Performance | Already configured but needs tuning |

---

## 📋 Pre-Deployment Fixes Required

### 1. Create Alembic Configuration
```bash
# Generate alembic.ini
cd /workspaces/botv
cat > alembic.ini << 'EOF'
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = 

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF
```

### 2. Create Systemd Service Files

**Bot Service:**
```bash
cat > /etc/systemd/system/langsense-bot.service << 'EOF'
[Unit]
Description=LangSense Telegram Bot
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=langsense
Group=langsense
WorkingDirectory=/opt/langsense
Environment="PATH=/opt/langsense/venv/bin"
EnvironmentFile=/opt/langsense/.env
ExecStart=/opt/langsense/venv/bin/python bot.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/langsense/bot.log
StandardError=append:/var/log/langsense/bot-error.log

[Install]
WantedBy=multi-user.target
EOF
```

**API Service:**
```bash
cat > /etc/systemd/system/langsense-api.service << 'EOF'
[Unit]
Description=LangSense FastAPI Backend
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=langsense
Group=langsense
WorkingDirectory=/opt/langsense
Environment="PATH=/opt/langsense/venv/bin"
EnvironmentFile=/opt/langsense/.env
ExecStart=/opt/langsense/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10
StandardOutput=append:/var/log/langsense/api.log
StandardError=append:/var/log/langsense/api-error.log

[Install]
WantedBy=multi-user.target
EOF
```

### 3. Create Nginx Production Config with SSL
```bash
cat > /etc/nginx/sites-available/langsense << 'EOF'
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_types application/json text/plain text/css application/javascript;
    gzip_min_length 1000;
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;
    
    # Access logs
    access_log /var/log/nginx/langsense-access.log;
    error_log /var/log/nginx/langsense-error.log;
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/langsense /etc/nginx/sites-enabled/
```

### 4. Create Logrotate Configuration
```bash
cat > /etc/logrotate.d/langsense << 'EOF'
/var/log/langsense/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 langsense langsense
    sharedscripts
    postrotate
        systemctl reload langsense-bot || true
        systemctl reload langsense-api || true
    endscript
}
EOF
```

### 5. Create Production Deployment Script
```bash
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 LangSense Production Deployment Script"
echo "=========================================="

# Configuration
APP_DIR="/opt/langsense"
BACKUP_DIR="/opt/langsense/backups"
LOG_FILE="/var/log/langsense/deploy.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-flight checks
log "Running pre-flight checks..."
if [ ! -f "$APP_DIR/.env" ]; then
    error ".env file not found in $APP_DIR"
fi

if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL is not running"
fi

# Backup current database
log "Backing up database..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
sudo -u postgres pg_dump langsense > "$BACKUP_FILE"
log "Database backed up to: $BACKUP_FILE"

# Stop services
log "Stopping services..."
sudo systemctl stop langsense-bot
sudo systemctl stop langsense-api

# Pull latest code
log "Pulling latest code..."
cd "$APP_DIR"
git pull origin main || warn "Git pull failed, continuing with existing code"

# Update dependencies
log "Updating Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Run database migrations
log "Running database migrations..."
alembic upgrade head || warn "No migrations to apply"

# Update mobile app config
if [ -f "mobile-app/src/constants/config.js" ]; then
    log "Updating mobile app API URL..."
    sed -i "s|http://localhost:8000|https://api.yourdomain.com|g" mobile-app/src/constants/config.js
fi

# Restart services
log "Starting services..."
sudo systemctl start langsense-api
sudo systemctl start langsense-bot

# Wait for services to start
sleep 5

# Health check
log "Running health checks..."
if curl -f http://localhost:8000/health &>/dev/null; then
    log "✓ API health check passed"
else
    error "API health check failed"
fi

# Check service status
if systemctl is-active --quiet langsense-api; then
    log "✓ API service is running"
else
    error "API service failed to start"
fi

if systemctl is-active --quiet langsense-bot; then
    log "✓ Bot service is running"
else
    error "Bot service failed to start"
fi

log "🎉 Deployment completed successfully!"
log "=========================================="
log "Services status:"
sudo systemctl status langsense-api --no-pager | head -n 5
sudo systemctl status langsense-bot --no-pager | head -n 5
EOF

chmod +x deploy.sh
```

### 6. Fix API CORS Configuration
```python
# api/main.py - Update CORS middleware
from config import CORS_ORIGINS, ENVIRONMENT

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if ENVIRONMENT == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)
```

### 7. Update Mobile App API URL
```javascript
// mobile-app/src/constants/config.js
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api/v1' 
  : 'https://api.yourdomain.com/api/v1';  // Change to your domain
```

### 8. Create Database Backup Cron Job
```bash
# Add to /etc/cron.d/langsense-backup
cat > /etc/cron.d/langsense-backup << 'EOF'
# Daily database backup at 2 AM
0 2 * * * langsense /opt/langsense/scripts/backup_db.sh
# Keep backups for 30 days
0 3 * * * langsense find /opt/langsense/backups -name "*.sql" -mtime +30 -delete
EOF
```

---

## 🖥️ VPS Setup Commands (Execute in Order)

### Step 1: Initial VPS Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y build-essential git curl wget vim \
    python3.11 python3.11-venv python3.11-dev python3-pip \
    postgresql-15 postgresql-contrib redis-server \
    nginx certbot python3-certbot-nginx \
    ufw fail2ban

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Step 2: Create Application User
```bash
# Create dedicated user
sudo useradd -r -m -s /bin/bash langsense
sudo mkdir -p /opt/langsense
sudo chown -R langsense:langsense /opt/langsense
sudo mkdir -p /var/log/langsense
sudo chown -R langsense:langsense /var/log/langsense
```

### Step 3: Setup PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql << 'EOF'
-- Create database and user
CREATE DATABASE langsense;
CREATE USER langsense WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE langsense TO langsense;
ALTER DATABASE langsense OWNER TO langsense;

-- Enable required extensions
\c langsense
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOF

# Configure PostgreSQL for production
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/g" /etc/postgresql/15/main/postgresql.conf
sudo sed -i "s/max_connections = 100/max_connections = 200/g" /etc/postgresql/15/main/postgresql.conf
sudo systemctl restart postgresql
```

### Step 4: Setup Redis
```bash
# Configure Redis
sudo sed -i 's/# requirepass .*/requirepass your_redis_password_here/g' /etc/redis/redis.conf
sudo sed -i 's/# maxmemory .*/maxmemory 256mb/g' /etc/redis/redis.conf
sudo sed -i 's/# maxmemory-policy .*/maxmemory-policy allkeys-lru/g' /etc/redis/redis.conf
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

### Step 5: Deploy Application Code
```bash
# Clone repository (as langsense user)
sudo -u langsense bash << 'EOF'
cd /opt/langsense
git clone https://github.com/promnes/botv.git .

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
EOF
```

### Step 6: Configure Environment
```bash
# Copy and edit .env file (as langsense user)
sudo -u langsense bash << 'EOF'
cd /opt/langsense
cp .env.example .env

# Generate secure keys
ENCRYPTION_KEY=$(python3 -c "import os; print(os.urandom(32).hex())")
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Update .env file
cat > .env << ENV_EOF
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_USER_IDS=123456789

# Database
DATABASE_URL=postgresql+asyncpg://langsense:your_secure_password_here@localhost:5432/langsense
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40

# Security
ENCRYPTION_KEY=$ENCRYPTION_KEY
JWT_SECRET_KEY=$JWT_SECRET

# CORS
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# HTTPS
FORCE_HTTPS=true
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com

# Redis
REDIS_URL=redis://:your_redis_password_here@localhost:6379/0

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO
ENV_EOF

chmod 600 .env
EOF
```

### Step 7: Initialize Database
```bash
# Run migrations
sudo -u langsense bash << 'EOF'
cd /opt/langsense
source venv/bin/activate

# Initialize Alembic
alembic init alembic 2>/dev/null || true

# Run migrations
alembic upgrade head || python3 -c "
from sqlalchemy import create_engine
from models import Base
import config
engine = create_engine(config.DATABASE_URL.replace('sqlite+aiosqlite', 'sqlite').replace('postgresql+asyncpg', 'postgresql+psycopg2'))
Base.metadata.create_all(engine)
print('Database tables created')
"
EOF
```

### Step 8: Setup SSL Certificate
```bash
# Install SSL certificate for your domain
sudo certbot --nginx -d api.yourdomain.com --non-interactive --agree-tos -m your-email@example.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 9: Install and Enable Services
```bash
# Install service files (created above in section 2)
sudo systemctl daemon-reload
sudo systemctl enable langsense-bot
sudo systemctl enable langsense-api
sudo systemctl enable nginx
sudo systemctl enable postgresql
sudo systemctl enable redis-server

# Start services
sudo systemctl start langsense-bot
sudo systemctl start langsense-api
sudo systemctl restart nginx
```

### Step 10: Verify Deployment
```bash
# Check service status
sudo systemctl status langsense-api
sudo systemctl status langsense-bot

# Check logs
sudo journalctl -u langsense-api -f
sudo journalctl -u langsense-bot -f

# Test API health
curl http://localhost:8000/health
curl https://api.yourdomain.com/health

# Check listening ports
sudo netstat -tulpn | grep -E ':(80|443|8000|5432|6379)'
```

---

## 🔒 Security Hardening

### 1. Setup Fail2Ban for SSH Protection
```bash
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
EOF

sudo systemctl restart fail2ban
```

### 2. Disable Root SSH Login
```bash
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/g' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 3. Setup Automatic Security Updates
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📊 Monitoring & Maintenance

### 1. Create Health Check Script
```bash
cat > /opt/langsense/scripts/health_check.sh << 'EOF'
#!/bin/bash
# Health check script for monitoring

API_URL="http://localhost:8000/health"
BOT_PROCESS="bot.py"

# Check API
if curl -f "$API_URL" &>/dev/null; then
    echo "✓ API is healthy"
else
    echo "✗ API is down - restarting..."
    sudo systemctl restart langsense-api
fi

# Check Bot process
if pgrep -f "$BOT_PROCESS" > /dev/null; then
    echo "✓ Bot is running"
else
    echo "✗ Bot is down - restarting..."
    sudo systemctl restart langsense-bot
fi
EOF

chmod +x /opt/langsense/scripts/health_check.sh

# Add to crontab (every 5 minutes)
echo "*/5 * * * * /opt/langsense/scripts/health_check.sh >> /var/log/langsense/health_check.log 2>&1" | sudo -u langsense crontab -
```

### 2. Setup Log Monitoring
```bash
# Create log aggregation script
cat > /opt/langsense/scripts/check_errors.sh << 'EOF'
#!/bin/bash
# Check for errors in logs

ERROR_COUNT=$(tail -n 1000 /var/log/langsense/*.log | grep -i "error" | wc -l)

if [ "$ERROR_COUNT" -gt 50 ]; then
    echo "⚠️  High error count detected: $ERROR_COUNT errors"
    # Send alert (email, Telegram, etc.)
fi
EOF

chmod +x /opt/langsense/scripts/check_errors.sh
```

---

## 🧪 Testing Checklist

After deployment, verify:

- [ ] API responds at https://api.yourdomain.com/health
- [ ] API docs available at https://api.yourdomain.com/docs
- [ ] Bot responds to /start command
- [ ] Database connections work (check logs)
- [ ] Redis cache operational
- [ ] SSL certificate valid
- [ ] Firewall rules active
- [ ] Services restart on reboot
- [ ] Log rotation working
- [ ] Backups running daily
- [ ] Health checks monitoring
- [ ] Mobile app connects to API
- [ ] File uploads work (if applicable)
- [ ] Telegram webhooks configured (if used)

---

## 📦 Dependencies Verification

### Python Requirements Pinning
```bash
# Generate exact versions
pip freeze > requirements.lock

# In production, use:
pip install -r requirements.lock
```

### Mobile App Dependencies
```bash
cd mobile-app
npm ci  # Use package-lock.json for exact versions
```

---

## 🔄 Rollback Plan

If deployment fails:

```bash
# Stop services
sudo systemctl stop langsense-api langsense-bot

# Restore from backup
sudo -u postgres psql langsense < /opt/langsense/backups/backup_YYYYMMDD_HHMMSS.sql

# Revert code
cd /opt/langsense
git reset --hard <previous-commit-hash>

# Restart services
sudo systemctl start langsense-api langsense-bot
```

---

## 📝 Post-Deployment Tasks

1. **Update DNS**: Point api.yourdomain.com to VPS IP
2. **Configure monitoring**: Setup UptimeRobot or similar
3. **Setup error tracking**: Integrate Sentry
4. **Configure backups**: Verify daily backups running
5. **Document credentials**: Store in secure password manager
6. **Setup alerts**: Email/Telegram notifications for downtime
7. **Performance tuning**: Monitor and adjust DB pool sizes
8. **SSL renewal test**: Verify certbot auto-renewal works

---

## 🎯 Production Optimization Tips

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);
```

### Nginx Optimization
```nginx
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
client_max_body_size 20M;
```

### Python Production Settings
```python
# config.py additions for production
if ENVIRONMENT == "production":
    LOG_LEVEL = "WARNING"
    DB_POOL_SIZE = 50
    BROADCAST_RATE_LIMIT = 20  # Be conservative
```

---

*Deployment guide version 1.0 - Last updated: 2026-01-03*
