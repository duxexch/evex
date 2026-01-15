#!/bin/bash

# ========================================
# VEX Database Backup Script v2.0
# سكربت النسخ الاحتياطي لقاعدة البيانات
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
KEEP_BACKUPS=10
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

print_header "VEX Database Backup Tool v2.0"
print_header "أداة النسخ الاحتياطي لقاعدة البيانات"

# Try to find .env file
if [ -f ".env" ]; then
    source .env 2>/dev/null || export $(cat .env | grep -v '^#' | xargs)
elif [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env" 2>/dev/null || export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL is not set!"
    print_info "Set it in .env file or export DATABASE_URL=postgresql://..."
    exit 1
fi
print_success "DATABASE_URL found"

# Check pg_dump
if ! command -v pg_dump &> /dev/null; then
    print_error "pg_dump not found!"
    print_info "Install: apt install postgresql-client"
    exit 1
fi
print_success "pg_dump available"

# Create backup directory
mkdir -p "$BACKUP_DIR"
print_success "Backup directory: $BACKUP_DIR"

# Parse command line options
BACKUP_TYPE="full"
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --schema-only)
            BACKUP_TYPE="schema"
            shift
            ;;
        --data-only)
            BACKUP_TYPE="data"
            shift
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --help)
            echo "VEX Database Backup Tool"
            echo ""
            echo "Usage: bash backup-db.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --schema-only    Backup schema only (no data)"
            echo "  --data-only      Backup data only (no schema)"
            echo "  -o, --output     Specify output file name"
            echo "  --help           Show this help"
            echo ""
            echo "Examples:"
            echo "  bash backup-db.sh                    # Full backup"
            echo "  bash backup-db.sh --schema-only      # Schema only"
            echo "  bash backup-db.sh -o mybackup.sql.gz # Custom name"
            exit 0
            ;;
        *)
            print_warning "Unknown option: $1"
            shift
            ;;
    esac
done

# Set output file name
if [ -z "$OUTPUT_FILE" ]; then
    case $BACKUP_TYPE in
        schema)
            BACKUP_FILE="$BACKUP_DIR/vex_schema_$TIMESTAMP.sql.gz"
            ;;
        data)
            BACKUP_FILE="$BACKUP_DIR/vex_data_$TIMESTAMP.sql.gz"
            ;;
        *)
            BACKUP_FILE="$BACKUP_DIR/vex_full_$TIMESTAMP.sql.gz"
            ;;
    esac
else
    BACKUP_FILE="$BACKUP_DIR/$OUTPUT_FILE"
fi

# Create backup
print_info "Creating $BACKUP_TYPE backup..."
print_info "This may take a while for large databases..."

PG_DUMP_OPTS=""
case $BACKUP_TYPE in
    schema)
        PG_DUMP_OPTS="--schema-only"
        ;;
    data)
        PG_DUMP_OPTS="--data-only"
        ;;
esac

# Execute backup with progress indicator
if pg_dump $PG_DUMP_OPTS --no-owner --no-acl "$DATABASE_URL" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    print_success "Backup created successfully!"
else
    print_error "Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Get file info
SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
ROWS=""
if [ "$BACKUP_TYPE" != "schema" ]; then
    # Count approximate rows in main tables
    ROWS=$(psql "$DATABASE_URL" -t -c "SELECT SUM(n_live_tup) FROM pg_stat_user_tables;" 2>/dev/null | xargs)
fi

# Print summary
print_header "Backup Complete! / اكتمل النسخ الاحتياطي!"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Backup Summary / ملخص النسخة الاحتياطية                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "  ${CYAN}File:${NC} $BACKUP_FILE"
echo -e "  ${CYAN}Size:${NC} $SIZE"
echo -e "  ${CYAN}Type:${NC} $BACKUP_TYPE"
echo -e "  ${CYAN}Time:${NC} $(date)"
[ ! -z "$ROWS" ] && echo -e "  ${CYAN}Rows:${NC} ~$ROWS"

# Clean old backups
print_info "Cleaning old backups (keeping last $KEEP_BACKUPS)..."
cd "$BACKUP_DIR"
ls -t vex_*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -- 2>/dev/null || true

# List recent backups
echo
echo -e "${CYAN}Recent Backups:${NC}"
ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -5 || echo "No backups found"

# Restore instructions
echo
echo -e "${CYAN}To restore this backup:${NC}"
echo -e "  ${YELLOW}gunzip -c $BACKUP_FILE | psql \"\$DATABASE_URL\"${NC}"
echo
echo -e "${GREEN}Done! / تم!${NC}"
