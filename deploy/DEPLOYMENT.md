# VEX Platform - Hostinger VPS Deployment Guide

## Prerequisites

- Hostinger VPS with Ubuntu 22.04 LTS
- SSH access to your VPS
- Domain name pointed to your VPS IP
- PostgreSQL database (Hostinger managed or self-hosted)

## Quick Start

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git nginx postgresql-client

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash vex
sudo mkdir -p /var/www/vex /var/log/vex
sudo chown -R vex:vex /var/www/vex /var/log/vex
```

### 2. Database Setup

If using external PostgreSQL (recommended for Hostinger):
```bash
# Your DATABASE_URL will look like:
# postgresql://username:password@host:5432/database?sslmode=require
```

If self-hosting PostgreSQL:
```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser --interactive  # Create 'vex' user
sudo -u postgres createdb vex
sudo -u postgres psql -c "ALTER USER vex WITH PASSWORD 'your-secure-password';"
```

### 3. Deploy Application

```bash
# Switch to vex user
sudo su - vex
cd /var/www/vex

# Clone repository
git clone https://github.com/yourusername/vex-platform.git .

# Install dependencies
npm install

# Build production
npm run build

# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/vex?sslmode=require
SESSION_SECRET=$(openssl rand -hex 32)
DB_POOL_MAX=20
DB_POOL_MIN=2
EOF

# Run database migrations (first time)
ALLOW_FORCE_MIGRATIONS=true npx drizzle-kit push

# Start with PM2
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable startup
```

### 4. Admin Bootstrap

```bash
# Set temporary admin credentials (first run only)
# Password must be at least 16 characters
export ADMIN_BOOTSTRAP_PASSWORD="your-secure-admin-password-here"
export ADMIN_BOOTSTRAP_EMAIL="admin@yourdomain.com"

# Restart to create admin
pm2 restart vex-platform

# IMPORTANT: Unset after first successful login
unset ADMIN_BOOTSTRAP_PASSWORD
unset ADMIN_BOOTSTRAP_EMAIL

# Remove from environment file if added there
```

### 5. Nginx Setup

```bash
# Exit to root user
exit

# Copy nginx config
sudo cp /var/www/vex/deploy/nginx.conf /etc/nginx/sites-available/vex

# Edit domain name
sudo nano /etc/nginx/sites-available/vex
# Replace 'yourdomain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/vex /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 6. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test with: sudo certbot renew --dry-run
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Server port (default: 5000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Min 32 chars for sessions/JWT |
| `DB_POOL_MAX` | No | Max DB connections (default: 20) |
| `DB_POOL_MIN` | No | Min idle connections (default: 2) |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | Set to `false` for self-signed certs |
| `ADMIN_BOOTSTRAP_PASSWORD` | Once | Initial admin password (min 16 chars) |
| `ADMIN_BOOTSTRAP_EMAIL` | Once | Initial admin email |

## Maintenance Commands

```bash
# View logs
pm2 logs vex-platform
pm2 logs vex-platform --lines 100

# Monitor
pm2 monit

# Restart
pm2 restart vex-platform

# Update application
cd /var/www/vex
git pull
npm install
npm run build
pm2 restart vex-platform

# Database backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Check health
curl http://localhost:5000/api/health
```

## Security Checklist

- [ ] Change default admin password immediately after first login
- [ ] Unset ADMIN_BOOTSTRAP_PASSWORD after admin creation
- [ ] Enable UFW firewall: `sudo ufw allow ssh && sudo ufw allow http && sudo ufw allow https && sudo ufw enable`
- [ ] Configure fail2ban for SSH protection
- [ ] Set up automated backups for database
- [ ] Monitor disk space and memory usage
- [ ] Keep system packages updated
- [ ] Review nginx access logs regularly

## Troubleshooting

### Application won't start
```bash
pm2 logs vex-platform --lines 50
# Check for missing env vars or DB connection issues
```

### Database connection errors
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check SSL mode
# Try adding ?sslmode=require or ?sslmode=disable to DATABASE_URL
```

### 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check nginx error log
sudo tail -f /var/log/nginx/vex-error.log
```

### High memory usage
```bash
# Reduce PM2 instances
pm2 scale vex-platform 2  # Use 2 instances instead of max
```

## Hostinger-Specific Notes

1. **Database**: Use Hostinger's managed PostgreSQL if available, or install on the VPS
2. **Firewall**: Hostinger may have its own firewall panel - ensure ports 80, 443 are open
3. **SSH**: Default SSH may be on a non-standard port - check your Hostinger panel
4. **Resources**: KVM VPS recommended for better performance vs OpenVZ
5. **Backups**: Enable Hostinger's backup feature as additional protection

## Support

For issues specific to the VEX platform, check:
- Application logs: `pm2 logs vex-platform`
- Database connectivity: `psql $DATABASE_URL -c "SELECT 1"`
- Health endpoint: `curl localhost:5000/api/health`
