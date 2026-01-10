# Quick Start: Production Deployment on Ubuntu VPS

## Prerequisites
- Ubuntu 24.04 LTS VPS with root access
- Domain name pointed to VPS IP
- SSH key for authentication
- Telegram Bot Token

## 🚀 One-Command Deployment

### Option 1: Automated Setup (Recommended)

```bash
# 1. Copy setup script to VPS
scp setup_vps.sh root@your-vps-ip:/root/

# 2. Run setup (this installs everything and generates credentials)
ssh root@your-vps-ip 'bash /root/setup_vps.sh'

# 3. View generated credentials
ssh root@your-vps-ip 'cat /root/langsense_credentials.txt'

# 4. Deploy application
ssh root@your-vps-ip 'cd /opt/langsense && sudo -u langsense bash deploy.sh'
```

### Option 2: Manual Step-by-Step

#### 1. Initial VPS Setup
```bash
# SSH into VPS
ssh root@your-vps-ip

# Run setup script
bash setup_vps.sh

# Save credentials shown at the end
```

#### 2. Clone Repository
```bash
# Switch to langsense user
sudo -u langsense -i

# Clone your repository
cd /opt/langsense
git clone https://github.com/promnes/botv.git .
```

#### 3. Configure Environment
```bash
# Copy production template
cp .env.production.template .env

# Edit with your values
nano .env

# Required values to change:
# - BOT_TOKEN (from BotFather)
# - DATABASE_URL (use password from /root/langsense_credentials.txt)
# - ENCRYPTION_KEY (generate with: python -c "import os; print(os.urandom(32).hex())")
# - JWT_SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
# - REDIS_URL (use password from credentials file)
# - CORS_ORIGINS (your actual domain)
# - ALLOWED_HOSTS (your actual domain)
```

#### 4. Create Systemd Services
```bash
# Create bot service
sudo nano /etc/systemd/system/langsense-bot.service
# Copy content from PRODUCTION_DEPLOYMENT_CHECKLIST.md section 2

# Create API service
sudo nano /etc/systemd/system/langsense-api.service
# Copy content from PRODUCTION_DEPLOYMENT_CHECKLIST.md section 2

# Reload systemd
sudo systemctl daemon-reload
```

#### 5. Setup Python Environment
```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### 6. Initialize Database
```bash
# Run migrations
alembic upgrade head

# Or if migrations don't exist, create tables directly
python3 -c "
from sqlalchemy import create_engine
from models import Base
from config import DATABASE_URL
engine = create_engine(DATABASE_URL.replace('sqlite+aiosqlite', 'sqlite').replace('postgresql+asyncpg', 'postgresql+psycopg2'))
Base.metadata.create_all(engine)
print('Database initialized')
"
```

#### 7. Configure Nginx
```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/langsense
# Copy content from PRODUCTION_DEPLOYMENT_CHECKLIST.md section 3

# Enable site
sudo ln -s /etc/nginx/sites-available/langsense /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 8. Setup SSL Certificate
```bash
# Install Let's Encrypt certificate
sudo certbot --nginx -d api.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### 9. Start Services
```bash
# Enable and start services
sudo systemctl enable langsense-api langsense-bot
sudo systemctl start langsense-api
sudo systemctl start langsense-bot

# Check status
sudo systemctl status langsense-api
sudo systemctl status langsense-bot
```

#### 10. Verify Deployment
```bash
# Test local API
curl http://localhost:8000/health

# Test public API
curl https://api.yourdomain.com/health

# Check logs
journalctl -u langsense-api -f
journalctl -u langsense-bot -f
```

## 🔄 Future Updates

```bash
# Simple deployment
cd /opt/langsense
sudo -u langsense bash deploy.sh
```

## 📊 Monitoring

```bash
# View logs
journalctl -u langsense-api -f
journalctl -u langsense-bot -f

# Check service status
systemctl status langsense-api
systemctl status langsense-bot

# View latest logs
tail -f /var/log/langsense/bot.log
tail -f /var/log/langsense/api.log
```

## 🛠️ Troubleshooting

### API not starting
```bash
# Check logs
journalctl -u langsense-api -n 100

# Test manually
cd /opt/langsense
source venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Bot not responding
```bash
# Check logs
journalctl -u langsense-bot -n 100

# Test manually
cd /opt/langsense
source venv/bin/activate
python bot.py
```

### Database connection errors
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U langsense -d langsense -h localhost

# Check credentials in .env file
cat /opt/langsense/.env | grep DATABASE_URL
```

### SSL certificate issues
```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

## 📱 Mobile App Setup

After API is deployed:

1. Update `mobile-app/src/constants/config.js` with production URL
2. Build mobile app: `cd mobile-app && npm run build`
3. Deploy to app stores or distribute APK/IPA

## 🔒 Security Checklist

- [ ] Changed all default passwords
- [ ] Generated secure ENCRYPTION_KEY
- [ ] Generated secure JWT_SECRET_KEY
- [ ] Restricted CORS_ORIGINS to actual domain
- [ ] Enabled HTTPS (FORCE_HTTPS=true)
- [ ] Disabled root SSH login
- [ ] Configured fail2ban
- [ ] Setup firewall (UFW)
- [ ] Installed SSL certificate
- [ ] Set proper file permissions (chmod 600 .env)
- [ ] Enabled automatic security updates

## 📈 Performance Tuning

After deployment, monitor and adjust:

- Database connection pool size (DB_POOL_SIZE)
- Redis maxmemory
- Nginx worker processes
- API workers (--workers flag)
- Rate limits

## 🆘 Support

For issues, check:
1. Logs: `/var/log/langsense/`
2. Service status: `systemctl status langsense-*`
3. Full deployment guide: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
4. Error analysis: `COMPREHENSIVE_ERROR_ANALYSIS.md`
