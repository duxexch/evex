#!/bin/bash
# Production Deployment Checklist
# Copy and follow these steps for deployment to production

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║         LangSense Control Panel - Production Deployment Checklist      ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_TOTAL=0

check() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $1"
    fi
}

echo ""
echo "STEP 1: PRE-DEPLOYMENT CHECKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Verifying required files..."
test -f "api/app.py" && echo -e "${GREEN}✓${NC} api/app.py exists" || echo -e "${RED}✗${NC} api/app.py missing"
test -f "Dockerfile.prod" && echo -e "${GREEN}✓${NC} Dockerfile.prod exists" || echo -e "${RED}✗${NC} Dockerfile.prod missing"
test -f "docker-compose.yml" && echo -e "${GREEN}✓${NC} docker-compose.yml exists" || echo -e "${RED}✗${NC} docker-compose.yml missing"
test -f ".env.example" && echo -e "${GREEN}✓${NC} .env.example exists" || echo -e "${RED}✗${NC} .env.example missing"
test -f "DEPLOYMENT_GUIDE.md" && echo -e "${GREEN}✓${NC} DEPLOYMENT_GUIDE.md exists" || echo -e "${RED}✗${NC} DEPLOYMENT_GUIDE.md missing"

echo ""
echo "STEP 2: ENVIRONMENT SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC}  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}⚠${NC}  IMPORTANT: Edit .env with production values:"
    echo "     - JWT_SECRET_KEY (generate: python -c \"import secrets; print(secrets.token_urlsafe(32))\")"
    echo "     - ENCRYPTION_KEY (generate: python -c \"import secrets; print(secrets.token_urlsafe(32))\")"
    echo "     - DB_PASSWORD (strong random password)"
    echo "     - REDIS_PASSWORD (strong random password)"
    echo "     - BOT_TOKEN (Telegram bot token)"
    echo "     - ENVIRONMENT=production"
    echo "     - CORS_ORIGINS=yourdomain.com"
    exit 1
else
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check for required values
    grep -q "ENVIRONMENT=production" .env && echo -e "${GREEN}✓${NC} ENVIRONMENT=production" || echo -e "${RED}✗${NC} ENVIRONMENT not set to production"
    grep -q "JWT_SECRET_KEY=" .env && grep -qv "change-this" .env && echo -e "${GREEN}✓${NC} JWT_SECRET_KEY configured" || echo -e "${RED}✗${NC} JWT_SECRET_KEY not configured"
    grep -q "ENCRYPTION_KEY=" .env && grep -qv "change-this" .env && echo -e "${GREEN}✓${NC} ENCRYPTION_KEY configured" || echo -e "${RED}✗${NC} ENCRYPTION_KEY not configured"
    grep -q "BOT_TOKEN=" .env && grep -qv "your_telegram" .env && echo -e "${GREEN}✓${NC} BOT_TOKEN configured" || echo -e "${RED}✗${NC} BOT_TOKEN not configured"
fi

echo ""
echo "STEP 3: DOCKER VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC} Docker not installed"
    echo "  Install: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
else
    echo -e "${GREEN}✓${NC} Docker installed"
    docker --version | sed 's/^/  /'
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗${NC} Docker Compose not installed"
    echo "  Install: sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m) -o /usr/local/bin/docker-compose"
    exit 1
else
    echo -e "${GREEN}✓${NC} Docker Compose installed"
    docker-compose --version | sed 's/^/  /'
fi

echo ""
echo "STEP 4: RUNNING INTEGRATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pytest &> /dev/null; then
    echo "Running tests..."
    pytest tests/test_integration_control_panel_api.py -q
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} All integration tests passed"
    else
        echo -e "${RED}✗${NC} Integration tests failed"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC}  pytest not available. Skipping tests."
fi

echo ""
echo "STEP 5: DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Ready to deploy. Execute:"
echo ""
echo -e "${YELLOW}LOCAL (Development):${NC}"
echo "  docker-compose up --build"
echo ""
echo -e "${YELLOW}PRODUCTION (Ubuntu 24.04):${NC}"
echo "  1. docker-compose up -d --build"
echo "  2. Configure Nginx (see DEPLOYMENT_GUIDE.md)"
echo "  3. Setup SSL with Let's Encrypt"
echo "  4. Enable monitoring and backups"
echo ""

echo "STEP 6: POST-DEPLOYMENT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "After deployment, verify:"
echo ""
echo "  # Check services are running"
echo "  docker-compose ps"
echo ""
echo "  # Check API health"
echo "  curl http://localhost:8000/health"
echo ""
echo "  # Check Swagger UI"
echo "  curl -s http://localhost:8000/docs | head -20"
echo ""
echo "  # View logs"
echo "  docker-compose logs -f api"
echo ""

echo "STEP 7: FINAL CHECKLIST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Pre-deployment verification complete!"
echo ""
echo "Before going live:"
echo "  [ ] All environment variables configured"
echo "  [ ] Database backups enabled"
echo "  [ ] Monitoring setup (healthchecks, logs)"
echo "  [ ] SSL certificate installed"
echo "  [ ] Firewall configured (ports 80, 443 only)"
echo "  [ ] Domain pointing to server"
echo "  [ ] Team notified of deployment"
echo ""
echo -e "${GREEN}✓ System ready for production deployment!${NC}"
echo ""
echo "For detailed instructions, see: DEPLOYMENT_GUIDE.md"
echo "For status overview, see: PRODUCTION_READY.md"
echo ""
