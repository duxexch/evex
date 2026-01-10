#!/bin/bash
# LangSense PWM - Quick Start Script
# Web-based Platform Management (NO Telegram Bot)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     LangSense PWM - Platform Web Management          ║${NC}"
echo -e "${GREEN}║     Web Dashboard Only - NO Telegram Bot             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 1. Check Prerequisites
# ============================================================================
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python $(python3 --version)${NC}"

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not installed. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
fi
echo -e "${GREEN}✅ PostgreSQL installed${NC}"

if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠️  Redis not installed. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y redis-server
fi
echo -e "${GREEN}✅ Redis installed${NC}"

# ============================================================================
# 2. Setup Database
# ============================================================================
echo ""
echo -e "${YELLOW}[2/7] Setting up PostgreSQL...${NC}"

sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='langsense'" | grep -q 1 || \
sudo -u postgres psql << EOF
CREATE DATABASE langsense;
CREATE USER langsense WITH PASSWORD 'langsense_secure_pw_2026';
GRANT ALL PRIVILEGES ON DATABASE langsense TO langsense;
ALTER DATABASE langsense OWNER TO langsense;
EOF

echo -e "${GREEN}✅ PostgreSQL database ready${NC}"

# ============================================================================
# 3. Setup Redis
# ============================================================================
echo ""
echo -e "${YELLOW}[3/7] Setting up Redis...${NC}"

sudo systemctl start redis-server
sudo systemctl enable redis-server

echo -e "${GREEN}✅ Redis ready${NC}"

# ============================================================================
# 4. Create Virtual Environment
# ============================================================================
echo ""
echo -e "${YELLOW}[4/7] Creating Python virtual environment...${NC}"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
fi

source venv/bin/activate

# ============================================================================
# 5. Install Dependencies (NO Telegram/aiogram)
# ============================================================================
echo ""
echo -e "${YELLOW}[5/7] Installing Python packages (NO Telegram dependencies)...${NC}"

pip install --upgrade pip setuptools wheel -q
pip install -r requirements.txt -q

echo -e "${GREEN}✅ Python packages installed (aiogram removed)${NC}"

# ============================================================================
# 6. Setup .env File
# ============================================================================
echo ""
echo -e "${YELLOW}[6/7] Setting up .env configuration...${NC}"

if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# LangSense PWM - Web Admin Configuration
ADMIN_EMAIL=admin@langsense.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_strong_password
ADMIN_USER_IDS=1

# Database (localhost)
DB_USER=langsense
DB_PASSWORD=langsense_secure_pw_2026
DB_NAME=langsense
DB_HOST=localhost
DB_PORT=5432
DATABASE_URL=postgresql+asyncpg://langsense:langsense_secure_pw_2026@localhost:5432/langsense

# Redis (localhost)
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379/0

# Security Keys
JWT_SECRET_KEY=change_this_to_random_32_chars
ENCRYPTION_KEY=change_this_to_random_32_chars

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:8000
EOF
    
    echo -e "${GREEN}✅ .env file created${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env and set strong passwords!${NC}"
    echo -e "${YELLOW}   Run: nano .env${NC}"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# ============================================================================
# 7. Run Migrations
# ============================================================================
echo ""
echo -e "${YELLOW}[7/7] Running database migrations...${NC}"

alembic upgrade heads

echo -e "${GREEN}✅ Database migrations completed${NC}"

# ============================================================================
# Complete
# ============================================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ Setup Complete!                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}To start PWM API:${NC}"
echo "  source venv/bin/activate"
echo "  uvicorn api.main:app --host 0.0.0.0 --port 8000"
echo ""
echo -e "${YELLOW}Or run in background:${NC}"
echo "  nohup uvicorn api.main:app --host 0.0.0.0 --port 8000 > api.log 2>&1 &"
echo ""
echo -e "${YELLOW}Access Points:${NC}"
echo "  🌐 API Docs: http://localhost:8000/docs"
echo "  ❤️  Health: http://localhost:8000/health"
echo "  🔐 Admin: http://localhost:8000/admin"
echo ""
echo -e "${RED}⚠️  IMPORTANT:${NC}"
echo "  Edit .env and set ADMIN_PASSWORD before starting!"
echo "  nano .env"
echo ""
