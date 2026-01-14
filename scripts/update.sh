#!/bin/bash

# ========================================
# VEX Update Script
# سكربت تحديث VEX
# ========================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/var/www/vex"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VEX Update Script / سكربت تحديث VEX${NC}"
echo -e "${BLUE}========================================${NC}"
echo

cd $PROJECT_DIR

# Pull latest changes
echo -e "${YELLOW}Pulling latest changes...${NC}"
git pull origin main

# Install new dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Build project
echo -e "${YELLOW}Building project...${NC}"
npm run build

# Run migrations
echo -e "${YELLOW}Running database migrations...${NC}"
npm run db:push

# Restart application
echo -e "${YELLOW}Restarting application...${NC}"
pm2 restart vex

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Update complete! / اكتمل التحديث!${NC}"
echo -e "${GREEN}========================================${NC}"
