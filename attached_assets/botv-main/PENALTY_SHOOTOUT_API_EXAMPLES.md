# ⚽ Penalty Shootout - API Request/Response Examples

## 🎮 Game Management API

### Create Game (Admin Only)
**Endpoint:** `POST /api/v1/penalty-shootout/games`

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/penalty-shootout/games \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "name": "Penalty Shootout Pro",
    "description": "Advanced penalty shootout with aggressive keeper",
    "min_bet_amount": "5.00",
    "max_bet_amount": "500.00",
    "min_rounds": 1,
    "max_rounds": 5,
    "goal_multiplier": "2.5",
    "keeper_save_probability": "35.0",
    "keeper_direction_prediction": "50.0"
  }'
```

**Response (201 Created):**
```json
{
  "id": 2,
  "name": "Penalty Shootout Pro",
  "description": "Advanced penalty shootout with aggressive keeper",
  "min_bet_amount": "5.00",
  "max_bet_amount": "500.00",
  "min_rounds": 1,
  "max_rounds": 5,
  "goal_multiplier": "2.50",
  "keeper_save_probability": "35.00",
  "keeper_direction_prediction": "50.00",
  "is_active": true,
  "is_featured": false,
  "icon_path": null,
  "total_sessions": 0,
  "total_shots_taken": 0,
  "total_goals_scored": 0,
  "total_bets_amount": "0.00",
  "total_winnings_amount": "0.00",
  "created_at": "2026-01-04T10:30:00Z",
  "updated_at": "2026-01-04T10:30:00Z"
}
```

---

### List All Games
**Endpoint:** `GET /api/v1/penalty-shootout/games`

**Request:**
```bash
curl http://localhost:8000/api/v1/penalty-shootout/games
```

**Response (200 OK):**
```json
{
  "games": [
    {
      "id": 1,
      "name": "Penalty Shootout Classic",
      "description": "Classic penalty shootout game",
      "min_bet_amount": "1.00",
      "max_bet_amount": "100.00",
      "min_rounds": 1,
      "max_rounds": 5,
      "goal_multiplier": "2.00",
      "keeper_save_probability": "30.00",
      "is_active": true,
      "is_featured": true,
      "icon_path": "/uploads/games/penalty_classic.png",
      "total_sessions": 42,
      "total_shots_taken": 126,
      "total_goals_scored": 88,
      "total_bets_amount": "2100.00",
      "total_winnings_amount": "1760.00"
    },
    {
      "id": 2,
      "name": "Penalty Shootout Pro",
      "description": "Advanced penalty shootout with aggressive keeper",
      "min_bet_amount": "5.00",
      "max_bet_amount": "500.00",
      "min_rounds": 1,
      "max_rounds": 5,
      "goal_multiplier": "2.50",
      "keeper_save_probability": "35.00",
      "is_active": true,
      "is_featured": false,
      "icon_path": null,
      "total_sessions": 15,
      "total_shots_taken": 45,
      "total_goals_scored": 30,
      "total_bets_amount": "850.00",
      "total_winnings_amount": "750.00"
    }
  ],
  "total_count": 2
}
```

---

### Get Single Game
**Endpoint:** `GET /api/v1/penalty-shootout/games/{game_id}`

**Request:**
```bash
curl http://localhost:8000/api/v1/penalty-shootout/games/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Penalty Shootout Classic",
  "description": "Classic penalty shootout game",
  "min_bet_amount": "1.00",
  "max_bet_amount": "100.00",
  "min_rounds": 1,
  "max_rounds": 5,
  "goal_multiplier": "2.00",
  "keeper_save_probability": "30.00",
  "keeper_direction_prediction": "50.00",
  "is_active": true,
  "is_featured": true,
  "icon_path": "/uploads/games/penalty_classic.png",
  "total_sessions": 42,
  "total_shots_taken": 126,
  "total_goals_scored": 88,
  "goal_rate": 69.84,
  "total_bets_amount": "2100.00",
  "total_winnings_amount": "1760.00",
  "house_profit": "340.00",
  "created_at": "2025-12-20T15:45:00Z",
  "updated_at": "2026-01-04T09:20:00Z"
}
```

---

## 🎮 Session Management API

### Create Session
**Endpoint:** `POST /api/v1/penalty-shootout/sessions`

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/penalty-shootout/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {user_token}" \
  -d '{
    "game_id": 1,
    "num_rounds": 3
  }'
```

**Response (201 Created):**
```json
{
  "session_id": "ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  "player_id": 42,
  "game_id": 1,
  "game_name": "Penalty Shootout Classic",
  "num_rounds": 3,
  "rounds_completed": 0,
  "initial_balance": "1000.00",
  "current_balance": "1000.00",
  "total_bet_amount": "0.00",
  "total_winnings": "0.00",
  "profit_loss": "0.00",
  "is_active": true,
  "is_completed": false,
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-01-04T12:35:00Z",
  "created_at": "2026-01-04T10:35:00Z",
  "start_time": "2026-01-04T10:35:00Z"
}
```

---

