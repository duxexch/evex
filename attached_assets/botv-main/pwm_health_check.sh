#!/bin/bash
# 🔍 PWM Health Check Script

echo "=================================="
echo "PWM Health Check"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_file() {
    local file=$1
    local name=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $name exists"
        return 0
    else
        echo -e "${RED}✗${NC} $name NOT found: $file"
        return 1
    fi
}

check_dir() {
    local dir=$1
    local name=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $name directory exists"
        return 0
    else
        echo -e "${RED}✗${NC} $name directory NOT found: $dir"
        return 1
    fi
}

check_command() {
    local cmd=$1
    local name=$2
    
    if command -v $cmd &> /dev/null; then
        echo -e "${GREEN}✓${NC} $name is installed"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $name NOT installed"
        return 1
    fi
}

# Check environment
echo -e "${YELLOW}=== Environment ===${NC}"
check_command python "Python"
check_command python3 "Python3"
check_command pip "pip"

# Check files
echo -e "\n${YELLOW}=== Core Files ===${NC}"
check_file "pwm/requirements.txt" "requirements.txt"
check_file "pwm/.env.pwm" ".env.pwm"
check_file "pwm/Dockerfile.pwm" "Dockerfile.pwm"
check_file "pwm/backend/main.py" "main.py"
check_file "pwm/database/alembic.ini" "alembic.ini"

# Check directories
echo -e "\n${YELLOW}=== Directories ===${NC}"
check_dir "pwm/backend/models" "models"
check_dir "pwm/backend/routers" "routers"
check_dir "pwm/backend/schemas" "schemas"
check_dir "pwm/backend/services" "services"
check_dir "pwm/backend/core" "core"
check_dir "pwm/database/versions" "database/versions"
check_dir "pwm/tests" "tests"
check_dir "pwm/frontend" "frontend"

# Check Python packages
echo -e "\n${YELLOW}=== Python Environment ===${NC}"
cd pwm

# Check if venv exists
if [ -d "venv" ]; then
    echo -e "${GREEN}✓${NC} Virtual environment exists"
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
    check_command python "Python in venv"
else
    echo -e "${YELLOW}⚠${NC} Virtual environment NOT found"
fi

# Try to import key packages
python -c "import fastapi" 2>/dev/null && echo -e "${GREEN}✓${NC} FastAPI is installed" || echo -e "${RED}✗${NC} FastAPI NOT installed"
python -c "import sqlalchemy" 2>/dev/null && echo -e "${GREEN}✓${NC} SQLAlchemy is installed" || echo -e "${RED}✗${NC} SQLAlchemy NOT installed"
python -c "import alembic" 2>/dev/null && echo -e "${GREEN}✓${NC} Alembic is installed" || echo -e "${RED}✗${NC} Alembic NOT installed"

cd ..

# Check Docker
echo -e "\n${YELLOW}=== Docker ===${NC}"
check_command docker "Docker"
check_command docker-compose "Docker Compose"

if command -v docker &> /dev/null; then
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker daemon is running"
    else
        echo -e "${RED}✗${NC} Docker daemon is NOT running"
    fi
fi

# Summary
echo -e "\n${GREEN}=================================="
echo "Health Check Complete"
echo "==================================${NC}"
echo ""
echo "Next steps:"
echo "1. If Python packages are missing, run: pip install -r pwm/requirements.txt"
echo "2. If Docker is not running, start it with: docker daemon"
echo "3. To start the API: cd pwm && python run.py"
echo "4. To run tests: pytest pwm/tests/ -v"
