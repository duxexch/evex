#!/bin/bash

# ========================================
# VEX Automatic Installation Script v2.0
# سكربت التثبيت التلقائي لـ VEX
# Updated: January 2026
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Error handling
error_exit() {
    print_error "$1"
    print_info "Installation failed. Run ./scripts/troubleshoot.sh for diagnostics"
    exit 1
}

trap 'error_exit "An unexpected error occurred at line $LINENO"' ERR

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run this script as root: sudo bash install.sh"
        print_info "أرجو تشغيل السكربت كـ root: sudo bash install.sh"
        exit 1
    fi
    print_success "Running as root"
}

# Detect and validate OS
detect_os() {
    print_header "Detecting Operating System / كشف نظام التشغيل"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
        print_success "Detected: $OS $VER"
    else
        print_error "Could not detect OS"
        exit 1
    fi
    
    # This script is designed for Ubuntu/Debian only
    case "$OS" in
        *Ubuntu*)
            PKG_MANAGER="apt"
            print_success "Ubuntu detected - fully supported"
            ;;
        *Debian*)
            PKG_MANAGER="apt"
            print_success "Debian detected - fully supported"
            ;;
        *CentOS*|*Red*|*Fedora*|*Rocky*|*Alma*)
            print_error "CentOS/RHEL/Fedora detected"
            print_error "This script only supports Ubuntu/Debian"
            print_info "For RHEL-based systems, manual installation is required"
            print_info "See DEPLOYMENT.md for manual installation steps"
            exit 1
            ;;
        *)
            print_error "Unsupported OS: $OS"
            print_error "This script only supports Ubuntu 20.04+ and Debian 11+"
            print_info "Recommended: Ubuntu 22.04 LTS on Hostinger VPS"
            exit 1
            ;;
    esac
    
    # Check Ubuntu/Debian version
    if [[ "$OS" == *"Ubuntu"* ]]; then
        MAJOR_VER=$(echo $VER | cut -d. -f1)
        if [ "$MAJOR_VER" -lt 20 ]; then
            print_warning "Ubuntu $VER detected - version 20.04+ recommended"
        else
            print_success "Ubuntu version OK"
        fi
    fi
}

