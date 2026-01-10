# 🚀 QUICK START - Production Deployment

## ⚡ Deploy in 5 Minutes

### **On Your Hostinger VPS (Ubuntu 24.04):**

```bash
# 1. SSH into your server
ssh root@your-vps-ip

# 2. Clone repository
cd /root
git clone https://github.com/promnes/botv.git
cd botv

# 3. Verify .env exists (already in repo with your credentials)
cat .env | grep BOT_TOKEN

# 4. Install Docker (if not installed)
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
apt install docker-compose-plugin -y

# 5. Deploy!
docker-compose -f docker-compose.prod.yml up -d --build

# 6. Check status
docker-compose -f docker-compose.prod.yml ps
```

---

## ✅ Verify Deployment

```bash
# Check API health
curl http://localhost:8000/health

# View bot logs
docker-compose -f docker-compose.prod.yml logs -f bot

# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Test your bot in Telegram
# Send: /start
```

---

## 🔧 Essential Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart services
docker-compose -f docker-compose.prod.yml restart

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Update deployment
git pull
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps
```

---

## 🔐 Security Setup (Optional but Recommended)

### **1. Configure Firewall**
```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable
```

### **2. Setup HTTPS (Let's Encrypt)**
```bash
# Install Nginx
apt install nginx -y

# Configure reverse proxy for API
cat > /etc/nginx/sites-available/langsense <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/langsense /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

---

## 📊 Monitoring

### **Health Checks**
```bash
# API health
curl http://localhost:8000/health

# Container health
docker-compose -f docker-compose.prod.yml ps

# Database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready
```

### **Resource Usage**
```bash
# CPU & Memory
docker stats

# Disk usage
df -h
```

---

## 🚨 Troubleshooting

### **Bot not responding?**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs bot

# Verify BOT_TOKEN
cat .env | grep BOT_TOKEN

# Restart
docker-compose -f docker-compose.prod.yml restart bot
```

### **API returns 502?**
```bash
# Check API logs
docker-compose -f docker-compose.prod.yml logs api

# Verify health
curl http://localhost:8000/health

# Restart
docker-compose -f docker-compose.prod.yml restart api
```

### **Database errors?**
```bash
# Check database
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# View logs
docker-compose -f docker-compose.prod.yml logs postgres

# Restart
docker-compose -f docker-compose.prod.yml restart postgres
```

---

## 📚 Full Documentation

For comprehensive deployment guide, see: [`DEPLOYMENT_REPORT.md`](DEPLOYMENT_REPORT.md)

For local development setup, see: [`localrun.md`](localrun.md)

---

## ✨ What's Deployed?

- ✅ **PostgreSQL 16** - Production database (port 5432)
- ✅ **Redis 7** - Cache & queue (port 6379)
- ✅ **FastAPI** - REST API (port 8000)
- ✅ **Telegram Bot** - Aiogram v3 (internal)

All services include:
- Health checks
- Automatic restarts
- Persistent data volumes
- Secure networking
- Production-optimized

---

**Ready to deploy? Run the commands above!** 🎉
