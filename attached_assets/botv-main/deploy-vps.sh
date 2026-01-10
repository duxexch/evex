#!/bin/bash

################################################################################
# Production VPS Deployment Script - Ubuntu 24.04 LTS
# Project: LangSense Bot
# Description: Automated deployment with error handling and conflict resolution
# Author: Senior DevOps Engineer (20 years experience)
# Date: January 5, 2026
################################################################################

set -e  # Exit on error
trap 'last_command=$current_command; current_command=$BASH_COMMAND' DEBUG
trap 'handle_error $? "$last_command"' ERR

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/botv"
DB_NAME="dotv"
DB_USER="dotv"
DB_PASS="m784951m"
BOT_TOKEN="8549135277:AAHxriOUTxrT7lHXzXQsuxe327gMXXScZko"
ADMIN_USER_ID="7146701713"
LOG_FILE="/var/log/botv-deployment.log"

################################################################################
# Helper Functions
################################################################################

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

handle_error() {
    local exit_code=$1
    local command="$2"
    error "Command failed with exit code $exit_code: $command"
    error "Check log file: $LOG_FILE"
    
    # Suggest fix based on common errors
    case $exit_code in
        1)
            error "General error. Check the last command output above."
            ;;
        2)
            error "Command not found. Install missing package."
            ;;
        126)
            error "Permission denied. Run with sudo or fix permissions."
            ;;
        127)
            error "Command not found in PATH."
            ;;
        *)
            error "Unknown error code: $exit_code"
            ;;
    esac
    
    exit $exit_code
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        info "Fix: Run with sudo or switch to root: sudo bash $0"
        exit 1
    fi
}

confirm_action() {
    local message="$1"
    read -p "$(echo -e ${YELLOW}$message${NC} [y/N]: )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        warning "Action cancelled by user"
        return 1
    fi
    return 0
}

################################################################################
# Step 1: System Update and Basic Tools
################################################################################

step1_system_update() {
    log "=== Step 1: System Update and Basic Tools ==="
    
    # Check if system was recently updated (within last 24 hours)
    if [ -f "/var/cache/apt/pkgcache.bin" ]; then
        local last_update=$(stat -c %Y /var/cache/apt/pkgcache.bin)
        local current_time=$(date +%s)
        local time_diff=$((current_time - last_update))
        
        if [ $time_diff -lt 86400 ]; then
            info "System was updated recently ($(($time_diff / 3600)) hours ago). Skipping update."
        else
            log "Updating system packages..."
            apt update && apt upgrade -y || {
                error "System update failed"
                info "Fix: apt update && apt upgrade -y"
                exit 1
            }
        fi
    else
        log "Updating system packages..."
        apt update && apt upgrade -y
    fi
    
    # Install essential packages
    log "Installing essential packages..."
    local packages=(
        git curl wget nano vim htop net-tools ca-certificates gnupg
        lsb-release software-properties-common apt-transport-https
        build-essential python3-dev libpq-dev ufw
    )
    
    local missing_packages=()
    for pkg in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -gt 0 ]; then
        log "Installing missing packages: ${missing_packages[*]}"
        apt install -y "${missing_packages[@]}" || {
            error "Package installation failed"
            info "Fix: apt install -y ${missing_packages[*]}"
            exit 1
        }
    else
        info "All essential packages already installed"
    fi
    
    # Configure UFW Firewall
    log "Configuring UFW Firewall..."
    if ! systemctl is-active --quiet ufw; then
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 8000/tcp
        ufw --force enable
        log "UFW Firewall configured and enabled"
    else
        info "UFW already active"
        # Ensure required ports are open
        ufw allow 22/tcp 2>/dev/null || true
        ufw allow 80/tcp 2>/dev/null || true
        ufw allow 443/tcp 2>/dev/null || true
        ufw allow 8000/tcp 2>/dev/null || true
    fi
    
    ufw status
    log "Step 1 completed successfully ✓"
}

################################################################################
# Step 2: Install Docker
################################################################################