### Get Session Details
**Endpoint:** `GET /api/v1/penalty-shootout/sessions/{session_id}`

**Request:**
```bash
curl http://localhost:8000/api/v1/penalty-shootout/sessions/ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c \
  -H "Authorization: Bearer {user_token}"
```

**Response (200 OK):**
```json
{
  "session_id": "ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  "player_id": 42,
  "game_id": 1,
  "game_name": "Penalty Shootout Classic",
  "num_rounds": 3,
  "rounds_completed": 2,
  "initial_balance": "1000.00",
  "current_balance": "1050.00",
  "total_bet_amount": "100.00",
  "total_winnings": "150.00",
  "profit_loss": "50.00",
  "is_active": true,
  "is_completed": false,
  "rounds": [
    {
      "round_number": 1,
      "bet_amount": "50.00",
      "shot_direction": "left",
      "keeper_jump": "center",
      "outcome": "goal",
      "win_amount": "100.00",
      "multiplier_applied": "2.00",
      "keeper_reaction": "scored-against",
      "created_at": "2026-01-04T10:35:15Z"
    },
    {
      "round_number": 2,
      "bet_amount": "50.00",
      "shot_direction": "center",
      "keeper_jump": "center",
      "outcome": "saved",
      "win_amount": "0.00",
      "multiplier_applied": "0.00",
      "keeper_reaction": "saved",
      "created_at": "2026-01-04T10:36:20Z"
    }
  ],
  "expires_at": "2026-01-04T12:35:00Z",
  "created_at": "2026-01-04T10:35:00Z"
}
```

---

## ⚽ Gameplay API

### Take Shot (MAIN GAMEPLAY ENDPOINT)
**Endpoint:** `POST /api/v1/penalty-shootout/sessions/{session_id}/shoot`

#### Example 1: Goal Scenario
**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/penalty-shootout/sessions/ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c/shoot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {user_token}" \
  -d '{
    "bet_amount": "50.00",
    "shot_direction": "left"
  }'
```

**Response (200 OK - Goal):**
```json
{
  "round_number": 1,
  "outcome": "goal",
  "shot_direction": "left",
  "keeper_jump": "center",
  "keeper_reaction": "scored-against",
  "keeper_animation": "falling-left",
  "keeper_commentary": "Ooooh no! He shoots left!",
  "bet_amount": "50.00",
  "win_amount": "100.00",
  "multiplier_applied": "2.00",
  "new_balance": "1050.00",
  "round": 1,
  "total_rounds": 3,
  "rounds_completed": 1,
  "is_session_completed": false,
  "message": "🎉 GOAL! You won 100.00 SAR!",
  "created_at": "2026-01-04T10:35:15Z"
}
```

#### Example 2: Saved Scenario
**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/penalty-shootout/sessions/ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c/shoot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {user_token}" \
  -d '{
    "bet_amount": "75.00",
    "shot_direction": "right"
  }'
```

**Response (200 OK - Saved):**
```json
{
  "round_number": 2,
  "outcome": "saved",
  "shot_direction": "right",
  "keeper_jump": "right",
  "keeper_reaction": "saved",
  "keeper_animation": "diving-right",
  "keeper_commentary": "SAVE! Amazing reflexes!",
  "bet_amount": "75.00",
  "win_amount": "0.00",
  "multiplier_applied": "0.00",
  "new_balance": "975.00",
  "round": 2,
  "total_rounds": 3,
  "rounds_completed": 2,
  "is_session_completed": false,
  "message": "🧤 SAVED! The keeper blocked your shot!",
  "created_at": "2026-01-04T10:36:20Z"
}
```

#### Example 3: Miss Scenario
**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/penalty-shootout/sessions/ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c/shoot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {user_token}" \
  -d '{
    "bet_amount": "100.00",
    "shot_direction": "center"
  }'
```

**Response (200 OK - Miss):**
```json
{
  "round_number": 3,
  "outcome": "miss",
  "shot_direction": "center",
  "keeper_jump": "left",
  "keeper_reaction": "missed",
  "keeper_animation": "standing",
  "keeper_commentary": "Wide! The keeper wasn't even needed!",
  "bet_amount": "100.00",
  "win_amount": "0.00",
  "multiplier_applied": "0.00",
  "new_balance": "875.00",
  "round": 3,
  "total_rounds": 3,
  "rounds_completed": 3,
  "is_session_completed": true,
  "final_profit_loss": "-125.00",
  "message": "❌ MISS! You didn't score!",
  "created_at": "2026-01-04T10:37:30Z"
}
```

---

### Error Responses

#### Insufficient Balance
**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/penalty-shootout/sessions/ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c/shoot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {user_token}" \
  -d '{
    "bet_amount": "2000.00",
    "shot_direction": "left"
  }'
```

**Response (400 Bad Request):**
```json
{
  "error": "insufficient_balance",
  "message": "Your bet of 2000.00 SAR exceeds your balance of 875.00 SAR",
  "current_balance": "875.00",
  "required_amount": "2000.00",
  "shortfall": "1125.00"
}
```

