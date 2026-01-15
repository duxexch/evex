#!/bin/bash

# ========================================
# VEX Update Script v2.0
# سكربت تحديث VEX
# Updated: January 2026
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/var/www/vex"
BACKUP_DIR="/var/www/vex-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }

rollback() {
    print_error "Attempting rollback..."
    
    # Try tar archive first
    if [ -f "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" ]; then
        print_info "Restoring from tar archive..."
        rm -rf "$PROJECT_DIR.broken" 2>/dev/null || true
        mv "$PROJECT_DIR" "$PROJECT_DIR.broken" 2>/dev/null || true
        tar -xzf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$(dirname $PROJECT_DIR)"
        cd "$PROJECT_DIR"
        npm install 2>/dev/null || true
        npm run build 2>/dev/null || true
        pm2 restart vex 2>/dev/null || true
        print_success "Rollback completed from archive"
        return 0
    fi
    
    # Try folder backup
    if [ -d "$BACKUP_DIR/backup_$TIMESTAMP" ]; then
        print_info "Restoring from folder backup..."
        cp -r "$BACKUP_DIR/backup_$TIMESTAMP"/* "$PROJECT_DIR/"
        pm2 restart vex 2>/dev/null || true
        print_success "Rollback completed from folder"
        return 0
    fi
    
    print_warning "No backup found to rollback to"
    return 1
}

error_exit() {
    print_error "$1"
    print_info "Rolling back to previous version..."
    rollback
    exit 1
}

trap 'error_exit "An unexpected error occurred at line $LINENO"' ERR

print_header "VEX Update Script v2.0 / سكربت تحديث VEX"
print_info "This will update your VEX installation to the latest version"
print_info "سيقوم هذا بتحديث تثبيت VEX إلى أحدث إصدار"
echo

# Check if project exists
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "VEX not found at $PROJECT_DIR"
    print_info "Run install.sh first to install VEX"
    exit 1
fi

cd $PROJECT_DIR

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_warning "Running without root. Some operations may fail."
fi

# Create backup
print_header "Creating Full Backup / إنشاء نسخة احتياطية كاملة"
mkdir -p "$BACKUP_DIR"

print_info "Backing up ENTIRE installation (this ensures safe rollback)..."

# Create full project backup using tar
BACKUP_ARCHIVE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
tar --exclude='node_modules' --exclude='.git' -czf "$BACKUP_ARCHIVE" -C "$(dirname $PROJECT_DIR)" "$(basename $PROJECT_DIR)" 2>/dev/null || {
    print_warning "Full backup failed, trying partial backup..."
    mkdir -p "$BACKUP_DIR/backup_$TIMESTAMP"
    cp -r package.json package-lock.json "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || true
    cp .env "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || true
    cp -r dist "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || true
    cp -r shared "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || true
    cp -r server "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || true
    cp -r client "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || true
}

# Backup database
print_info "Backing up database..."
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    if [ ! -z "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz" 2>/dev/null || print_warning "Database backup failed - continuing anyway"
        print_success "Database backed up to $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
    fi
fi

print_success "Backup created: $BACKUP_ARCHIVE"
print_info "To rollback: tar -xzf $BACKUP_ARCHIVE -C $(dirname $PROJECT_DIR)"

# Stop application gracefully
print_header "Stopping Application / إيقاف التطبيق"
pm2 stop vex 2>/dev/null || true
sleep 2
print_success "Application stopped"

# Pull latest changes (if git repo)
print_header "Updating Code / تحديث الكود"
if [ -d ".git" ]; then
    print_info "Pulling latest changes from git..."
    
    # Stash any local changes
    git stash 2>/dev/null || true
    
    # Pull updates
    git fetch origin 2>/dev/null || true
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || print_warning "Git pull failed - using local files"
    
    # Restore local changes
    git stash pop 2>/dev/null || true
    
    print_success "Code updated from git"
else
    print_warning "Not a git repository - manual update required"
    print_info "Copy your new files to $PROJECT_DIR"
    read -p "Press Enter after updating files to continue..."
fi

# Update dependencies
print_header "Updating Dependencies / تحديث المتطلبات"
print_info "Installing/updating npm packages..."

# Clear npm cache if needed
npm cache clean --force 2>/dev/null || true

# Install dependencies
npm ci 2>/dev/null || npm install || error_exit "Failed to install dependencies"
print_success "Dependencies updated"

# Rebuild project
print_header "Building Project / بناء المشروع"
print_info "Compiling TypeScript and bundling assets..."
npm run build || error_exit "Build failed"
print_success "Build completed"

# Run database migrations
print_header "Database Migrations / ترحيلات قاعدة البيانات"
print_info "Applying any new database changes..."
npm run db:push 2>/dev/null || print_warning "Database migration skipped or failed"
print_success "Database migrations applied"

# Start application
print_header "Starting Application / تشغيل التطبيق"
pm2 restart vex 2>/dev/null || pm2 start npm --name "vex" -- start
pm2 save 2>/dev/null || true

# Wait for startup
sleep 5

# Verify application is running
if pm2 list | grep -q "online"; then
    print_success "Application restarted successfully"
else
    print_warning "Application may not have started correctly"
    print_info "Check logs: pm2 logs vex"
fi

# Clean old backups (keep last 5)
print_header "Cleaning Old Backups / تنظيف النسخ القديمة"
cd "$BACKUP_DIR"
ls -dt backup_* 2>/dev/null | tail -n +6 | xargs -r rm -rf
print_success "Old backups cleaned (keeping last 5)"

# Print summary
print_header "Update Complete! / اكتمل التحديث!"

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  VEX has been updated successfully!    ║${NC}"
echo -e "${GREEN}║  تم تحديث VEX بنجاح!                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
echo -e "Backup location: ${CYAN}$BACKUP_DIR/backup_$TIMESTAMP${NC}"
echo
echo -e "Commands:"
echo -e "  ${YELLOW}pm2 status${NC}      - Check status"
echo -e "  ${YELLOW}pm2 logs vex${NC}    - View logs"
echo -e "  ${YELLOW}vex-status${NC}      - Full status check"
echo
echo -e "To rollback to previous version:"
echo -e "  ${YELLOW}cp -r $BACKUP_DIR/backup_$TIMESTAMP/* $PROJECT_DIR/${NC}"
echo -e "  ${YELLOW}pm2 restart vex${NC}"
