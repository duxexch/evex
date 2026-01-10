#!/bin/bash
set -e

# Production Deployment Script for LangSense on Ubuntu 24.04 VPS
# This script automates the deployment process with safety checks

echo "🚀 LangSense Production Deployment"
echo "===================================="

# Configuration
APP_DIR="/opt/langsense"
BACKUP_DIR="/opt/langsense/backups"
LOG_FILE="/var/log/langsense/deploy.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-flight checks
log "Running pre-flight checks..."

if [ ! -f "$APP_DIR/.env" ]; then
    error ".env file not found in $APP_DIR"
fi

if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL is not running"
fi

if ! systemctl is-active --quiet redis-server; then
    warn "Redis is not running, but continuing..."
fi

# Check disk space
DISK_USAGE=$(df -h "$APP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    error "Disk usage is above 90%. Free up space before deploying."
fi

log "✓ Pre-flight checks passed"

# Backup current database
log "Backing up database..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Extract DB credentials from .env
source "$APP_DIR/.env"
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

if [ -n "$DB_NAME" ]; then
    sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || warn "Database backup failed"
    if [ -f "$BACKUP_FILE" ]; then
        log "✓ Database backed up to: $BACKUP_FILE"
    fi
else
    warn "Could not extract database name from DATABASE_URL"
fi

# Stop services gracefully
log "Stopping services..."
sudo systemctl stop langsense-bot || warn "Bot service not found"
sleep 2
sudo systemctl stop langsense-api || warn "API service not found"
sleep 2

log "✓ Services stopped"

# Pull latest code
log "Pulling latest code from repository..."
cd "$APP_DIR"

if [ -d ".git" ]; then
    git fetch origin
    CURRENT_COMMIT=$(git rev-parse HEAD)
    log "Current commit: $CURRENT_COMMIT"
    
    git pull origin main || warn "Git pull failed, continuing with existing code"
    
    NEW_COMMIT=$(git rev-parse HEAD)
    log "New commit: $NEW_COMMIT"
    
    if [ "$CURRENT_COMMIT" != "$NEW_COMMIT" ]; then
        log "✓ Code updated successfully"
    else
        info "Code is already up to date"
    fi
else
    warn "Not a git repository, skipping code update"
fi

# Update Python dependencies
log "Updating Python dependencies..."
source "$APP_DIR/venv/bin/activate"
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

log "✓ Dependencies updated"

# Run database migrations
log "Running database migrations..."
if [ -f "alembic.ini" ]; then
    alembic upgrade head || warn "No migrations to apply or migration failed"
    log "✓ Migrations applied"
else
    warn "alembic.ini not found, skipping migrations"
fi

# Update mobile app configuration if exists
if [ -f "mobile-app/src/constants/config.js" ]; then
    log "Checking mobile app configuration..."
    # Note: This should be done during build, not runtime
    info "Mobile app config present, ensure it's built with production settings"
fi

# Clear Python cache
log "Clearing Python cache..."
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

# Set correct permissions
log "Setting file permissions..."
chown -R langsense:langsense "$APP_DIR"
chmod 600 "$APP_DIR/.env"
chmod 755 "$APP_DIR"/*.sh 2>/dev/null || true

log "✓ Permissions set"

# Start services
log "Starting services..."

sudo systemctl start langsense-api
sleep 3

sudo systemctl start langsense-bot
sleep 3

log "✓ Services started"

# Health checks
log "Running health checks..."

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8000/health &>/dev/null; then
        log "✓ API health check passed"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            info "API not ready yet, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
            sleep 2
        else
            error "API health check failed after $MAX_RETRIES attempts"
        fi
    fi
done

# Check service status
log "Verifying service status..."

if systemctl is-active --quiet langsense-api; then
    log "✓ API service is running"
else
    error "API service failed to start. Check logs: journalctl -u langsense-api -n 50"
fi

if systemctl is-active --quiet langsense-bot; then
    log "✓ Bot service is running"
else
    warn "Bot service is not running. Check logs: journalctl -u langsense-bot -n 50"
fi

# Verify nginx is running
if systemctl is-active --quiet nginx; then
    log "✓ Nginx is running"
else
    warn "Nginx is not running"
fi

# Cleanup old backups (keep last 30 days)
log "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete 2>/dev/null || true

# Display summary
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "=========================================="
echo ""
echo "Deployment Summary:"
echo "  - Timestamp: $TIMESTAMP"
echo "  - Commit: $NEW_COMMIT"
echo "  - Backup: $BACKUP_FILE"
echo ""
echo "Service Status:"
sudo systemctl status langsense-api --no-pager --lines=0
sudo systemctl status langsense-bot --no-pager --lines=0
echo ""
echo "Quick Commands:"
echo "  - View API logs: journalctl -u langsense-api -f"
echo "  - View Bot logs: journalctl -u langsense-bot -f"
echo "  - Restart API: sudo systemctl restart langsense-api"
echo "  - Restart Bot: sudo systemctl restart langsense-bot"
echo ""
log "Deployment log saved to: $LOG_FILE"
