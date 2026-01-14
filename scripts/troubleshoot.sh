#!/bin/bash

# ========================================
# VEX Troubleshooting Script
# سكربت تشخيص مشاكل VEX
# ========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

check_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_fail() {
    echo -e "${RED}✗ $1${NC}"
    echo -e "${YELLOW}  Fix: $2${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_header "VEX Troubleshooting / تشخيص مشاكل VEX"

# Check Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    check_pass "Node.js installed: $(node -v)"
else
    check_fail "Node.js not installed" "Run: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
fi

# Check PM2
echo -e "\n${BLUE}Checking PM2...${NC}"
if command -v pm2 &> /dev/null; then
    check_pass "PM2 installed: $(pm2 -v)"
else
    check_fail "PM2 not installed" "Run: sudo npm install -g pm2"
fi

# Check PostgreSQL
echo -e "\n${BLUE}Checking PostgreSQL...${NC}"
if systemctl is-active --quiet postgresql; then
    check_pass "PostgreSQL is running"
else
    check_fail "PostgreSQL is not running" "Run: sudo systemctl start postgresql"
fi

# Check Nginx
echo -e "\n${BLUE}Checking Nginx...${NC}"
if systemctl is-active --quiet nginx; then
    check_pass "Nginx is running"
else
    check_fail "Nginx is not running" "Run: sudo systemctl start nginx"
fi

# Check Nginx config
if sudo nginx -t 2>/dev/null; then
    check_pass "Nginx configuration is valid"
else
    check_fail "Nginx configuration has errors" "Run: sudo nginx -t to see errors"
fi

# Check PM2 processes
echo -e "\n${BLUE}Checking VEX application...${NC}"
if pm2 list | grep -q "vex"; then
    PM2_STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$PM2_STATUS" == "online" ]; then
        check_pass "VEX application is running (online)"
    else
        check_fail "VEX application is not running (status: $PM2_STATUS)" "Run: pm2 restart vex"
    fi
else
    check_fail "VEX application not found in PM2" "Run: cd /var/www/vex && pm2 start npm --name 'vex' -- start"
fi

# Check port 5000
echo -e "\n${BLUE}Checking port 5000...${NC}"
if netstat -tlnp 2>/dev/null | grep -q ":5000"; then
    check_pass "Port 5000 is listening"
else
    check_fail "Port 5000 is not listening" "The application might not be running properly"
fi

# Check .env file
echo -e "\n${BLUE}Checking environment file...${NC}"
if [ -f "/var/www/vex/.env" ]; then
    check_pass ".env file exists"
    
    # Check required variables
    if grep -q "DATABASE_URL" /var/www/vex/.env; then
        check_pass "DATABASE_URL is set"
    else
        check_fail "DATABASE_URL is not set" "Add DATABASE_URL to /var/www/vex/.env"
    fi
    
    if grep -q "SESSION_SECRET" /var/www/vex/.env; then
        check_pass "SESSION_SECRET is set"
    else
        check_fail "SESSION_SECRET is not set" "Add SESSION_SECRET to /var/www/vex/.env"
    fi
else
    check_fail ".env file not found" "Create .env file in /var/www/vex"
fi

# Check disk space
echo -e "\n${BLUE}Checking disk space...${NC}"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    check_pass "Disk space OK (${DISK_USAGE}% used)"
else
    check_warn "Disk space low (${DISK_USAGE}% used) - Consider cleaning up"
fi

# Check memory
echo -e "\n${BLUE}Checking memory...${NC}"
MEMORY_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
if [ "$MEMORY_AVAILABLE" -gt 200 ]; then
    check_pass "Available memory: ${MEMORY_AVAILABLE}MB"
else
    check_warn "Low memory: ${MEMORY_AVAILABLE}MB - Consider adding swap or upgrading"
fi

# Check SSL certificate
echo -e "\n${BLUE}Checking SSL certificate...${NC}"
if [ -f "/etc/letsencrypt/live/*/fullchain.pem" ]; then
    CERT_EXPIRY=$(sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/*/fullchain.pem 2>/dev/null | cut -d= -f2)
    check_pass "SSL certificate found (expires: $CERT_EXPIRY)"
else
    check_warn "SSL certificate not found - Run: sudo certbot --nginx"
fi

# Database connection test
echo -e "\n${BLUE}Testing database connection...${NC}"
if [ -f "/var/www/vex/.env" ]; then
    DB_URL=$(grep DATABASE_URL /var/www/vex/.env | cut -d= -f2-)
    if [ ! -z "$DB_URL" ]; then
        if psql "$DB_URL" -c "SELECT 1;" &>/dev/null; then
            check_pass "Database connection successful"
        else
            check_fail "Database connection failed" "Check DATABASE_URL in .env and PostgreSQL status"
        fi
    fi
fi

# Recent logs
echo -e "\n${BLUE}Recent application logs:${NC}"
echo -e "${YELLOW}----------------------------------------${NC}"
pm2 logs vex --lines 10 --nostream 2>/dev/null || echo "No logs available"
echo -e "${YELLOW}----------------------------------------${NC}"

print_header "Troubleshooting Complete / اكتمل التشخيص"

echo -e "Useful commands:"
echo -e "  View all logs: ${YELLOW}pm2 logs vex${NC}"
echo -e "  Restart app: ${YELLOW}pm2 restart vex${NC}"
echo -e "  Check Nginx: ${YELLOW}sudo nginx -t${NC}"
echo -e "  Check PostgreSQL: ${YELLOW}sudo systemctl status postgresql${NC}"
