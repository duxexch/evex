#!/bin/bash

# ========================================
# VEX Admin User Seed Script
# سكربت إنشاء مستخدم Admin
# ========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }

# Get admin credentials from environment or use defaults
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@vex.local}"

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    # Try to load from .env
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL is not set"
    print_info "Set DATABASE_URL environment variable or create .env file"
    exit 1
fi

print_info "Checking for existing admin user..."

# Check if admin exists
ADMIN_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE username = '$ADMIN_USERNAME';" 2>/dev/null | tr -d ' ')

if [ "$ADMIN_EXISTS" != "0" ] && [ -n "$ADMIN_EXISTS" ]; then
    print_success "Admin user '$ADMIN_USERNAME' already exists"
    print_info "Skipping admin creation"
    exit 0
fi

print_info "Creating admin user..."

# Generate bcrypt hash using node (bcryptjs is a production dependency)
HASHED_PASSWORD=$(node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('$ADMIN_PASSWORD', 10);
console.log(hash);
" 2>/dev/null)

if [ -z "$HASHED_PASSWORD" ]; then
    print_error "Failed to hash password (bcryptjs not available?)"
    exit 1
fi

# Create admin user with SQL
psql "$DATABASE_URL" -c "
INSERT INTO users (
    id,
    username,
    password,
    email,
    role,
    status,
    balance,
    vip_level,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '$ADMIN_USERNAME',
    '$HASHED_PASSWORD',
    '$ADMIN_EMAIL',
    'admin',
    'active',
    0.00,
    10,
    NOW(),
    NOW()
) ON CONFLICT (username) DO NOTHING;
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Admin user created successfully!   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "   Username: $ADMIN_USERNAME"
    echo "   Password: $ADMIN_PASSWORD"
    echo "   Email: $ADMIN_EMAIL"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Change the password immediately after first login!${NC}"
    echo -e "${YELLOW}⚠️  مهم: غيّر كلمة المرور فوراً بعد الدخول الأول!${NC}"
    echo ""
else
    print_warning "Admin user creation may have failed or user already exists"
fi
