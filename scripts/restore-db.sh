#!/bin/bash

# ========================================
# VEX Database Restore Script v2.0
# سكربت استعادة قاعدة البيانات
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

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }

# Configuration
PROJECT_DIR="/var/www/vex"
BACKUP_DIR="${PROJECT_DIR}/backups"

print_header "VEX Database Restore Tool v2.0"
print_header "أداة استعادة قاعدة البيانات"

# Load environment
if [ -f ".env" ]; then
    source .env 2>/dev/null || export $(cat .env | grep -v '^#' | xargs)
elif [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env" 2>/dev/null || export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL is not set!"
    exit 1
fi

# Check for backup file argument
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    # List available backups
    echo -e "${CYAN}Available backups:${NC}"
    echo
    
    if [ -d "$BACKUP_DIR" ]; then
        BACKUPS=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null)
        if [ -z "$BACKUPS" ]; then
            print_error "No backups found in $BACKUP_DIR"
            exit 1
        fi
        
        i=1
        for backup in $BACKUPS; do
            SIZE=$(du -sh "$backup" | cut -f1)
            DATE=$(basename "$backup" | grep -oP '\d{8}_\d{6}' || echo "unknown")
            echo "  $i) $(basename "$backup") ($SIZE)"
            i=$((i+1))
        done
        
        echo
        read -p "Enter backup number to restore (or full path): " CHOICE
        
        if [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
            BACKUP_FILE=$(echo "$BACKUPS" | sed -n "${CHOICE}p")
        else
            BACKUP_FILE="$CHOICE"
        fi
    else
        print_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
fi

# Validate backup file
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

print_success "Backup file: $BACKUP_FILE"

# Confirm restore
echo
print_warning "⚠️  WARNING: This will REPLACE all data in the database!"
print_warning "⚠️  تحذير: سيتم استبدال جميع البيانات في قاعدة البيانات!"
echo
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Restore cancelled"
    exit 0
fi

# Stop application
print_info "Stopping application..."
pm2 stop vex 2>/dev/null || true

# Create safety backup
print_info "Creating safety backup before restore..."
SAFETY_BACKUP="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump --no-owner --no-acl "$DATABASE_URL" 2>/dev/null | gzip > "$SAFETY_BACKUP" && \
    print_success "Safety backup: $SAFETY_BACKUP" || \
    print_warning "Could not create safety backup"

# Restore database
print_header "Restoring Database / استعادة قاعدة البيانات"

print_info "This may take a while for large databases..."

# Drop and recreate tables
if [[ "$BACKUP_FILE" == *".gz" ]]; then
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" 2>&1 | tail -5
else
    psql "$DATABASE_URL" < "$BACKUP_FILE" 2>&1 | tail -5
fi

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    print_success "Database restored successfully!"
else
    print_warning "Restore completed with some warnings (this is often normal)"
fi

# Restart application
print_info "Restarting application..."
pm2 restart vex 2>/dev/null || pm2 start npm --name "vex" -- start

print_header "Restore Complete! / اكتملت الاستعادة!"

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Database has been restored!           ║${NC}"
echo -e "${GREEN}║  تم استعادة قاعدة البيانات!            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
echo -e "  ${CYAN}Restored from:${NC} $BACKUP_FILE"
echo -e "  ${CYAN}Safety backup:${NC} $SAFETY_BACKUP"
echo
echo -e "${GREEN}Done! / تم!${NC}"
