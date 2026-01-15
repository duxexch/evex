#!/bin/bash

# ========================================
# VEX Troubleshooting & Auto-Fix Script v2.0
# سكربت تشخيص وإصلاح مشاكل VEX
# Updated: January 2026
# ========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/var/www/vex"
ISSUES_FOUND=0
ISSUES_FIXED=0

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"
}

check_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_fail() {
    echo -e "${RED}✗ $1${NC}"
    echo -e "${YELLOW}  → $2${NC}"
    ((ISSUES_FOUND++))
}

check_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

fix_success() {
    echo -e "${GREEN}  ✓ Fixed: $1${NC}"
    ((ISSUES_FIXED++))
}

fix_failed() {
    echo -e "${RED}  ✗ Could not fix: $1${NC}"
}

# Auto-fix mode
AUTO_FIX=false
if [[ "$1" == "--fix" ]] || [[ "$1" == "-f" ]]; then
    AUTO_FIX=true
    echo -e "${CYAN}Running in AUTO-FIX mode${NC}"
fi

print_header "VEX Troubleshooting Script v2.0"
print_header "تشخيص مشاكل VEX"

# ===========================================
# System Requirements Check
# ===========================================
print_header "1. System Requirements / متطلبات النظام"

# Check OS
echo -e "${BLUE}Operating System:${NC}"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    check_pass "$NAME $VERSION_ID"
else
    check_warn "Could not detect OS"
fi

# Check memory
echo -e "\n${BLUE}Memory:${NC}"
TOTAL_MEM=$(free -m | awk 'NR==2 {print $2}')
AVAIL_MEM=$(free -m | awk 'NR==2 {print $7}')
if [ "$AVAIL_MEM" -gt 500 ]; then
    check_pass "Available: ${AVAIL_MEM}MB / Total: ${TOTAL_MEM}MB"
elif [ "$AVAIL_MEM" -gt 200 ]; then
    check_warn "Low memory: ${AVAIL_MEM}MB available"
else
    check_fail "Critical: Only ${AVAIL_MEM}MB available" "Consider adding swap or upgrading server"
fi

# Check disk space
echo -e "\n${BLUE}Disk Space:${NC}"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    check_warn "Disk ${DISK_USAGE}% full (${DISK_AVAIL} available)"
else
    check_fail "Critical: Disk ${DISK_USAGE}% full" "Free up space: sudo apt autoremove, clear logs"
fi

# Check CPU load
echo -e "\n${BLUE}CPU Load:${NC}"
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
CPU_CORES=$(nproc)
check_pass "Load: $LOAD (Cores: $CPU_CORES)"