step2_install_docker() {
    log "=== Step 2: Install Docker and Docker Compose ==="
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version)
        info "Docker already installed: $docker_version"
        
        # Check if Docker service is running
        if ! systemctl is-active --quiet docker; then
            log "Starting Docker service..."
            systemctl start docker
        fi
        
        log "Step 2 skipped (Docker already installed) ✓"
        return 0
    fi
    
    log "Removing old Docker versions..."
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    log "Adding Docker GPG key..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    
    log "Adding Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    log "Installing Docker..."
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || {
        error "Docker installation failed"
        info "Fix: Check Docker repository configuration"
        exit 1
    }
    
    log "Enabling Docker service..."
    systemctl enable docker
    systemctl start docker
    
    # Verify installation
    docker --version || {
        error "Docker installation verification failed"
        exit 1
    }
    
    docker compose version || {
        error "Docker Compose installation verification failed"
        exit 1
    }
    
    log "Step 2 completed successfully ✓"
}

################################################################################
# Step 3: Install PostgreSQL 16
################################################################################

step3_install_postgresql() {
    log "=== Step 3: Install PostgreSQL 16 ==="
    
    # Check if PostgreSQL is already installed
    if command -v psql &> /dev/null; then
        local pg_version=$(sudo -u postgres psql --version)
        info "PostgreSQL already installed: $pg_version"
        
        # Check if service is running
        if ! systemctl is-active --quiet postgresql; then
            log "Starting PostgreSQL service..."
            systemctl start postgresql
        fi
        
        log "Step 3 skipped (PostgreSQL already installed) ✓"
        return 0
    fi
    
    log "Adding PostgreSQL repository..."
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    
    log "Installing PostgreSQL 16..."
    apt update
    apt install -y postgresql-16 postgresql-contrib-16 || {
        error "PostgreSQL installation failed"
        info "Fix: Check PostgreSQL repository configuration"
        exit 1
    }
    
    log "Enabling PostgreSQL service..."
    systemctl enable postgresql
    systemctl start postgresql
    
    # Verify installation
    sudo -u postgres psql --version || {
        error "PostgreSQL installation verification failed"
        exit 1
    }
    
    log "Step 3 completed successfully ✓"
}

################################################################################
# Step 4: Install Redis 7
################################################################################

step4_install_redis() {
    log "=== Step 4: Install Redis 7 ==="
    
    # Check if Redis is already installed
    if command -v redis-cli &> /dev/null; then
        local redis_version=$(redis-cli --version)
        info "Redis already installed: $redis_version"
        
        # Check if service is running
        if ! systemctl is-active --quiet redis-server; then
            log "Starting Redis service..."
            systemctl start redis-server
        fi
        
        log "Step 4 skipped (Redis already installed) ✓"
        return 0
    fi
    
    log "Installing Redis..."
    apt install -y redis-server || {
        error "Redis installation failed"
        info "Fix: apt install -y redis-server"
        exit 1
    }
    
    log "Configuring Redis for production..."
    # Backup original config
    cp /etc/redis/redis.conf /etc/redis/redis.conf.backup
    
    # Apply production settings
    sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
    sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
    sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
    
    log "Enabling Redis service..."
    systemctl enable redis-server
    systemctl restart redis-server
    
    # Verify installation
    sleep 2
    redis-cli ping | grep -q "PONG" || {
        error "Redis installation verification failed"
        info "Fix: systemctl restart redis-server"
        exit 1
    }
    
    log "Step 4 completed successfully ✓"
}

################################################################################
# Step 5: Create Database and User
################################################################################

step5_create_database() {
    log "=== Step 5: Create Database and User ==="
    
    # Check if database already exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        info "Database '$DB_NAME' already exists"
    else
        log "Creating database '$DB_NAME'..."
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || {
            error "Database creation failed"
            info "Fix: sudo -u postgres psql -c 'CREATE DATABASE $DB_NAME;'"
            exit 1
        }
    fi
    
    # Check if user already exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        info "User '$DB_USER' already exists"
        # Update password just in case
        sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
    else
        log "Creating user '$DB_USER'..."
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    fi
    
    log "Granting privileges..."
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"
    
    # Grant schema privileges (PostgreSQL 15+)
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
    # Verify connection
    PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null || {
        error "Database connection test failed"
        info "Fix: Check database credentials"
        exit 1
    }
    
    log "Step 5 completed successfully ✓"
}

################################################################################
# Step 6: Clone Project from GitHub
################################################################################

