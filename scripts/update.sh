#!/bin/bash

# ========================================
# VEX Professional Update Script v3.1
# سكربت التحديث الاحترافي لـ VEX
# ========================================
# Features:
# - Zero-downtime deployment (pm2 reload)
# - Full backup before changes (files + database)
# - User confirmation with timeout (auto-rollback)
# - Atomic rollback on failure
# - .env file is NEVER modified
# ========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/var/www/vex"
BACKUP_DIR="/var/www/vex-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ARCHIVE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
DB_BACKUP="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
TEMP_RESTORE_DIR="/var/www/vex-restore-$TIMESTAMP"
OLD_COMMIT=""
NEW_COMMIT=""
CONFIRMATION_TIMEOUT=300  # 5 minutes timeout for user confirmation

# Print functions
print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }
print_step() { echo -e "${MAGENTA}→ $1${NC}"; }

# ========================================
# ATOMIC ROLLBACK FUNCTION (Fixed v3.1)
# ========================================
rollback() {
    print_header "🔄 Rolling Back / استعادة النسخة السابقة"
    
    # Step 1: Stop current (possibly broken) version
    print_step "Stopping current version..."
    pm2 stop vex 2>/dev/null || true
    
    # Step 2: Restore project files atomically
    if [ -f "$BACKUP_ARCHIVE" ]; then
        print_step "Restoring project files (atomic swap)..."
        
        # Create temp directory for restore
        mkdir -p "$TEMP_RESTORE_DIR"
        
        # Extract backup to temp directory
        tar -xzf "$BACKUP_ARCHIVE" -C "$TEMP_RESTORE_DIR" 2>/dev/null || {
            print_error "Failed to extract backup!"
            rm -rf "$TEMP_RESTORE_DIR"
            return 1
        }
        
        # Find the extracted directory (could be nested)
        EXTRACTED_DIR=$(find "$TEMP_RESTORE_DIR" -maxdepth 2 -name "package.json" -exec dirname {} \; | head -1)
        
        if [ -z "$EXTRACTED_DIR" ]; then
            EXTRACTED_DIR="$TEMP_RESTORE_DIR/vex"
            if [ ! -d "$EXTRACTED_DIR" ]; then
                EXTRACTED_DIR="$TEMP_RESTORE_DIR"
            fi
        fi
        
        # CRITICAL: Preserve current .env (never overwrite!)
        if [ -f "$PROJECT_DIR/.env" ]; then
            cp "$PROJECT_DIR/.env" "/tmp/vex_env_backup_$TIMESTAMP" 2>/dev/null || true
        fi
        
        # Remove current project EXCEPT .env and critical configs
        print_step "Preparing for restoration..."
        cd "$PROJECT_DIR"
        
        # Use rsync for atomic restore (preserves .env)
        if command -v rsync &>/dev/null; then
            rsync -a --delete \
                --exclude='.env' \
                --exclude='node_modules' \
                "$EXTRACTED_DIR/" "$PROJECT_DIR/" 2>/dev/null || {
                # Fallback to manual copy
                find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 \
                    ! -name '.env' ! -name 'node_modules' \
                    -exec rm -rf {} + 2>/dev/null || true
                cp -r "$EXTRACTED_DIR"/* "$PROJECT_DIR/" 2>/dev/null || true
            }
        else
            # Manual restoration
            find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 \
                ! -name '.env' ! -name 'node_modules' \
                -exec rm -rf {} + 2>/dev/null || true
            cp -r "$EXTRACTED_DIR"/* "$PROJECT_DIR/" 2>/dev/null || true
        fi
        
        # Restore .env from backup if it was accidentally overwritten
        if [ -f "/tmp/vex_env_backup_$TIMESTAMP" ]; then
            cp "/tmp/vex_env_backup_$TIMESTAMP" "$PROJECT_DIR/.env" 2>/dev/null || true
            rm -f "/tmp/vex_env_backup_$TIMESTAMP"
        fi
        
        # Cleanup temp directory
        rm -rf "$TEMP_RESTORE_DIR"
        
        print_success "Project files restored"
    else
        print_error "No backup archive found at $BACKUP_ARCHIVE"
        print_info "Attempting to rebuild current version..."
    fi
    
    # Step 3: Restore database (automatic, no prompts for safety)
    if [ -f "$DB_BACKUP" ]; then
        print_step "Restoring database (automatic)..."
        cd "$PROJECT_DIR"
        if [ -f .env ]; then
            export $(cat .env | grep -v '^#' | xargs)
            if [ -n "$DATABASE_URL" ]; then
                # Restore database
                gunzip -c "$DB_BACKUP" | psql "$DATABASE_URL" 2>/dev/null && \
                    print_success "Database restored" || \
                    print_warning "Database restore had warnings (check manually)"
            fi
        fi
    fi
    
    # Step 4: Rebuild (only if dist doesn't exist)
    cd "$PROJECT_DIR"
    if [ ! -f "dist/index.cjs" ]; then
        print_step "Rebuilding project..."
        npm ci --omit=dev 2>/dev/null || npm install --omit=dev 2>/dev/null || true
        npm run build 2>/dev/null || print_warning "Build had issues"
    fi
    
    # Step 5: Load environment and restart
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    print_step "Starting restored version..."
    
    # Use reload if possible for zero-downtime, start only if app doesn't exist
    if pm2 list 2>/dev/null | grep -q "vex"; then
        pm2 reload vex --update-env 2>/dev/null || \
            pm2 restart vex --update-env 2>/dev/null || \
            print_warning "Reload/restart failed - may need manual intervention"
    else
        pm2 start "node dist/index.cjs" --name "vex" --update-env 2>/dev/null || \
            pm2 start "node dist/index.cjs" --name "vex" 2>/dev/null || \
            print_warning "Start failed - may need manual intervention"
    fi
    
    pm2 save 2>/dev/null || true
    
    sleep 3
    
    if pm2 list | grep -q "online"; then
        print_success "Restored version is running!"
        echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  Rollback Complete! / اكتملت الاستعادة! ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    else
        print_error "Rollback may have issues. Check: pm2 logs vex"
    fi
}

# Error handler (triggers automatic rollback)
error_handler() {
    print_error "Error occurred at line $1"
    print_info "Initiating automatic rollback..."
    rollback
    exit 1
}

# Disable error trap during rollback
safe_rollback() {
    trap - ERR  # Disable error trap
    rollback
    exit 1
}

trap 'error_handler $LINENO' ERR

# ========================================
# PREFLIGHT CHECKS (Enhanced v3.1)
# ========================================
preflight_checks() {
    print_header "1️⃣ Preflight Checks / فحوصات قبل البدء"
    
    local ERRORS=0
    
    # Check if project exists
    print_step "Checking project directory..."
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project not found at $PROJECT_DIR"
        print_info "Run install.sh first"
        exit 1
    fi
    print_success "Project directory exists"
    
    cd "$PROJECT_DIR"
    
    # Check .env exists
    print_step "Checking .env file..."
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_info "Create .env from .env.example first"
        exit 1
    fi
    print_success ".env file exists (will NOT be modified)"
    
    # Check PM2
    print_step "Checking PM2..."
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 not installed"
        exit 1
    fi
    print_success "PM2 installed"
    
    # Check pg_dump for database backup
    print_step "Checking backup tools..."
    if command -v pg_dump &> /dev/null; then
        print_success "pg_dump available for database backup"
    else
        print_warning "pg_dump not found - database backup will be skipped"
    fi
    
    # Check rsync for atomic restore
    if command -v rsync &> /dev/null; then
        print_success "rsync available for atomic restore"
    else
        print_warning "rsync not found - will use fallback restore method"
    fi
    
    # Check if app is running
    print_step "Checking if VEX is running..."
    if pm2 list | grep -q "vex"; then
        if pm2 list | grep "vex" | grep -q "online"; then
            print_success "VEX is currently running (online)"
        else
            print_warning "VEX process exists but not online"
        fi
    else
        print_warning "VEX is not running (will start after update)"
    fi
    
    # Check git
    print_step "Checking git repository..."
    if [ -d ".git" ]; then
        REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "unknown")
        OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
        print_success "Git repository: $REMOTE_URL"
        print_info "Current commit: ${OLD_COMMIT:0:8}"
        
        # Check for uncommitted changes
        if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
            print_warning "You have local changes that will be stashed"
        fi
    else
        print_warning "Not a git repository - manual file update mode"
    fi
    
    # Check database connection
    print_step "Checking database connection..."
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
        if [ -n "$DATABASE_URL" ]; then
            if psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; then
                print_success "Database connection OK"
            else
                print_warning "Database connection failed - continuing anyway"
            fi
        fi
    fi
    
    # Check for available updates
    if [ -d ".git" ]; then
        print_step "Checking for updates..."
        git fetch origin 2>/dev/null || true
        LOCAL=$(git rev-parse HEAD 2>/dev/null)
        REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null || echo "$LOCAL")
        
        if [ "$LOCAL" = "$REMOTE" ]; then
            print_info "Already up to date!"
            read -p "Continue anyway? (y/n): " CONTINUE
            if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
                print_info "Update cancelled"
                exit 0
            fi
        else
            COMMITS_BEHIND=$(git rev-list --count HEAD..$REMOTE 2>/dev/null || echo "?")
            print_success "$COMMITS_BEHIND new commits available"
        fi
    fi
    
    # Check disk space
    print_step "Checking disk space..."
    AVAILABLE_SPACE=$(df -BM "$PROJECT_DIR" | tail -1 | awk '{print $4}' | tr -d 'M')
    if [ "$AVAILABLE_SPACE" -lt 500 ]; then
        print_warning "Low disk space: ${AVAILABLE_SPACE}MB available"
    else
        print_success "Disk space OK: ${AVAILABLE_SPACE}MB available"
    fi
    
    echo
    print_success "All preflight checks passed!"
}

# ========================================
# CREATE BACKUP (Enhanced v3.1)
# ========================================
create_backup() {
    print_header "2️⃣ Creating Full Backup / إنشاء نسخة احتياطية"
    
    mkdir -p "$BACKUP_DIR"
    cd "$PROJECT_DIR"
    
    # Backup project files (INCLUDING dist for faster rollback)
    print_step "Backing up project files (including build)..."
    tar --exclude='node_modules' \
        --exclude='.git' \
        -czf "$BACKUP_ARCHIVE" \
        -C "$(dirname $PROJECT_DIR)" \
        "$(basename $PROJECT_DIR)" 2>/dev/null || {
        print_warning "Full backup failed, trying essential files..."
        tar -czf "$BACKUP_ARCHIVE" \
            package.json package-lock.json \
            .env \
            dist \
            shared server client scripts \
            2>/dev/null || {
            print_error "Backup failed! Cannot proceed without backup."
            exit 1
        }
    }
    
    if [ -f "$BACKUP_ARCHIVE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_ARCHIVE" | cut -f1)
        print_success "Project backup: $BACKUP_ARCHIVE ($BACKUP_SIZE)"
    else
        print_error "Backup archive not created! Aborting."
        exit 1
    fi
    
    # Backup database
    print_step "Backing up database..."
    if [ -f ".env" ] && command -v pg_dump &>/dev/null; then
        export $(cat .env | grep -v '^#' | xargs)
        if [ -n "$DATABASE_URL" ]; then
            pg_dump "$DATABASE_URL" 2>/dev/null | gzip > "$DB_BACKUP" && {
                if [ -s "$DB_BACKUP" ]; then
                    DB_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
                    print_success "Database backup: $DB_BACKUP ($DB_SIZE)"
                else
                    rm -f "$DB_BACKUP"
                    print_warning "Database backup is empty - skipped"
                fi
            } || {
                rm -f "$DB_BACKUP" 2>/dev/null
                print_warning "Database backup failed - continuing"
            }
        fi
    else
        print_warning "Database backup skipped (pg_dump not available or no DATABASE_URL)"
    fi
    
    echo
    print_info "Backup location: $BACKUP_DIR"
    print_info "To manually restore: bash scripts/update.sh --rollback"
}

# ========================================
# PULL UPDATES
# ========================================
pull_updates() {
    print_header "3️⃣ Pulling Updates / سحب التحديثات"
    
    cd "$PROJECT_DIR"
    
    if [ -d ".git" ]; then
        # Stash local changes
        print_step "Stashing local changes..."
        git stash 2>/dev/null || true
        
        # Pull updates
        print_step "Pulling from remote..."
        if git pull origin main 2>/dev/null || git pull origin master 2>/dev/null; then
            NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null)
            print_success "Code updated to: ${NEW_COMMIT:0:8}"
        else
            print_error "Git pull failed!"
            git stash pop 2>/dev/null || true
            return 1
        fi
        
        # Restore stashed changes
        if git stash list | grep -q "stash@{0}"; then
            print_step "Restoring stashed changes..."
            if git stash pop 2>/dev/null; then
                print_success "Local changes restored"
            else
                print_warning "Could not restore stashed changes (may have conflicts)"
                print_info "Your changes are saved in git stash"
            fi
        fi
    else
        print_warning "Not a git repository"
        print_info "Please copy new files manually to $PROJECT_DIR"
        read -p "Press Enter after copying files..."
    fi
}

# ========================================
# BUILD PROJECT
# ========================================
build_project() {
    print_header "4️⃣ Building Project / بناء المشروع"
    
    cd "$PROJECT_DIR"
    
    # Clean npm cache
    print_step "Cleaning npm cache..."
    npm cache clean --force 2>/dev/null || true
    
    # Install production dependencies only
    print_step "Installing dependencies (production only)..."
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev 2>/dev/null || {
        print_warning "npm ci failed, trying npm install..."
        npm install || {
            print_error "Failed to install dependencies!"
            return 1
        }
    }
    print_success "Dependencies installed"
    
    # Build project
    print_step "Building project..."
    npm run build || {
        print_error "Build failed!"
        return 1
    }
    
    # Verify build output
    print_step "Verifying build..."
    if [ ! -f "dist/index.cjs" ]; then
        print_error "Build verification failed: dist/index.cjs not found"
        return 1
    fi
    print_success "Build verified: dist/index.cjs exists"
    
    # Run database migrations
    print_step "Running database migrations..."
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    npm run db:push 2>/dev/null && print_success "Migrations applied" || print_warning "Migrations skipped"
}

# ========================================
# START NEW VERSION (Zero-Downtime v3.1)
# ========================================
start_new_version() {
    print_header "5️⃣ Starting New Version / تشغيل النسخة الجديدة"
    
    cd "$PROJECT_DIR"
    
    # Load environment variables
    print_step "Loading environment variables..."
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_success "Environment loaded"
    fi
    
    # Zero-downtime: Use pm2 reload ONLY
    print_step "Reloading application (zero-downtime)..."
    
    if pm2 list 2>/dev/null | grep -q "vex"; then
        # App exists, use reload for zero-downtime (NO fallbacks that cause downtime)
        if pm2 reload vex --update-env 2>/dev/null; then
            print_success "Application reloaded (zero-downtime)"
        else
            print_error "Reload failed! Check: pm2 logs vex"
            print_info "The old version is still running - no downtime occurred."
            return 1
        fi
    else
        # App doesn't exist (first run), start it
        print_step "Starting application for first time..."
        pm2 start "node dist/index.cjs" --name "vex" --update-env || {
            print_error "Failed to start application!"
            return 1
        }
    fi
    
    # Wait for startup
    print_step "Waiting for application to start..."
    sleep 5
    
    # Check if running
    if pm2 list | grep "vex" | grep -q "online"; then
        print_success "Application is running!"
        
        # Health check
        print_step "Performing health check..."
        HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5050/api/health 2>/dev/null || echo "000")
        if [ "$HEALTH_STATUS" = "200" ]; then
            print_success "Health check passed! (HTTP 200)"
        elif [ "$HEALTH_STATUS" = "000" ]; then
            print_warning "Health check timeout (app may still be starting)"
        else
            print_warning "Health check returned HTTP $HEALTH_STATUS"
        fi
    else
        print_error "Application failed to start!"
        pm2 logs vex --lines 20 --nostream 2>/dev/null || true
        return 1
    fi
}

# ========================================
# USER CONFIRMATION (with timeout v3.1)
# ========================================
user_confirmation() {
    print_header "6️⃣ Waiting for Confirmation / في انتظار التأكيد"
    
    # Check if running in interactive mode (TTY available)
    if [ ! -t 0 ]; then
        print_warning "Non-interactive mode detected (no TTY)"
        print_info "Auto-confirming update (no rollback will occur)"
        print_info "Run manually with 'bash scripts/update.sh' for interactive mode"
        return 0
    fi
    
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                                                        ║${NC}"
    echo -e "${YELLOW}║  Please test your website now!                        ║${NC}"
    echo -e "${YELLOW}║  من فضلك اختبر موقعك الآن!                            ║${NC}"
    echo -e "${YELLOW}║                                                        ║${NC}"
    echo -e "${YELLOW}║  - Open your website in browser                       ║${NC}"
    echo -e "${YELLOW}║  - Test main features                                 ║${NC}"
    echo -e "${YELLOW}║  - Check admin panel                                  ║${NC}"
    echo -e "${YELLOW}║                                                        ║${NC}"
    echo -e "${YELLOW}║  ⏱️  Timeout: 5 minutes (auto-rollback if no response) ║${NC}"
    echo -e "${YELLOW}║                                                        ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Read with timeout
    while true; do
        echo -e "${CYAN}Type your response (5 min timeout):${NC}"
        echo -e "  ${GREEN}yes${NC} - Everything works, keep the update"
        echo -e "  ${RED}no${NC}  - Something is wrong, rollback to previous version"
        echo
        
        # Use timeout for read
        if read -t $CONFIRMATION_TIMEOUT -p "Your choice (yes/no): " CONFIRM; then
            case "$CONFIRM" in
                [Yy][Ee][Ss]|[Yy])
                    return 0
                    ;;
                [Nn][Oo]|[Nn])
                    return 1
                    ;;
                *)
                    print_warning "Please type 'yes' or 'no'"
                    ;;
            esac
        else
            # Timeout occurred
            echo
            print_error "Timeout! No response received in 5 minutes."
            print_info "Auto-rolling back for safety..."
            return 1
        fi
    done
}

# ========================================
# FINALIZE UPDATE
# ========================================
finalize_update() {
    print_header "7️⃣ Finalizing Update / إنهاء التحديث"
    
    cd "$PROJECT_DIR"
    
    # Save PM2 configuration
    print_step "Saving PM2 configuration..."
    pm2 save 2>/dev/null || true
    print_success "PM2 configuration saved"
    
    # Ensure admin user exists
    print_step "Checking admin user..."
    if [ -f "scripts/seed-admin.sh" ]; then
        bash scripts/seed-admin.sh 2>/dev/null || true
    fi
    
    # Clean old backups (keep last 5)
    print_step "Cleaning old backups..."
    cd "$BACKUP_DIR" 2>/dev/null && {
        ls -dt backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
        ls -dt db_backup_*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
        print_success "Old backups cleaned (keeping last 5)"
    }
    
    # Print summary
    echo
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}║     UPDATE SUCCESSFUL! / تم التحديث بنجاح!           ║${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo
    
    if [ -n "$OLD_COMMIT" ] && [ -n "$NEW_COMMIT" ] && [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
        echo -e "Updated: ${CYAN}${OLD_COMMIT:0:8}${NC} → ${GREEN}${NEW_COMMIT:0:8}${NC}"
    fi
    
    echo
    echo -e "Backup kept at: ${CYAN}$BACKUP_DIR${NC}"
    echo
    echo -e "Commands:"
    echo -e "  ${YELLOW}pm2 status${NC}      - Check status"
    echo -e "  ${YELLOW}pm2 logs vex${NC}    - View logs"
    echo -e "  ${YELLOW}vex-status${NC}      - Full status check"
}

# ========================================
# MANUAL ROLLBACK (for --rollback flag)
# ========================================
manual_rollback() {
    print_header "Manual Rollback / استعادة يدوية"
    
    cd "$BACKUP_DIR" 2>/dev/null || {
        print_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    }
    
    # List available backups
    echo -e "${CYAN}Available backups:${NC}"
    echo
    
    BACKUPS=($(ls -t backup_*.tar.gz 2>/dev/null))
    
    if [ ${#BACKUPS[@]} -eq 0 ]; then
        print_error "No backups found!"
        exit 1
    fi
    
    for i in "${!BACKUPS[@]}"; do
        BACKUP_FILE="${BACKUPS[$i]}"
        BACKUP_DATE=$(echo "$BACKUP_FILE" | sed 's/backup_\([0-9]*\)_\([0-9]*\).*/\1 \2/')
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "  ${YELLOW}$((i+1))${NC}. $BACKUP_FILE ($BACKUP_SIZE)"
    done
    
    echo
    read -p "Select backup number (1-${#BACKUPS[@]}): " SELECTION
    
    if [[ "$SELECTION" =~ ^[0-9]+$ ]] && [ "$SELECTION" -ge 1 ] && [ "$SELECTION" -le ${#BACKUPS[@]} ]; then
        SELECTED_BACKUP="${BACKUPS[$((SELECTION-1))]}"
        BACKUP_ARCHIVE="$BACKUP_DIR/$SELECTED_BACKUP"
        
        # Check for corresponding DB backup
        DB_TIMESTAMP=$(echo "$SELECTED_BACKUP" | sed 's/backup_//' | sed 's/.tar.gz//')
        DB_BACKUP="$BACKUP_DIR/db_backup_$DB_TIMESTAMP.sql.gz"
        
        print_info "Selected: $SELECTED_BACKUP"
        read -p "Proceed with rollback? (y/n): " CONFIRM
        
        if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
            rollback
        else
            print_info "Rollback cancelled"
        fi
    else
        print_error "Invalid selection"
        exit 1
    fi
}

# ========================================
# MAIN FUNCTION
# ========================================
main() {
    # Check for --rollback flag
    if [ "$1" = "--rollback" ] || [ "$1" = "-r" ]; then
        manual_rollback
        exit 0
    fi
    
    clear
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     VEX Professional Update Script v3.1                   ║"
    echo "║     سكربت التحديث الاحترافي لـ VEX                       ║"
    echo "║                                                           ║"
    echo "║     Features / المميزات:                                  ║"
    echo "║     ✓ Zero-downtime deployment (pm2 reload)              ║"
    echo "║     ✓ Full backup before changes                         ║"
    echo "║     ✓ User confirmation with 5-min timeout               ║"
    echo "║     ✓ Automatic rollback on failure or timeout           ║"
    echo "║     ✓ .env file is NEVER modified                        ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    
    # Step 1: Preflight checks
    preflight_checks
    
    # Ask for confirmation to proceed
    echo
    read -p "Proceed with update? (y/n): " PROCEED
    if [[ ! "$PROCEED" =~ ^[Yy]$ ]]; then
        print_info "Update cancelled"
        exit 0
    fi
    
    # Step 2: Create backup (MUST succeed)
    create_backup
    
    # Step 3: Pull updates
    pull_updates || {
        print_error "Failed to pull updates!"
        safe_rollback
    }
    
    # Step 4: Build project
    build_project || {
        print_error "Build failed!"
        safe_rollback
    }
    
    # Step 5: Start new version
    start_new_version || {
        print_error "Failed to start new version!"
        safe_rollback
    }
    
    # Step 6: User confirmation (with timeout)
    if user_confirmation; then
        # Step 7: Finalize
        finalize_update
    else
        print_warning "User requested rollback (or timeout)"
        safe_rollback
    fi
}

# Run main function
main "$@"