# Get user input
get_user_input() {
    print_header "Configuration / الإعدادات"
    
    # Domain
    while true; do
        read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN_NAME
        if [[ "$DOMAIN_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            break
        else
            print_error "Invalid domain format. Please enter a valid domain."
        fi
    done
    
    # Email
    while true; do
        read -p "Enter your email (for SSL certificate): " EMAIL
        if [[ "$EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            break
        else
            print_error "Invalid email format. Please enter a valid email."
        fi
    done
    
    # Database password
    while true; do
        read -s -p "Enter a strong database password (min 12 chars): " DB_PASSWORD
        echo
        if [ ${#DB_PASSWORD} -ge 12 ]; then
            break
        else
            print_error "Password must be at least 12 characters."
        fi
    done
    
    # Session secret (auto-generate if empty)
    read -s -p "Enter session secret (press Enter to auto-generate): " SESSION_SECRET
    echo
    if [ -z "$SESSION_SECRET" ]; then
        SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
        print_info "Auto-generated session secret"
    fi
    
    # JWT secret (auto-generate if empty)
    read -s -p "Enter JWT secret (press Enter to auto-generate): " JWT_SECRET
    echo
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
        print_info "Auto-generated JWT secret"
    fi
    
    print_success "Configuration saved"
}

# Update system
update_system() {
    print_header "Updating System / تحديث النظام"
    
    # Only apt is supported (we exit early for non-Debian systems)
    apt update || error_exit "Failed to update package list"
    DEBIAN_FRONTEND=noninteractive apt upgrade -y || print_warning "Some packages failed to upgrade"
    apt install -y curl wget git build-essential unzip gnupg2 ca-certificates lsb-release software-properties-common net-tools rsync || error_exit "Failed to install basic packages"
    
    print_success "System updated"
}

# Install Node.js
install_nodejs() {
    print_header "Installing Node.js 20 LTS / تثبيت Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            print_warning "Node.js 20+ already installed ($(node -v))"
            return 0
        else
            print_info "Upgrading Node.js from v$NODE_VERSION to v20..."
        fi
    fi
    
    # Remove old nodejs if exists
    apt remove -y nodejs npm 2>/dev/null || true
    rm -rf /usr/local/lib/node_modules 2>/dev/null || true
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || error_exit "Failed to setup NodeSource repository"
    apt install -y nodejs || error_exit "Failed to install Node.js"
    
    # Verify installation
    node -v || error_exit "Node.js installation verification failed"
    npm -v || error_exit "npm installation verification failed"
    
    # Update npm to latest
    npm install -g npm@latest 2>/dev/null || true
    
    print_success "Node.js $(node -v) installed"
    print_success "npm $(npm -v) installed"
}

# Install PostgreSQL
install_postgresql() {
    print_header "Installing PostgreSQL 15 / تثبيت PostgreSQL"
    
    if systemctl is-active --quiet postgresql; then
        print_warning "PostgreSQL already installed and running"
    else
        # Add PostgreSQL repository for latest version
        sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' 2>/dev/null || true
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - 2>/dev/null || true
        apt update 2>/dev/null || true
        
        apt install -y postgresql postgresql-contrib || error_exit "Failed to install PostgreSQL"
        systemctl start postgresql || error_exit "Failed to start PostgreSQL"
        systemctl enable postgresql || true
    fi
    
    # Wait for PostgreSQL to be ready
    sleep 3
    
    # Create database and user with error handling
    print_info "Creating database and user..."
    sudo -u postgres psql -c "DROP USER IF EXISTS vex_user;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER vex_user WITH PASSWORD '$DB_PASSWORD';" || error_exit "Failed to create database user"
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS vex_db;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE vex_db OWNER vex_user;" || error_exit "Failed to create database"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vex_db TO vex_user;" || true
    sudo -u postgres psql -c "ALTER USER vex_user CREATEDB;" || true
    
    # Configure PostgreSQL for local connections
    PG_HBA=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
    if [ -f "$PG_HBA" ]; then
        # Backup original
        cp "$PG_HBA" "${PG_HBA}.backup"
        # Ensure md5 authentication for local connections
        sed -i 's/peer$/md5/g' "$PG_HBA" 2>/dev/null || true
        systemctl reload postgresql
    fi
    
    print_success "PostgreSQL installed and configured"
    print_success "Database: vex_db | User: vex_user"
}

# Install Nginx
install_nginx() {
    print_header "Installing Nginx / تثبيت Nginx"
    
    if systemctl is-active --quiet nginx; then
        print_warning "Nginx already installed and running"
        return 0
    fi
    
    apt install -y nginx || error_exit "Failed to install Nginx"
    systemctl start nginx || error_exit "Failed to start Nginx"
    systemctl enable nginx || true
    
    print_success "Nginx installed and running"
}

# Install PM2
install_pm2() {
    print_header "Installing PM2 / تثبيت PM2"
    
    if command -v pm2 &> /dev/null; then
        print_warning "PM2 already installed ($(pm2 -v))"
        npm update -g pm2 2>/dev/null || true
    else
        npm install -g pm2 || error_exit "Failed to install PM2"
    fi
    
    print_success "PM2 $(pm2 -v) installed"
}

# Setup firewall
setup_firewall() {
    print_header "Configuring Firewall / إعداد جدار الحماية"
    
    if ! command -v ufw &> /dev/null; then
        apt install -y ufw || print_warning "Failed to install ufw"
    fi
    
    if command -v ufw &> /dev/null; then
        ufw allow OpenSSH || true
        ufw allow 'Nginx Full' || true
        ufw allow 80/tcp || true
        ufw allow 443/tcp || true
        echo "y" | ufw enable 2>/dev/null || true
        print_success "Firewall configured (ports: 22, 80, 443)"
    else
        print_warning "Firewall not configured - please configure manually"
    fi
}

# Setup project
setup_project() {
    print_header "Setting Up Project / إعداد المشروع"
    
    PROJECT_DIR="/var/www/vex"
    
    # Create directory
    mkdir -p $PROJECT_DIR
    
    # Determine source directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    
    if [ -f "$PARENT_DIR/package.json" ]; then
        print_info "Copying project files to $PROJECT_DIR..."
        
        # Copy all files including hidden
        rsync -av --exclude='node_modules' --exclude='.git' --exclude='dist' "$PARENT_DIR/" "$PROJECT_DIR/" 2>/dev/null || \
        cp -r "$PARENT_DIR"/* "$PROJECT_DIR/"
        
        cp -r "$PARENT_DIR"/.[!.]* "$PROJECT_DIR/" 2>/dev/null || true
    else
        print_warning "Project files not found in parent directory"
        print_info "Please copy your project files to $PROJECT_DIR manually"
        print_info "Or clone from git: git clone YOUR_REPO_URL $PROJECT_DIR"
        read -p "Press Enter after copying files to continue..."
    fi
    
    cd $PROJECT_DIR
    
    # Create .env file
    print_info "Creating environment configuration..."
    cat > .env <<EOF
# VEX Environment Configuration
# تكوين بيئة VEX
# Generated: $(date)

NODE_ENV=production
PORT=5000

# Database (sslmode=disable for local PostgreSQL)
DATABASE_URL=postgresql://vex_user:${DB_PASSWORD}@localhost:5432/vex_db?sslmode=disable
PGHOST=localhost
PGPORT=5432
PGUSER=vex_user
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=vex_db

# Admin credentials (change after first login!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@${DOMAIN_NAME}

# Security
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# Application
APP_URL=https://${DOMAIN_NAME}
TRUST_PROXY=true

# Rate Limiting (per minute)
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
EOF
    
    # Set proper permissions
    chmod 600 .env
    
    print_success ".env file created"
    
    # Install dependencies
    print_info "Installing dependencies (this may take a few minutes)..."
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev || npm install || error_exit "Failed to install dependencies"
    
    # Build project
    print_info "Building project..."
    npm run build || error_exit "Failed to build project"
    
    # Verify build output exists
    if [ ! -f "dist/index.cjs" ]; then
        error_exit "Build verification failed: dist/index.cjs not found"
    fi
    print_success "Build verified: dist/index.cjs exists"
    
    # Run database migrations
    print_info "Running database migrations..."
    npm run db:push || error_exit "Failed to run database migrations"
    
    # Create admin user
    print_info "Creating admin user..."
    export $(cat .env | grep -v '^#' | xargs)
    bash scripts/seed-admin.sh || print_warning "Admin user creation skipped (may already exist)"
    
    print_success "Project setup complete"
}

# Configure Nginx
configure_nginx() {
    print_header "Configuring Nginx / إعداد Nginx"
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/vex <<EOF
# VEX Platform Nginx Configuration
# تكوين Nginx لمنصة VEX

# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=vex_limit:10m rate=10r/s;

upstream vex_backend {
    server 127.0.0.1:5050;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client settings
    client_max_body_size 50M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://vex_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://vex_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # API endpoints with rate limiting
    location /api {
        limit_req zone=vex_limit burst=20 nodelay;
        
        proxy_pass http://vex_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }

    # Main application
    location / {
        proxy_pass http://vex_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://vex_backend;
        access_log off;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/vex /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    # Test configuration
    nginx -t || error_exit "Nginx configuration test failed"
    
    # Reload Nginx
    systemctl reload nginx || error_exit "Failed to reload Nginx"
    
    print_success "Nginx configured for ${DOMAIN_NAME}"
}

# Setup SSL
setup_ssl() {
    print_header "Setting Up SSL Certificate / إعداد شهادة SSL"
    
    # Install certbot
    apt install -y certbot python3-certbot-nginx || error_exit "Failed to install certbot"
    
    print_info "Requesting SSL certificate for ${DOMAIN_NAME}..."
    print_warning "Make sure your domain DNS points to this server!"
    
    # Try to get certificate
    if certbot --nginx -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME} --email ${EMAIL} --agree-tos --non-interactive --redirect; then
        print_success "SSL certificate installed"
        
        # Setup auto-renewal
        (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
        print_success "Auto-renewal configured (daily at 3 AM)"
    else
        print_warning "SSL certificate installation failed"
        print_info "You can try again later with: sudo certbot --nginx -d ${DOMAIN_NAME}"
        print_info "Make sure your domain DNS is pointing to this server's IP"
    fi
}

# Start application
start_application() {
    print_header "Starting Application / تشغيل التطبيق"
    
    cd /var/www/vex
    
    # Load environment variables (CRITICAL: PM2 needs these!)
    print_info "Loading environment variables..."
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_success "Environment variables loaded"
    else
        error_exit ".env file not found"
    fi
    
    # Verify build file exists
    if [ ! -f "dist/index.cjs" ]; then
        error_exit "Build file dist/index.cjs not found. Run: npm run build"
    fi
    
    # Stop existing if running
    pm2 delete vex 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    
    # Create log directory
    mkdir -p /var/log/vex
    
    # Start with PM2 (using correct file path)
    print_info "Starting application with PM2..."
    pm2 start "node dist/index.cjs" --name "vex" --max-memory-restart 1G || error_exit "Failed to start application"
    
    # Save and setup startup
    pm2 save || print_warning "pm2 save failed"
    pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
    
    # Wait for application to start
    sleep 5
    
    # Verify application is running
    if pm2 list | grep -q "online"; then
        print_success "Application started successfully"
    else
        print_warning "Application may not have started correctly"
        print_info "Check logs with: pm2 logs vex"
    fi
}

# Create helper scripts
create_helper_scripts() {
    print_header "Creating Helper Scripts / إنشاء سكريبتات مساعدة"
    
    # Quick restart script
    cat > /usr/local/bin/vex-restart <<'EOF'
#!/bin/bash
cd /var/www/vex
pm2 restart vex
echo "VEX restarted!"
EOF
    chmod +x /usr/local/bin/vex-restart
    
    # Quick logs script
    cat > /usr/local/bin/vex-logs <<'EOF'
#!/bin/bash
pm2 logs vex --lines ${1:-50}
EOF
    chmod +x /usr/local/bin/vex-logs
    
    # Quick status script
    cat > /usr/local/bin/vex-status <<'EOF'
#!/bin/bash
echo "=== VEX Status ==="
pm2 status
echo ""
echo "=== Nginx Status ==="
systemctl status nginx --no-pager -l | head -5
echo ""
echo "=== PostgreSQL Status ==="
systemctl status postgresql --no-pager -l | head -5
EOF
    chmod +x /usr/local/bin/vex-status
    
    print_success "Helper commands created: vex-restart, vex-logs, vex-status"
}

# Print summary
print_summary() {
    print_header "Installation Complete! / اكتمل التثبيت!"
    
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  VEX Platform is now running!          ║${NC}"
    echo -e "${GREEN}║  منصة VEX تعمل الآن!                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo
    echo -e "${CYAN}Website / الموقع:${NC} https://${DOMAIN_NAME}"
    echo
    echo -e "${CYAN}Database Info / معلومات قاعدة البيانات:${NC}"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: vex_db"
    echo "  User: vex_user"
    echo
    echo -e "${CYAN}Quick Commands / أوامر سريعة:${NC}"
    echo -e "  ${YELLOW}vex-status${NC}   - Check status / التحقق من الحالة"
    echo -e "  ${YELLOW}vex-logs${NC}     - View logs / عرض السجلات"
    echo -e "  ${YELLOW}vex-restart${NC}  - Restart app / إعادة التشغيل"
    echo -e "  ${YELLOW}pm2 monit${NC}    - Monitor dashboard / لوحة المراقبة"
    echo
    echo -e "${CYAN}Files Location / موقع الملفات:${NC}"
    echo "  Project: /var/www/vex"
    echo "  Logs: /var/log/vex/"
    echo "  Nginx: /etc/nginx/sites-available/vex"
    echo
    echo -e "${GREEN}Thank you for using VEX! / شكراً لاستخدام VEX!${NC}"
}

# Show help
show_help() {
    echo "VEX Installation Script v2.0"
    echo "سكربت تثبيت VEX الإصدار 2.0"
    echo ""
    echo "Usage: sudo bash install.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help       Show this help message"
    echo "  --skip-ssl   Skip SSL certificate installation"
    echo "  --skip-fw    Skip firewall configuration"
    echo ""
    echo "Examples:"
    echo "  sudo bash install.sh           # Full installation"
    echo "  sudo bash install.sh --skip-ssl  # Skip SSL (configure later)"
}

# Main installation flow
main() {
    SKIP_SSL=false
    SKIP_FW=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --skip-ssl)
                SKIP_SSL=true
                shift
                ;;
            --skip-fw)
                SKIP_FW=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header "VEX Installation Script v2.0"
    print_info "This script will install and configure VEX on your server"
    print_info "سيقوم هذا السكربت بتثبيت وإعداد VEX على سيرفرك"
    echo
    
    check_root
    detect_os
    get_user_input
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    install_pm2
    
    if [ "$SKIP_FW" = false ]; then
        setup_firewall
    fi
    
    setup_project
    configure_nginx
    
    if [ "$SKIP_SSL" = false ]; then
        setup_ssl
    else
        print_warning "Skipping SSL - run 'sudo certbot --nginx' later"
    fi
    
    start_application
    create_helper_scripts
    print_summary
}

# Run main function
main "$@"