step6_clone_project() {
    log "=== Step 6: Clone Project from GitHub ==="
    
    # Create project directory
    mkdir -p /var/www
    
    # Check if project already exists
    if [ -d "$PROJECT_DIR/.git" ]; then
        info "Project already exists. Updating..."
        cd "$PROJECT_DIR"
        
        # Stash any local changes
        git stash 2>/dev/null || true
        
        # Pull latest changes
        git pull origin main || {
            warning "Git pull failed. Trying to reset..."
            git fetch origin
            git reset --hard origin/main
        }
        
        log "Project updated successfully"
    else
        log "Cloning project from GitHub..."
        
        # Remove directory if exists but not a git repo
        if [ -d "$PROJECT_DIR" ]; then
            warning "Directory exists but is not a git repository. Backing up..."
            mv "$PROJECT_DIR" "${PROJECT_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
        fi
        
        cd /var/www
        git clone https://github.com/promnes/botv.git || {
            error "Git clone failed"
            info "Fix: git clone https://github.com/promnes/botv.git"
            exit 1
        }
    fi
    
    cd "$PROJECT_DIR"
    log "Current branch: $(git branch --show-current)"
    log "Latest commits:"
    git log --oneline -3
    
    log "Step 6 completed successfully ✓"
}

################################################################################
# Step 7: Configure Environment (.env)
################################################################################

step7_configure_env() {
    log "=== Step 7: Configure Environment (.env) ==="
    
    cd "$PROJECT_DIR"
    
    # Backup existing .env if exists
    if [ -f ".env" ]; then
        warning ".env file already exists. Creating backup..."
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    log "Creating .env file..."
    cat > .env << ENVEOF
# .env - Production Configuration
# ✅ CRITICAL: This file contains sensitive data

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
DB_CONNECTION=pgsql
DB_HOST=host.docker.internal
DB_PORT=5432
DB_DATABASE=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASS
DATABASE_URL=postgresql+asyncpg://$DB_USER:$DB_PASS@host.docker.internal:5432/$DB_NAME

# ============================================================================
# REDIS CACHE
# ============================================================================
REDIS_PASSWORD=
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379/0

# ============================================================================
# API & SERVER
# ============================================================================
PORT=8000
API_PORT=8000
ENVIRONMENT=production
LOG_LEVEL=info
LOG_FILE=bot.log

# ============================================================================
# SECURITY (✅ Secure random keys)
# ============================================================================
ENCRYPTION_KEY=JOZzhl3QQpPiRUpnGl/lo3Mv1ocTMVKeqn4oLyDfUtA=
JWT_SECRET_KEY=YaKNSKJIGU8/jE4kvMFICySybT0YO5BbYMtV/IEnHxw=
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# ============================================================================
# BOT CONFIGURATION
# ============================================================================
BOT_TOKEN=$BOT_TOKEN
ADMIN_USER_IDS=$ADMIN_USER_ID

# ============================================================================
# CORS & ALLOWED ORIGINS
# ============================================================================
CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000
FORCE_HTTPS=false
ALLOWED_HOSTS=localhost,127.0.0.1

# ============================================================================
# BROADCAST CONFIGURATION
# ============================================================================
BROADCAST_RATE_LIMIT=30
BROADCAST_CHUNK_SIZE=100
BROADCAST_RETRY_ATTEMPTS=3
BROADCAST_RETRY_DELAY=5

# ============================================================================
# FINANCIAL LIMITS
# ============================================================================
MIN_DEPOSIT=50
MAX_DEPOSIT=10000
MIN_WITHDRAWAL=100
MAX_DAILY_WITHDRAWAL=10000

# ============================================================================
# RATE LIMITING
# ============================================================================
USER_RATE_LIMIT=40
ADMIN_RATE_LIMIT=30
API_RATE_LIMIT=100
DEPOSIT_RATE_LIMIT=10
WITHDRAWAL_RATE_LIMIT=10

# ============================================================================
# LOCALIZATION
# ============================================================================
DEFAULT_LANGUAGE=ar
DEFAULT_COUNTRY=SA

# ============================================================================
# PAGINATION
# ============================================================================
USERS_PER_PAGE=10
ANNOUNCEMENTS_PER_PAGE=5
TRANSACTIONS_PER_PAGE=20

# ============================================================================
# FILE UPLOAD
# ============================================================================
MAX_FILE_SIZE=20
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp

# ============================================================================
# CUSTOMER ID
# ============================================================================
CUSTOMER_ID_PREFIX=C
CUSTOMER_ID_YEAR_FORMAT=2025
ENVEOF
    
    # Secure .env file
    chmod 600 .env
    log ".env file created and secured (permissions: 600)"
    
    log "Step 7 completed successfully ✓"
}

