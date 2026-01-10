#!/bin/bash
# PWM Project Setup Script

set -e

echo "🚀 PWM Project Setup"
echo "===================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Python
echo -e "${BLUE}Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed!"
    exit 1
fi
echo -e "${GREEN}✓ Python found: $(python3 --version)${NC}"

# Install requirements
echo -e "\n${BLUE}Installing Python requirements...${NC}"
pip install -r requirements.txt
echo -e "${GREEN}✓ Requirements installed${NC}"

# Create .env if not exists
if [ ! -f ".env.pwm" ]; then
    echo -e "\n${BLUE}Creating .env.pwm...${NC}"
    cp .env.pwm .env.pwm
    echo -e "${GREEN}✓ .env.pwm created${NC}"
fi

# Run migrations
echo -e "\n${BLUE}Running database migrations...${NC}"
alembic -c database/alembic.ini upgrade head
echo -e "${GREEN}✓ Migrations completed${NC}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Setup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Update .env.pwm with your configuration"
echo "2. Run: python run.py"
echo ""
