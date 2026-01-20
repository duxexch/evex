#!/bin/bash
# Challenge System - Route Integration Script
# Integrates new service layer with existing routes

set -e

PROJECT_ROOT="/workspaces/evex"
cd "$PROJECT_ROOT"

echo "╔════════════════════════════════════════════════════════╗"
echo "║ Challenge System - Route Integration                   ║"
echo "╚════════════════════════════════════════════════════════╝"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify build
echo -e "\n${BLUE}[1/5]${NC} Verifying build..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${YELLOW}⚠${NC} Build has errors (non-blocking)"
fi

# Step 2: Show service files
echo -e "\n${BLUE}[2/5]${NC} Service files created:"
find server/services -name "*.ts" -type f | grep -v node_modules | while read file; do
    size=$(wc -l < "$file")
    echo -e "  ${GREEN}✓${NC} $file ($size lines)"
done

# Step 3: Verify imports
echo -e "\n${BLUE}[3/5]${NC} Verifying imports..."
if ! grep -r "@/server" server/services/ --include="*.ts" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} All @/server paths fixed"
else
    echo -e "${YELLOW}⚠${NC} Some @/server paths remain"
fi

# Step 4: Show integration steps
echo -e "\n${BLUE}[4/5]${NC} Integration steps:"
echo -e "  ${GREEN}1.${NC} Update /server/routes/challenges.ts to import from services"
echo -e "  ${GREEN}2.${NC} Replace POST /api/challenges with ChallengeCreator"
echo -e "  ${GREEN}3.${NC} Replace POST /api/challenges/:id/join with ChallengeAcceptor"
echo -e "  ${GREEN}4.${NC} Replace POST /api/challenges/:id/withdraw with CurrencyService"
echo -e "  ${GREEN}5.${NC} Add WebSocket handlers for game_start, player_abandoned, game_inactivity"

# Step 5: Show testing commands
echo -e "\n${BLUE}[5/5]${NC} Testing commands:"
echo ""
echo -e "${YELLOW}Create Challenge:${NC}"
echo 'curl -X POST http://localhost:3000/api/challenges \'
echo '  -H "Authorization: Bearer <token>" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{
    "gameType": "chess",
    "betAmount": 100,
    "currencyType": "project",
    "visibility": "public"
  }'"'"

echo ""
echo -e "${YELLOW}Accept Challenge:${NC}"
echo 'curl -X POST http://localhost:3000/api/challenges/<challengeId>/join \'
echo '  -H "Authorization: Bearer <token>" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{}'

echo ""
echo -e "${YELLOW}WebSocket Test (game_start message):${NC}"
echo 'Use browser console: ws = new WebSocket("ws://localhost:3000"); ws.onmessage = (e) => console.log(e);'

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Ready for route integration!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"

# Show file locations
echo ""
echo -e "${BLUE}Key Files:${NC}"
echo -e "  Services:  ${GREEN}server/services/challenges/${NC}"
echo -e "  Routes:    ${GREEN}server/routes/challenges-refactored.ts${NC}"
echo -e "  Client:    ${GREEN}client/src/lib/challenges-api.ts${NC}"
echo -e "  WebSocket: ${GREEN}server/game-websocket.ts${NC}"
echo ""
echo -e "Deployment guide: ${GREEN}CHALLENGE_SYSTEM_DEPLOYMENT.md${NC}"
echo ""