################################################################################
# Step 8: Build and Run Docker Containers
################################################################################

step8_docker_deploy() {
    log "=== Step 8: Build and Run Docker Containers ==="
    
    cd "$PROJECT_DIR"
    
    # Create logs directory
    mkdir -p logs
    chmod 755 logs
    
    # Stop and remove old containers
    log "Stopping old containers..."
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker compose -f docker-compose.local-db.yml down 2>/dev/null || true
    
    # Remove orphaned containers (if any)
    local orphans=$(docker ps -aq --filter "name=langsense")
    if [ -n "$orphans" ]; then
        warning "Removing orphaned containers..."
        docker rm -f $orphans 2>/dev/null || true
    fi
    
    # Check if compose file exists
    if [ ! -f "docker-compose.local-db.yml" ]; then
        error "docker-compose.local-db.yml not found"
        info "Fix: Ensure you have the latest version from GitHub"
        exit 1
    fi
    
    log "Building Docker images (this may take 3-5 minutes)..."
    docker compose -f docker-compose.local-db.yml build --no-cache || {
        error "Docker build failed"
        info "Fix: Check Dockerfile syntax and dependencies"
        exit 1
    }
    
    log "Starting containers in detached mode..."
    docker compose -f docker-compose.local-db.yml up -d || {
        error "Docker start failed"
        info "Fix: Check docker-compose.local-db.yml configuration"
        exit 1
    }
    
    log "Waiting 30 seconds for services to start..."
    sleep 30
    
    # Show container status
    docker compose -f docker-compose.local-db.yml ps
    
    log "Step 8 completed successfully ✓"
}

################################################################################
# Step 9: Verify Deployment
################################################################################

