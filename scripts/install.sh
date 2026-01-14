#!/bin/bash

# ========================================
# VEX Automatic Installation Script
# سكربت التثبيت التلقائي لـ VEX
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run this script as root: sudo bash install.sh"
        exit 1
    fi
}

# Get user input
get_user_input() {
    print_header "Configuration / الإعدادات"
    
    read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN_NAME
    read -p "Enter your email (for SSL certificate): " EMAIL
    read -s -p "Enter a strong database password: " DB_PASSWORD
    echo
    read -s -p "Enter a strong session secret (32+ characters): " SESSION_SECRET
    echo
    read -s -p "Enter a strong JWT secret (32+ characters): " JWT_SECRET
    echo
    
    # Validate inputs
    if [ -z "$DOMAIN_NAME" ] || [ -z "$EMAIL" ] || [ -z "$DB_PASSWORD" ] || [ -z "$SESSION_SECRET" ] || [ -z "$JWT_SECRET" ]; then
        print_error "All fields are required!"
        exit 1
    fi
    
    print_success "Configuration saved"
}

# Update system
update_system() {
    print_header "Updating System / تحديث النظام"
    
    apt update
    apt upgrade -y
    apt install -y curl wget git build-essential
    
    print_success "System updated"
}

# Install Node.js
install_nodejs() {
    print_header "Installing Node.js 20 / تثبيت Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            print_warning "Node.js 20+ already installed"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    print_success "Node.js $(node -v) installed"
    print_success "npm $(npm -v) installed"
}

# Install PostgreSQL
install_postgresql() {
    print_header "Installing PostgreSQL / تثبيت PostgreSQL"
    
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql <<EOF
DROP USER IF EXISTS vex_user;
CREATE USER vex_user WITH PASSWORD '$DB_PASSWORD';
DROP DATABASE IF EXISTS vex_db;
CREATE DATABASE vex_db OWNER vex_user;
GRANT ALL PRIVILEGES ON DATABASE vex_db TO vex_user;
EOF
    
    print_success "PostgreSQL installed and configured"
    print_success "Database: vex_db"
    print_success "User: vex_user"
}

# Install Nginx
install_nginx() {
    print_header "Installing Nginx / تثبيت Nginx"
    
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    
    print_success "Nginx installed"
}

# Install PM2
install_pm2() {
    print_header "Installing PM2 / تثبيت PM2"
    
    npm install -g pm2
    
    print_success "PM2 $(pm2 -v) installed"
}

# Setup firewall
setup_firewall() {
    print_header "Configuring Firewall / إعداد جدار الحماية"
    
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
    
    print_success "Firewall configured"
}

# Clone or setup project
setup_project() {
    print_header "Setting Up Project / إعداد المشروع"
    
    PROJECT_DIR="/var/www/vex"
    
    # Create directory if not exists
    mkdir -p $PROJECT_DIR
    
    # Check if we're running from within the project
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    
    if [ -f "$PARENT_DIR/package.json" ]; then
        print_info "Copying project files to $PROJECT_DIR"
        cp -r "$PARENT_DIR"/* $PROJECT_DIR/
        cp -r "$PARENT_DIR"/.[!.]* $PROJECT_DIR/ 2>/dev/null || true
    else
        print_warning "Please copy your project files to $PROJECT_DIR manually"
        print_info "Or use: git clone YOUR_REPO_URL $PROJECT_DIR"
        read -p "Press Enter after copying files to continue..."
    fi
    
    cd $PROJECT_DIR
    
    # Create .env file
    cat > .env <<EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://vex_user:${DB_PASSWORD}@localhost:5432/vex_db
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}
APP_URL=https://${DOMAIN_NAME}
EOF
    
    print_success ".env file created"
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm install
    
    # Build project
    print_info "Building project..."
    npm run build
    
    # Run database migrations
    print_info "Running database migrations..."
    npm run db:push
    
    print_success "Project setup complete"
}

# Configure Nginx
configure_nginx() {
    print_header "Configuring Nginx / إعداد Nginx"
    
    cat > /etc/nginx/sites-available/vex <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/vex /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload
    nginx -t
    systemctl reload nginx
    
    print_success "Nginx configured"
}

# Setup SSL
setup_ssl() {
    print_header "Setting Up SSL / إعداد SSL"
    
    apt install -y certbot python3-certbot-nginx
    
    print_info "Getting SSL certificate..."
    certbot --nginx -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME} --email ${EMAIL} --agree-tos --non-interactive --redirect
    
    # Setup auto-renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    print_success "SSL certificate installed"
    print_success "Auto-renewal configured"
}

# Start application
start_application() {
    print_header "Starting Application / تشغيل التطبيق"
    
    cd /var/www/vex
    
    # Stop existing if running
    pm2 delete vex 2>/dev/null || true
    
    # Start with PM2
    pm2 start npm --name "vex" -- start
    
    # Save and setup startup
    pm2 save
    pm2 startup systemd -u root --hp /root
    
    print_success "Application started"
}

# Print summary
print_summary() {
    print_header "Installation Complete! / اكتمل التثبيت!"
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Your VEX application is now running!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo -e "Website: ${BLUE}https://${DOMAIN_NAME}${NC}"
    echo
    echo -e "Database Info:"
    echo -e "  - Host: localhost"
    echo -e "  - Port: 5432"
    echo -e "  - Database: vex_db"
    echo -e "  - User: vex_user"
    echo
    echo -e "Useful Commands:"
    echo -e "  - Check status: ${YELLOW}pm2 status${NC}"
    echo -e "  - View logs: ${YELLOW}pm2 logs vex${NC}"
    echo -e "  - Restart app: ${YELLOW}pm2 restart vex${NC}"
    echo
    echo -e "${GREEN}Thank you for using VEX!${NC}"
}

# Show help
show_help() {
    echo "VEX Installation Script"
    echo ""
    echo "Usage: sudo bash install.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help      Show this help message"
    echo "  --quick     Quick install (skip prompts, use defaults)"
    echo ""
    echo "Examples:"
    echo "  sudo bash install.sh           # Interactive installation"
    echo "  sudo bash install.sh --help    # Show this help"
}

# Main installation flow
main() {
    # Check for help flag
    if [ "$1" == "--help" ]; then
        show_help
        exit 0
    fi
    
    print_header "VEX Installation Script / سكربت تثبيت VEX"
    print_info "This script will install and configure VEX on your server"
    print_info "سيقوم هذا السكربت بتثبيت وإعداد VEX على سيرفرك"
    echo
    
    check_root
    get_user_input
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    install_pm2
    setup_firewall
    setup_project
    configure_nginx
    setup_ssl
    start_application
    print_summary
}

# Run main function
main "$@"
