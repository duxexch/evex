#!/bin/bash
# Quick VPS setup script for Ubuntu 24.04
# Run this first on a fresh VPS: sudo bash setup_vps.sh

set -e

echo "🔧 LangSense VPS Initial Setup"
echo "================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root: sudo bash setup_vps.sh"
    exit 1
fi

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
echo "Installing essential packages..."
apt install -y \
    build-essential git curl wget vim ufw fail2ban \
    python3.11 python3.11-venv python3.11-dev python3-pip \
    postgresql-15 postgresql-contrib \
    redis-server \
    nginx certbot python3-certbot-nginx \
    htop iotop netstat-nat

# Configure firewall
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "✓ Firewall configured"

# Create application user
echo "Creating langsense user..."
if ! id -u langsense &>/dev/null; then
    useradd -r -m -s /bin/bash langsense
fi

# Create directories
mkdir -p /opt/langsense
mkdir -p /var/log/langsense
mkdir -p /opt/langsense/backups

chown -R langsense:langsense /opt/langsense
chown -R langsense:langsense /var/log/langsense

echo "✓ User and directories created"

# Setup PostgreSQL
echo "Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32)

sudo -u postgres psql <<EOF
-- Create database and user
CREATE DATABASE IF NOT EXISTS langsense;
CREATE USER IF NOT EXISTS langsense WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE langsense TO langsense;
ALTER DATABASE langsense OWNER TO langsense;

-- Switch to langsense database
\c langsense

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOF

# Configure PostgreSQL for production
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/g" /etc/postgresql/15/main/postgresql.conf
sed -i "s/max_connections = 100/max_connections = 200/g" /etc/postgresql/15/main/postgresql.conf

systemctl restart postgresql

echo "✓ PostgreSQL configured"
echo "  Database: langsense"
echo "  User: langsense"
echo "  Password: $DB_PASSWORD"
echo "  (Save this password!)"

# Setup Redis
echo "Configuring Redis..."
REDIS_PASSWORD=$(openssl rand -base64 32)

sed -i "s/# requirepass .*/requirepass $REDIS_PASSWORD/g" /etc/redis/redis.conf
sed -i "s/# maxmemory .*/maxmemory 256mb/g" /etc/redis/redis.conf
sed -i "s/# maxmemory-policy .*/maxmemory-policy allkeys-lru/g" /etc/redis/redis.conf

systemctl restart redis-server
systemctl enable redis-server

echo "✓ Redis configured"
echo "  Password: $REDIS_PASSWORD"
echo "  (Save this password!)"

# Setup Fail2Ban
echo "Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
EOF

systemctl restart fail2ban
systemctl enable fail2ban

echo "✓ Fail2Ban configured"

# Harden SSH
echo "Hardening SSH configuration..."
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/g' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/g' /etc/ssh/sshd_config
systemctl restart sshd

echo "✓ SSH hardened (root login disabled)"

# Setup automatic security updates
echo "Enabling automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Save credentials to file
CRED_FILE="/root/langsense_credentials.txt"
cat > "$CRED_FILE" <<EOF
LangSense VPS Credentials
=========================
Generated: $(date)

PostgreSQL:
  Database: langsense
  User: langsense
  Password: $DB_PASSWORD
  Connection: postgresql://langsense:$DB_PASSWORD@localhost:5432/langsense

Redis:
  Host: localhost:6379
  Password: $REDIS_PASSWORD
  URL: redis://:$REDIS_PASSWORD@localhost:6379/0

Next Steps:
  1. Clone repository: cd /opt/langsense && git clone <your-repo-url> .
  2. Create .env file with these credentials
  3. Run deployment script: bash deploy.sh
  4. Setup SSL: certbot --nginx -d api.yourdomain.com
EOF

chmod 600 "$CRED_FILE"

echo ""
echo "=========================================="
echo "✅ VPS Setup Complete!"
echo "=========================================="
echo ""
echo "Credentials saved to: $CRED_FILE"
echo ""
echo "Next Steps:"
echo "  1. Switch to langsense user: sudo -u langsense -i"
echo "  2. Clone repository: cd /opt/langsense && git clone <repo-url> ."
echo "  3. Create .env file (see $CRED_FILE for credentials)"
echo "  4. Create systemd service files (see PRODUCTION_DEPLOYMENT_CHECKLIST.md)"
echo "  5. Run deployment: bash deploy.sh"
echo "  6. Setup SSL: certbot --nginx -d api.yourdomain.com"
echo ""
echo "View credentials: cat $CRED_FILE"
echo ""