#### Bet Below Minimum
**Response (400 Bad Request):**
```json
{
  "error": "bet_too_low",
  "message": "Bet amount must be at least 1.00 SAR",
  "minimum_bet": "1.00",
  "provided_bet": "0.50"
}
```

#### Bet Above Maximum
**Response (400 Bad Request):**
```json
{
  "error": "bet_too_high",
  "message": "Bet amount cannot exceed 100.00 SAR",
  "maximum_bet": "100.00",
  "provided_bet": "150.00"
}
```

#### Invalid Direction
**Response (400 Bad Request):**
```json
{
  "error": "invalid_direction",
  "message": "Shot direction must be 'left', 'center', or 'right'",
  "valid_directions": ["left", "center", "right"],
  "provided_direction": "up"
}
```

#### Session Expired
**Response (401 Unauthorized):**
```json
{
  "error": "session_expired",
  "message": "Your game session has expired",
  "expired_at": "2026-01-04T12:35:00Z"
}
```

#### Session Not Found
**Response (404 Not Found):**
```json
{
  "error": "session_not_found",
  "message": "Game session 'invalid_id' not found",
  "session_id": "invalid_id"
}
```

---

## 📊 Statistics API

### Get Game Statistics
**Endpoint:** `GET /api/v1/penalty-shootout/games/{game_id}/stats`

**Request:**
```bash
curl http://localhost:8000/api/v1/penalty-shootout/games/1/stats
```

**Response (200 OK):**
```json
{
  "game_id": 1,
  "game_name": "Penalty Shootout Classic",
  "total_sessions": 42,
  "total_shots_taken": 126,
  "total_goals_scored": 88,
  "goal_rate": 69.84,
  "save_rate": 20.63,
  "miss_rate": 9.52,
  "total_bets_amount": "2100.00",
  "total_winnings_amount": "1760.00",
  "house_profit": "340.00",
  "average_bet": "16.67",
  "average_winnings_per_goal": "20.00",
  "total_unique_players": 28,
  "avg_rounds_per_session": 3.0,
  "session_completion_rate": 95.24,
  "statistics_period": {
    "from": "2025-12-20T00:00:00Z",
    "to": "2026-01-04T23:59:59Z",
    "days": 16
  },
  "last_updated": "2026-01-04T11:00:00Z"
}
```

---

### Get User's Sessions
**Endpoint:** `GET /api/v1/penalty-shootout/my-sessions`

**Request:**
```bash
curl http://localhost:8000/api/v1/penalty-shootout/my-sessions \
  -H "Authorization: Bearer {user_token}"
```

**Response (200 OK):**
```json
{
  "player_id": 42,
  "total_sessions": 5,
  "sessions": [
    {
      "session_id": "ps_sess_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
      "game_id": 1,
      "game_name": "Penalty Shootout Classic",
      "num_rounds": 3,
      "rounds_completed": 3,
      "total_bet_amount": "225.00",
      "total_winnings": "300.00",
      "profit_loss": "75.00",
      "is_completed": true,
      "created_at": "2026-01-04T10:35:00Z",
      "completed_at": "2026-01-04T10:37:30Z",
      "duration_seconds": 150
    },
    {
      "session_id": "ps_sess_8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b",
      "game_id": 1,
      "game_name": "Penalty Shootout Classic",
      "num_rounds": 5,
      "rounds_completed": 5,
      "total_bet_amount": "350.00",
      "total_winnings": "250.00",
      "profit_loss": "-100.00",
      "is_completed": true,
      "created_at": "2026-01-02T14:20:00Z",
      "completed_at": "2026-01-02T14:35:45Z",
      "duration_seconds": 945
    }
  ],
  "total_bets": "750.00",
  "total_winnings": "700.00",
  "total_profit_loss": "-50.00",
  "win_rate": 0.4
}
```

---

## 🔑 Authentication Examples

### Using Bearer Token
```bash
# Include Authorization header
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:8000/api/v1/penalty-shootout/my-sessions
```

### Token Response from Login
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 7200,
  "expires_at": "2026-01-04T13:00:00Z"
}
```

---

## 📋 Request/Response Headers

### Common Request Headers
```
Content-Type: application/json
Authorization: Bearer {token}
User-Agent: MyApp/1.0
Accept: application/json
```

### Common Response Headers
```
Content-Type: application/json; charset=utf-8
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1704362400
```

---

## 🧪 Testing with cURL

### Test Complete Game Flow
```bash
#!/bin/bash

# 1. Create session
SESSION=$(curl -s -X POST http://localhost:8000/api/v1/penalty-shootout/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"game_id": 1, "num_rounds": 1}' | jq -r '.session_id')

echo "Session created: $SESSION"

# 2. Take shot
curl -s -X POST http://localhost:8000/api/v1/penalty-shootout/sessions/$SESSION/shoot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"bet_amount": 50.00, "shot_direction": "left"}' | jq '.'

# 3. Get session details
curl -s http://localhost:8000/api/v1/penalty-shootout/sessions/$SESSION \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

**Last Updated:** 2026-01-04  
**API Version:** v1.0.0  
**Status:** ✅ Production Ready
