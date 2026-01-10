#!/bin/bash
# 🚀 PWM Quick Start Guide

echo "=================================="
echo "PWM - Project Web Management"
echo "Quick Start Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "pwm/requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found in pwm/"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Install Python packages
echo -e "${BLUE}Step 1: Installing Python packages...${NC}"
cd pwm
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Python packages installed${NC}"
else
    echo -e "${RED}✗ Failed to install packages${NC}"
    exit 1
fi
cd ..

# Step 2: Create .env.pwm if not exists
echo -e "\n${BLUE}Step 2: Setting up environment variables...${NC}"
if [ ! -f "pwm/.env.pwm" ]; then
    echo -e "${YELLOW}⚠ .env.pwm not found, creating default...${NC}"
    cat > pwm/.env.pwm << EOF
# PWM Configuration
PWM_API_PORT=8011
PWM_ENV=development
PWM_DATABASE_URL=postgresql+asyncpg://pwm_user:pwm_password@localhost:5432/pwm_db
JWT_SECRET_KEY=your-super-secret-key-change-in-production-at-least-32-characters-long
JWT_ALGORITHM=HS256
PWM_CORS_ORIGINS=["http://localhost:3012", "http://localhost:3001"]
EOF
    echo -e "${GREEN}✓ .env.pwm created${NC}"
else
    echo -e "${GREEN}✓ .env.pwm already exists${NC}"
fi

# Step 3: Database setup
echo -e "\n${BLUE}Step 3: Database setup (requires PostgreSQL running)...${NC}"
echo "You need to:"
echo "1. Create database: createdb pwm_db"
echo "2. Create user: psql -U postgres -c \"CREATE USER pwm_user WITH PASSWORD 'pwm_password';\""
echo "3. Grant privileges: psql -U postgres -c \"ALTER USER pwm_user CREATEDB;\""
echo ""
echo -e "${YELLOW}Running migrations...${NC}"
cd pwm
alembic -c database/alembic.ini upgrade head
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database migrations completed${NC}"
else
    echo -e "${RED}✗ Failed to run migrations${NC}"
    echo "Make sure PostgreSQL is running and credentials are correct in .env.pwm"
fi
cd ..

echo -e "\n${GREEN}=================================="
echo "Setup completed! 🎉"
echo "==================================${NC}"
echo ""
echo "Next steps:"
echo -e "${BLUE}1. Start the API:${NC}"
echo "   cd pwm && python run.py"
echo ""
echo -e "${BLUE}2. API will be available at:${NC}"
echo "   http://localhost:8011"
echo "   http://localhost:8011/docs (Swagger UI)"
echo ""
echo -e "${BLUE}3. Run tests:${NC}"
echo "   pytest pwm/tests/ -v"
echo ""
echo -e "${BLUE}4. Run via Docker:${NC}"
echo "   docker compose -f docker-compose.prod.yml up pwm-api"
echo ""