# ===========================================
# Node.js Check
# ===========================================
print_header "2. Node.js / نود جي إس"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        check_pass "Node.js $(node -v) installed"
    elif [ "$NODE_VERSION" -ge 18 ]; then
        check_warn "Node.js $(node -v) - v20+ recommended"
    else
        check_fail "Node.js $(node -v) is outdated" "Upgrade to v20+"
        if [ "$AUTO_FIX" = true ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt install -y nodejs && fix_success "Node.js upgraded" || fix_failed "Node.js upgrade"
        fi
    fi
else
    check_fail "Node.js not installed" "Install Node.js 20+"
    if [ "$AUTO_FIX" = true ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs && fix_success "Node.js installed" || fix_failed "Node.js installation"
    fi
fi

# Check npm
if command -v npm &> /dev/null; then
    check_pass "npm $(npm -v) installed"
else
    check_fail "npm not installed" "Should come with Node.js"
fi

# ===========================================
# PM2 Check
# ===========================================
print_header "3. PM2 Process Manager / مدير العمليات"

if command -v pm2 &> /dev/null; then
    check_pass "PM2 $(pm2 -v) installed"
    
    # Check if VEX is running
    if pm2 list 2>/dev/null | grep -q "vex"; then
        PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"name":"vex"[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$PM2_STATUS" == "online" ]; then
            check_pass "VEX application is online"
            
            # Check memory usage
            PM2_MEM=$(pm2 jlist 2>/dev/null | grep -o '"name":"vex"[^}]*"memory":[0-9]*' | grep -o '[0-9]*$')
            if [ ! -z "$PM2_MEM" ]; then
                PM2_MEM_MB=$((PM2_MEM / 1024 / 1024))
                if [ "$PM2_MEM_MB" -lt 500 ]; then
                    check_pass "Memory usage: ${PM2_MEM_MB}MB"
                else
                    check_warn "High memory usage: ${PM2_MEM_MB}MB"
                fi
            fi
        else
            check_fail "VEX is $PM2_STATUS" "Restart with: pm2 restart vex"
            if [ "$AUTO_FIX" = true ]; then
                pm2 restart vex && fix_success "VEX restarted" || fix_failed "VEX restart"
            fi
        fi
    else
        check_fail "VEX not in PM2" "Start with: cd /var/www/vex && pm2 start npm --name 'vex' -- start"
        if [ "$AUTO_FIX" = true ] && [ -d "$PROJECT_DIR" ]; then
            cd "$PROJECT_DIR"
            pm2 start npm --name "vex" -- start && fix_success "VEX started" || fix_failed "VEX start"
        fi
    fi
else
    check_fail "PM2 not installed" "Install with: npm install -g pm2"
    if [ "$AUTO_FIX" = true ]; then
        npm install -g pm2 && fix_success "PM2 installed" || fix_failed "PM2 installation"
    fi
fi

# ===========================================
# PostgreSQL Check
# ===========================================
print_header "4. PostgreSQL Database / قاعدة البيانات"

if command -v psql &> /dev/null; then
    check_pass "PostgreSQL client installed"
else
    check_fail "PostgreSQL client not found" "Install: apt install postgresql-client"
fi

if systemctl is-active --quiet postgresql; then
    check_pass "PostgreSQL service is running"
    
    # Check if we can connect
    if [ -f "$PROJECT_DIR/.env" ]; then
        DB_URL=$(grep "^DATABASE_URL=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2-)
        if [ ! -z "$DB_URL" ]; then
            if psql "$DB_URL" -c "SELECT 1;" &>/dev/null; then
                check_pass "Database connection successful"
                
                # Check database size
                DB_SIZE=$(psql "$DB_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | xargs)
                if [ ! -z "$DB_SIZE" ]; then
                    check_pass "Database size: $DB_SIZE"
                fi
            else
                check_fail "Database connection failed" "Check DATABASE_URL in .env"
            fi
        fi
    fi
else
    check_fail "PostgreSQL is not running" "Start with: sudo systemctl start postgresql"
    if [ "$AUTO_FIX" = true ]; then
        sudo systemctl start postgresql && fix_success "PostgreSQL started" || fix_failed "PostgreSQL start"
    fi
fi

# ===========================================
# Nginx Check
# ===========================================
print_header "5. Nginx Web Server / خادم الويب"

if command -v nginx &> /dev/null; then
    check_pass "Nginx installed"
else
    check_fail "Nginx not installed" "Install: apt install nginx"
fi

if systemctl is-active --quiet nginx; then
    check_pass "Nginx service is running"
else
    check_fail "Nginx is not running" "Start with: sudo systemctl start nginx"
    if [ "$AUTO_FIX" = true ]; then
        sudo systemctl start nginx && fix_success "Nginx started" || fix_failed "Nginx start"
    fi
fi

# Check Nginx config
if sudo nginx -t 2>&1 | grep -q "successful"; then
    check_pass "Nginx configuration is valid"
else
    check_fail "Nginx configuration error" "Run: sudo nginx -t to see details"
fi

# Check if VEX site is enabled
if [ -f /etc/nginx/sites-enabled/vex ]; then
    check_pass "VEX site is enabled in Nginx"
else
    check_warn "VEX site not found in Nginx"
fi

# ===========================================
# Network & Ports Check
# ===========================================
print_header "6. Network & Ports / الشبكة والمنافذ"

# Check port 5000
if netstat -tlnp 2>/dev/null | grep -q ":5000" || ss -tlnp 2>/dev/null | grep -q ":5000"; then
    check_pass "Port 5000 is listening (Node.js)"
else
    check_fail "Port 5000 is not listening" "Application might not be running"
fi

# Check port 80
if netstat -tlnp 2>/dev/null | grep -q ":80" || ss -tlnp 2>/dev/null | grep -q ":80"; then
    check_pass "Port 80 is listening (HTTP)"
else
    check_warn "Port 80 is not listening"
fi

# Check port 443
if netstat -tlnp 2>/dev/null | grep -q ":443" || ss -tlnp 2>/dev/null | grep -q ":443"; then
    check_pass "Port 443 is listening (HTTPS)"
else
    check_warn "Port 443 is not listening (SSL not configured?)"
fi

# ===========================================
# Project Files Check
# ===========================================
print_header "7. Project Files / ملفات المشروع"

if [ -d "$PROJECT_DIR" ]; then
    check_pass "Project directory exists: $PROJECT_DIR"
    
    cd "$PROJECT_DIR"
    
    # Check essential files
    [ -f "package.json" ] && check_pass "package.json exists" || check_fail "package.json missing" "Reinstall the project"
    [ -f ".env" ] && check_pass ".env file exists" || check_fail ".env file missing" "Create from .env.example"
    [ -d "node_modules" ] && check_pass "node_modules exists" || check_fail "node_modules missing" "Run: npm install"
    [ -d "dist" ] && check_pass "dist directory exists (built)" || check_fail "dist missing" "Run: npm run build"
    
    # Check .env variables
    if [ -f ".env" ]; then
        echo -e "\n${BLUE}Environment Variables:${NC}"
        grep -q "^DATABASE_URL=" .env && check_pass "DATABASE_URL is set" || check_fail "DATABASE_URL missing" "Add to .env"
        grep -q "^SESSION_SECRET=" .env && check_pass "SESSION_SECRET is set" || check_fail "SESSION_SECRET missing" "Add to .env"
        grep -q "^JWT_SECRET=" .env && check_pass "JWT_SECRET is set" || check_fail "JWT_SECRET missing" "Add to .env"
        grep -q "^NODE_ENV=" .env && check_pass "NODE_ENV is set" || check_warn "NODE_ENV not set (defaults to development)"
    fi
else
    check_fail "Project directory not found" "Run install.sh or create $PROJECT_DIR"
fi

# ===========================================
# SSL Certificate Check
# ===========================================
print_header "8. SSL Certificate / شهادة SSL"

if [ -d "/etc/letsencrypt/live" ]; then
    CERT_DIR=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | head -1)
    if [ -f "${CERT_DIR}fullchain.pem" ]; then
        CERT_EXPIRY=$(sudo openssl x509 -enddate -noout -in "${CERT_DIR}fullchain.pem" 2>/dev/null | cut -d= -f2)
        CERT_DAYS=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))
        
        if [ "$CERT_DAYS" -gt 30 ]; then
            check_pass "SSL certificate valid ($CERT_DAYS days remaining)"
        elif [ "$CERT_DAYS" -gt 7 ]; then
            check_warn "SSL expires soon ($CERT_DAYS days)"
        else
            check_fail "SSL expires in $CERT_DAYS days!" "Run: sudo certbot renew"
            if [ "$AUTO_FIX" = true ]; then
                sudo certbot renew && fix_success "SSL renewed" || fix_failed "SSL renewal"
            fi
        fi
    else
        check_warn "SSL certificate not found"
    fi
else
    check_warn "Let's Encrypt not configured"
    check_info "Setup SSL with: sudo certbot --nginx"
fi

# ===========================================
# Recent Logs
# ===========================================
print_header "9. Recent Logs / السجلات الأخيرة"

echo -e "${CYAN}Application Logs (last 15 lines):${NC}"
echo -e "${YELLOW}────────────────────────────────────────${NC}"
pm2 logs vex --lines 15 --nostream 2>/dev/null || echo "No PM2 logs available"
echo -e "${YELLOW}────────────────────────────────────────${NC}"

# Check for common errors in logs
if pm2 logs vex --lines 100 --nostream 2>/dev/null | grep -qi "error\|exception\|failed"; then
    check_warn "Errors found in recent logs - review with: pm2 logs vex"
fi

# ===========================================
# Summary
# ===========================================
print_header "Summary / الملخص"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  All checks passed! VEX is healthy.    ║${NC}"
    echo -e "${GREEN}║  جميع الفحوصات ناجحة! VEX يعمل بشكل جيد ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
else
    echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  Issues found: $ISSUES_FOUND                          ║${NC}"
    if [ "$AUTO_FIX" = true ]; then
        echo -e "${YELLOW}║  Issues fixed: $ISSUES_FIXED                          ║${NC}"
    fi
    echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
    
    if [ "$AUTO_FIX" = false ]; then
        echo
        echo -e "${CYAN}Run with --fix flag to auto-fix issues:${NC}"
        echo -e "  ${YELLOW}sudo bash troubleshoot.sh --fix${NC}"
    fi
fi

echo
echo -e "${CYAN}Useful Commands / أوامر مفيدة:${NC}"
echo -e "  ${YELLOW}pm2 status${NC}           - Process status"
echo -e "  ${YELLOW}pm2 logs vex${NC}         - Application logs"
echo -e "  ${YELLOW}pm2 restart vex${NC}      - Restart application"
echo -e "  ${YELLOW}pm2 monit${NC}            - Monitor dashboard"
echo -e "  ${YELLOW}sudo nginx -t${NC}        - Test Nginx config"
echo -e "  ${YELLOW}sudo certbot renew${NC}   - Renew SSL"
