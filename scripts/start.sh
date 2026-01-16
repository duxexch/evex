#!/bin/bash

# ========================================
# VEX Platform - Production Startup Script v2.0
# سكربت تشغيل منصة VEX للإنتاج
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

error_exit() {
    print_error "$1"
    print_info "Run ./scripts/troubleshoot.sh for diagnostics"
    exit 1
}

print_header "VEX Platform - Production Startup"
print_header "منصة VEX - بدء التشغيل للإنتاج"

# Determine project directory
if [ -f "./package.json" ]; then
    PROJECT_DIR="."
elif [ -f "/var/www/vex/package.json" ]; then
    PROJECT_DIR="/var/www/vex"
else
    error_exit "Could not find VEX project directory"
fi

cd "$PROJECT_DIR"
print_success "Working directory: $(pwd)"

# Check .env file
print_info "Checking environment configuration..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        print_warning ".env not found, copying from .env.example"
        cp .env.example .env
        print_error "Please configure .env file with your settings!"
        exit 1
    else
        error_exit ".env file not found! Create it with DATABASE_URL, SESSION_SECRET, JWT_SECRET"
    fi
fi

# Load and validate environment variables
print_info "Loading environment variables..."
set -a
source .env
set +a

# Validate required variables
MISSING_VARS=""
[ -z "$DATABASE_URL" ] && MISSING_VARS="$MISSING_VARS DATABASE_URL"
[ -z "$SESSION_SECRET" ] && MISSING_VARS="$MISSING_VARS SESSION_SECRET"

if [ ! -z "$MISSING_VARS" ]; then
    error_exit "Missing required environment variables:$MISSING_VARS"
fi
print_success "Environment variables loaded"

# Check Node.js
print_info "Checking Node.js..."
if ! command -v node &> /dev/null; then
    error_exit "Node.js is not installed"
fi
print_success "Node.js $(node -v)"

# Check if node_modules exists
print_info "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found, installing..."
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev || npm install || error_exit "Failed to install dependencies"
fi
print_success "Dependencies ready"

# Check if dist exists
print_info "Checking build..."
if [ ! -d "dist" ] || [ ! -f "dist/server/index.js" ]; then
    print_warning "Build not found, building project..."
    npm run build || error_exit "Build failed"
fi
print_success "Build ready"

# Test database connection
print_info "Testing database connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
        print_success "Database connection successful"
    else
        print_warning "Database connection test failed - continuing anyway"
    fi
else
    print_warning "psql not found - skipping database test"
fi

# Run database migrations
print_info "Running database migrations..."
npm run db:push 2>/dev/null && print_success "Migrations applied" || print_warning "Migration command not found or failed"

# Set production environment
export NODE_ENV=production

# Start server
print_header "Starting Server / تشغيل الخادم"

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  VEX is starting on port ${PORT:-5050}           ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo

# Start the server
exec node dist/server/index.js
