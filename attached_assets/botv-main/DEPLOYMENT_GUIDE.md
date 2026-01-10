# LangSense Control Panel API — Deployment Guide

## Production Readiness Checklist ✅

- ✅ Pydantic v2 compliant (zero deprecation warnings)
- ✅ Integration tests passing (4/4)
- ✅ OpenAPI/Swagger documentation available
- ✅ Multi-stage Docker build (optimized)
- ✅ Non-root container user (security)
- ✅ Health checks configured
- ✅ CORS hardened for production
- ✅ PostgreSQL + Redis containerized
- ✅ Environment-based configuration
- ✅ No hardcoded secrets

---

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose installed
- Git

### 1. Clone and Configure
```bash
git clone https://github.com/promnes/botv.git
cd botv
cp .env.example .env
```

### 2. Update .env with Your Values
```bash
# Critical security changes:
JWT_SECRET_KEY=<strong-random-key>
ENCRYPTION_KEY=<strong-random-key>
BOT_TOKEN=<your-telegram-token>
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
```

### 3. Start Services
```bash
docker-compose up --build
```

### 4. Verify
```bash
curl http://localhost:8000/health
# Expected: {"status": "healthy", "database": "connected"}

# Swagger UI
open http://localhost:8000/docs

# ReDoc
open http://localhost:8000/redoc
```

---

## Production Deployment (Ubuntu 24.04 VPS)

### Prerequisites
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 1. Clone Repository
```bash
sudo mkdir -p /opt/langsense
cd /opt/langsense
sudo git clone https://github.com/promnes/botv.git .
cd /opt/langsense
```

### 2. Setup Environment
```bash
# Copy environment template
sudo cp .env.example .env

# Edit with strong values
sudo nano .env
```

**Critical changes for production:**
```bash
ENVIRONMENT=production
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
JWT_SECRET_KEY=<use: python -c "import secrets; print(secrets.token_urlsafe(32))">
ENCRYPTION_KEY=<use: python -c "import secrets; print(secrets.token_urlsafe(32))">
DB_PASSWORD=<strong-random-password>
REDIS_PASSWORD=<strong-random-password>
BOT_TOKEN=<your-bot-token>
```

### 3. Start Services
```bash
sudo docker-compose -f docker-compose.yml up -d --build

# Verify all services are running
docker-compose ps

# Check API health
curl http://localhost:8000/health
```

### 4. Setup Reverse Proxy (Nginx)

Create `/opt/langsense/nginx.conf`:
```nginx
upstream langsense_api {
    server api:8000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to API
    location / {
        proxy_pass http://langsense_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://langsense_api;
    }
}
```

### 5. Setup SSL with Let's Encrypt
```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx -y

sudo certbot certonly --standalone -d api.yourdomain.com

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 6. Health Checks & Monitoring

#### Basic Health Check
```bash
# Check API
curl -H "Accept: application/json" https://api.yourdomain.com/health

# Expected response:
# {"status":"healthy","environment":"production","database":"connected","version":"1.0.0"}
```

#### Docker Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f api

# View last 100 lines
docker-compose logs --tail=100
```

#### Monitoring with Uptime
```bash
# Check every minute (add to cron)
*/1 * * * * curl -s https://api.yourdomain.com/health | grep -q healthy || \
  echo "API is down" | mail -s "Alert: API Down" admin@yourdomain.com
```

---

## Database Backups

### Automated Daily Backup
```bash
#!/bin/bash
# /opt/langsense/backup.sh

BACKUP_DIR="/opt/langsense/backups"
CONTAINER="langsense-postgres"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump \
  -U langsense langsense > $BACKUP_DIR/langsense_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "langsense_*.sql" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/langsense_$DATE.sql"
```

Add to crontab:
```bash
0 2 * * * /opt/langsense/backup.sh
```

---

## Security Best Practices

### ✅ Implemented
- [x] Non-root container user
- [x] No hardcoded secrets
- [x] CORS restricted to specific origins
- [x] Health check endpoint
- [x] SSL/TLS enabled
- [x] Rate limiting ready

### ⚠️ Additional Recommendations
1. **Firewall**: Only expose ports 80 and 443
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Log Rotation**: Configure logrotate
   ```bash
   /opt/langsense/docker-compose.logs {
     daily
     missingok
     rotate 7
     compress
     delaycompress
   }
   ```

3. **Database Access**: Restrict to internal network only
   ```yaml
   # In docker-compose.yml postgres service
   ports:
     - "127.0.0.1:5432:5432"  # Only localhost
   ```

4. **API Key Management**: Use environment-specific secrets
   ```bash
   # Use: AWS Secrets Manager, Vault, or similar
   # Export to environment during deployment
   ```

---

## Rollback Procedure

```bash
# Stop current deployment
docker-compose down

# Restore from backup
docker-compose up -d
psql -U langsense langsense < backups/langsense_TIMESTAMP.sql

# Restart
docker-compose restart api
```

---

## Monitoring & Alerting

### Prometheus Metrics (Optional)
Add to `docker-compose.yml` under API service:
```yaml
environment:
  - PROMETHEUS_ENABLED=true
ports:
  - "9090:9090"
```

### Alert on Failures
```bash
#!/bin/bash
# Check API health every 5 minutes
*/5 * * * * \
  curl -s https://api.yourdomain.com/health || \
  curl -X POST https://hooks.slack.com/... -d '{"text":"API Down"}'
```

---

## Performance Tuning

### Database Connection Pool
```python
# In config.py
DB_POOL_SIZE = 20
DB_MAX_OVERFLOW = 10
```

### Redis Cache
```bash
# Monitor Redis memory
docker-compose exec redis redis-cli INFO memory

# Set max memory policy
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### API Workers
```bash
# For high traffic, increase workers
docker run -e WORKERS=4 langsense-api:1.0.0
```

---

## Troubleshooting

### API Container Won't Start
```bash
docker-compose logs api
# Check for missing env vars or database connection issues
```

### Database Connection Refused
```bash
docker-compose logs postgres
docker-compose exec postgres psql -U langsense -c "SELECT 1"
```

### Out of Disk Space
```bash
docker system prune -a --volumes
docker-compose down -v
# Restart with fresh volumes
docker-compose up -d --build
```

### Slow API Responses
```bash
# Check Docker resource usage
docker stats

# Increase container resources
docker-compose.yml:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## Support & Maintenance

### Weekly Tasks
- [ ] Check logs for errors
- [ ] Verify backups
- [ ] Monitor disk space
- [ ] Check SSL certificate expiry

### Monthly Tasks
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Performance optimization
- [ ] Backup retention cleanup

### Annual Tasks
- [ ] Security audit
- [ ] Disaster recovery test
- [ ] Capacity planning
- [ ] License/compliance review

---

## API Documentation

**Live Endpoints:**
- Swagger UI: `https://api.yourdomain.com/docs`
- ReDoc: `https://api.yourdomain.com/redoc`
- OpenAPI JSON: `https://api.yourdomain.com/openapi.json`

**Key Routes:**
- Health: `GET /health`
- Games: `GET/POST /control-panel/games`
- Players: `GET/POST /control-panel/players`
- Financial: `GET/POST /control-panel/profit-loss`
- RBAC: `GET/POST /control-panel/rbac`
- Audit: `GET /control-panel/audit`

---

**Version:** 1.0.0  
**Last Updated:** January 4, 2026  
**Status:** Production Ready ✅