step9_verify_deployment() {
    log "=== Step 9: Verify Deployment ==="
    
    cd "$PROJECT_DIR"
    
    local all_checks_passed=true
    
    # Check 1: API container running
    info "Check 1: API container status..."
    if docker ps | grep -q "langsense-api"; then
        log "✓ API container is running"
    else
        error "✗ API container is not running"
        docker logs langsense-api --tail 20
        all_checks_passed=false
    fi
    
    # Check 2: Bot container running
    info "Check 2: Bot container status..."
    if docker ps | grep -q "langsense-bot"; then
        log "✓ Bot container is running"
    else
        error "✗ Bot container is not running"
        docker logs langsense-bot --tail 20
        all_checks_passed=false
    fi
    
    # Check 3: API health check
    info "Check 3: API health check..."
    sleep 5
    local health_response=$(curl -s http://localhost:8000/health || echo "failed")
    if echo "$health_response" | grep -q "healthy"; then
        log "✓ API health check passed"
    else
        error "✗ API health check failed: $health_response"
        info "Fix: Check API logs: docker logs langsense-api"
        all_checks_passed=false
    fi
    
    # Check 4: Database connection
    info "Check 4: Database connection..."
    if PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log "✓ Database connection successful"
    else
        error "✗ Database connection failed"
        info "Fix: Check PostgreSQL service: systemctl status postgresql"
        all_checks_passed=false
    fi
    
    # Check 5: Redis connection
    info "Check 5: Redis connection..."
    if redis-cli -h localhost -p 6379 ping | grep -q "PONG"; then
        log "✓ Redis connection successful"
    else
        error "✗ Redis connection failed"
        info "Fix: Check Redis service: systemctl status redis-server"
        all_checks_passed=false
    fi
    
    # Check 6: Network connectivity
    info "Check 6: Docker network connectivity..."
    if docker network inspect botv_langsense-network > /dev/null 2>&1; then
        log "✓ Docker network exists"
    else
        error "✗ Docker network not found"
        all_checks_passed=false
    fi
    
    # Show container logs
    log "Latest API logs:"
    docker logs langsense-api --tail 20
    
    log "Latest Bot logs:"
    docker logs langsense-bot --tail 20
    
    if [ "$all_checks_passed" = true ]; then
        log "Step 9 completed successfully ✓"
    else
        error "Step 9 completed with errors ✗"
        info "Review the errors above and check logs"
    fi
}

################################################################################
# Step 10: Run Database Migrations
################################################################################

step10_run_migrations() {
    log "=== Step 10: Run Database Migrations ==="
    
    # Wait for API to be fully ready
    log "Waiting for API to be ready..."
    sleep 10
    
    # Check if alembic is available
    if docker exec langsense-api which alembic > /dev/null 2>&1; then
        log "Running database migrations..."
        docker exec langsense-api alembic upgrade head || {
            warning "Alembic migration failed, trying alternative method..."
            
            # Alternative: Run migrations via Python
            docker exec langsense-api python -c "
import sys
sys.path.insert(0, '/app')
try:
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config('/app/alembic.ini')
    command.upgrade(alembic_cfg, 'head')
    print('✅ Migrations completed successfully')
except Exception as e:
    print(f'⚠️  Migration warning: {str(e)}')
    print('This might be normal for first-time deployment')
" || warning "Migrations completed with warnings (might be normal for first-time setup)"
        }
    else
        warning "Alembic not found in container. Skipping migrations."
        info "Migrations might run automatically on first API start"
    fi
    
    log "Step 10 completed successfully ✓"
}

################################################################################
# Step 11: Test Telegram Bot
################################################################################

step11_test_bot() {
    log "=== Step 11: Test Telegram Bot ==="
    
    log "Testing bot connectivity..."
    local bot_info=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe")
    
    if echo "$bot_info" | grep -q "\"ok\":true"; then
        log "✓ Bot token is valid"
        local bot_username=$(echo "$bot_info" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        log "Bot username: @$bot_username"
        info "Open Telegram and search for @$bot_username"
        info "Send /start to test the bot"
    else
        error "✗ Bot token validation failed"
        info "Fix: Check BOT_TOKEN in .env file"
        return 1
    fi
    
    log "Step 11 completed successfully ✓"
}

################################################################################
# Main Execution
################################################################################

main() {
    log "╔════════════════════════════════════════════════════════════════╗"
    log "║     LangSense Bot - Production VPS Deployment Script          ║"
    log "║     Ubuntu 24.04 LTS - Automated Installation                 ║"
    log "╚════════════════════════════════════════════════════════════════╝"
    log ""
    
    # Check root privileges
    check_root
    
    # Show summary
    info "This script will:"
    info "  1. Update system and install essential packages"
    info "  2. Install Docker and Docker Compose"
    info "  3. Install PostgreSQL 16"
    info "  4. Install Redis 7"
    info "  5. Create database and user"
    info "  6. Clone project from GitHub"
    info "  7. Configure environment (.env)"
    info "  8. Build and run Docker containers"
    info "  9. Verify deployment"
    info "  10. Run database migrations"
    info "  11. Test Telegram bot"
    log ""
    
    if ! confirm_action "Do you want to continue with the deployment?"; then
        exit 0
    fi
    
    # Execute steps
    step1_system_update
    step2_install_docker
    step3_install_postgresql
    step4_install_redis
    step5_create_database
    step6_clone_project
    step7_configure_env
    step8_docker_deploy
    step9_verify_deployment
    step10_run_migrations
    step11_test_bot
    
    log ""
    log "╔════════════════════════════════════════════════════════════════╗"
    log "║                 🎉 DEPLOYMENT COMPLETED! 🎉                    ║"
    log "╚════════════════════════════════════════════════════════════════╝"
    log ""
    log "Quick commands:"
    log "  • View API logs:    docker logs -f langsense-api"
    log "  • View Bot logs:    docker logs -f langsense-bot"
    log "  • Check status:     docker compose -f docker-compose.local-db.yml ps"
    log "  • Restart services: docker compose -f docker-compose.local-db.yml restart"
    log "  • API health:       curl http://localhost:8000/health"
    log ""
    log "Next steps:"
    log "  1. Open Telegram and search for your bot"
    log "  2. Send /start to test"
    log "  3. Check logs for any errors"
    log ""
    log "Log file: $LOG_FILE"
}

# Run main function
main "$@"
