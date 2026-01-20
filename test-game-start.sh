#!/bin/bash

# Test full game start flow end-to-end

echo "================================"
echo "Full Game Start Flow Test"
echo "================================"
echo ""

# Get auth token
echo "[1] Getting auth token..."
USER_DATA=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_player_1",
    "password": "testpass123"
  }')

if [ $? -ne 0 ]; then
  echo "❌ Failed to login - trying signup first"
  curl -s -X POST http://localhost:5000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "username": "test_player_1",
      "email": "test1@example.com",
      "password": "testpass123"
    }' > /dev/null
  
  USER_DATA=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "username": "test_player_1",
      "password": "testpass123"
    }')
fi

TOKEN=$(echo $USER_DATA | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo $USER_DATA | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  echo "Response: $USER_DATA"
  exit 1
fi

echo "✓ Auth token obtained: ${TOKEN:0:20}..."
echo "✓ User ID: $USER_ID"
echo ""

# Get available challenges
echo "[2] Getting available challenges..."
CHALLENGES=$(curl -s -X GET http://localhost:5000/api/challenges/available \
  -H "Authorization: Bearer $TOKEN")

CHALLENGE_ID=$(echo $CHALLENGES | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CHALLENGE_ID" ]; then
  echo "❌ No challenges available"
  echo "Response: $CHALLENGES"
  exit 1
fi

echo "✓ Challenge found: $CHALLENGE_ID"
echo ""

# Accept the challenge
echo "[3] Accepting challenge..."
ACCEPT=$(curl -s -X POST http://localhost:5000/api/challenges/$CHALLENGE_ID/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Accept response: $ACCEPT"
echo ""

# Check game status
echo "[4] Checking game status..."
STATUS=$(curl -s -X GET http://localhost:5000/api/game-start/status/$CHALLENGE_ID \
  -H "Authorization: Bearer $TOKEN")

echo "Game status: $STATUS"
echo ""

echo "================================"
echo "✓ Test completed successfully"
echo "================================"
