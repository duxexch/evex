# ⚽ Penalty Shootout Game - Complete Implementation Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Game Mechanics](#game-mechanics)
3. [Technical Architecture](#technical-architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Endpoints](#api-endpoints)
7. [Security Features](#security-features)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Quick Start](#quick-start)

---

## 🎯 Overview

**Penalty Shootout** is a complete, production-ready football penalty game integrated into the LangSense gaming system.

### Key Features
- ⚽ **Dynamic Betting**: Players choose bet amount before each shot
- 🎯 **AI Keeper**: Realistic keeper AI with prediction and save mechanics
- 💰 **Real-time Balance Updates**: Immediate balance feedback
- 🔐 **Military-Grade Security**: HMAC signatures, JWT tokens, idempotency
- 📊 **Full Audit Trail**: Complete transaction and action logging
- 🎨 **Smooth UX**: Dynamic UI elements that show/hide based on game state
- 🌐 **Multi-round Sessions**: Play 1-5 rounds in one session

### Game Flow
```
1. User selects game (/penalty)
   ↓
2. Choose number of rounds (1-5)
   ↓
3. [BETTING SCREEN] - Enter bet amount for round 1
   ↓
4. [SHOOTING SCREEN] - Choose shot direction (left/center/right)
   ↓
5. [RESULT SCREEN] - See outcome, keeper reaction, balance update
   ↓
6. If more rounds → Back to BETTING SCREEN
   ↓
7. Session completed → See total profit/loss
```

---

## 🎮 Game Mechanics

### Shooting Directions
```
👈 LEFT    👍 CENTER    👉 RIGHT
```

### Keeper AI
- **Prediction**: Keeper tries to predict shot direction (50% accuracy)
- **Jump**: Keeper jumps based on prediction (±randomness)
- **Save**: If keeper jumps to same direction as shot AND passes save check (probability based on game config)

### Outcomes
1. **GOAL** ✅
   - Shot direction differs from keeper jump OR keeper fails save check
   - Player wins: `bet_amount × goal_multiplier`
   - Balance credited immediately

2. **SAVED** 🧤
   - Keeper jumps to same direction AND passes save check
   - Player loses entire bet
   - Balance unchanged (already deducted)

3. **MISS** ❌
   - Shooter misses even though keeper is out of position
   - Rare event (configurable probability)
   - Player loses entire bet

### House Edge
- Configurable per game
- Affects goal probability calculation
- Default: 70% goal probability, 30% save/miss

---

## 🏗️ Technical Architecture

### Database Models

#### PenaltyShootoutGame
```python
- id: Integer (Primary Key)
- name: String (unique)
- description: Text
- min_bet_amount: Decimal
- max_bet_amount: Decimal
- min_rounds: Integer (default 1)
- max_rounds: Integer (default 5)
- goal_multiplier: Decimal (default 2.0)
- keeper_save_probability: Decimal (0-100)
- keeper_direction_prediction: Decimal (0-100)
- is_active: Boolean
- is_featured: Boolean
- icon_path: String
- Statistics:
  - total_sessions: Integer
  - total_shots_taken: Integer
  - total_goals_scored: Integer
  - total_bets_amount: Decimal
  - total_winnings_amount: Decimal
```

#### PenaltyShootoutSession
```python
- session_id: String (unique)
- player_id: ForeignKey(User)
- game_id: ForeignKey(PenaltyShootoutGame)
- num_rounds: Integer
- rounds_completed: Integer
- Financial:
  - initial_balance: Decimal
  - total_bet_amount: Decimal
  - total_winnings: Decimal
  - final_balance: Decimal
  - profit_loss: Decimal
- Security:
  - session_token: String (JWT)
  - signature: String (HMAC)
  - idempotency_key: String
- Status:
  - is_active: Boolean
  - is_completed: Boolean
- Tracking:
  - start_time, end_time, expires_at
  - ip_address, user_agent
```

#### PenaltyShootoutRound
```python
- session_id: ForeignKey(PenaltyShootoutSession)
- round_number: Integer
- player_shot_direction: Enum (LEFT, CENTER, RIGHT)
- keeper_predicted_direction: Enum
- keeper_jump_direction: Enum
- keeper_saved: Boolean
- outcome: Enum (GOAL, SAVED, MISS)
- bet_amount: Decimal
- win_amount: Decimal
- multiplier_applied: Decimal
- keeper_animation: String
- keeper_reaction: String (saved, blocked, scored-against)
```

### File Structure
```
/workspaces/botv/
├── models/
│   └── penalty_shootout.py      # Database models
├── services/
│   └── games/
│       └── penalty_shootout_service.py  # Game logic
├── api/
│   └── routes/
│       └── penalty_shootout.py  # FastAPI endpoints
├── handlers/
│   └── penalty_shootout.py      # Telegram bot handlers
└── tests/
    └── test_penalty_shootout.py # Unit & integration tests
```

---

## 💻 Backend Implementation

### 1. Models (models/penalty_shootout.py)

Define database schema with all necessary fields, constraints, and relationships.

**Key Features:**
- 🔒 CheckConstraints for data validation
- 📊 Indexes for performance
- 🔗 Relationships between entities
- 💪 Strong typing with Enums

### 2. Service (services/games/penalty_shootout_service.py)

Core game logic and business rules.

**Main Methods:**

#### Game Management
```python
create_game(name, description, min_bet, max_bet, ...)
get_game(game_id)
get_active_games()
update_game_icon(game_id, icon_path, icon_type, admin_id)
```

#### Session Management
```python
create_session(player_id, game_id, num_rounds)
get_session(session_id)
```

#### Shot Mechanics
```python
take_shot(session_id, bet_amount, shot_direction)
  → (round_record, result_details)
```

**Financial Security:**
- Deduct bet BEFORE outcome calculation
- Credit winnings AFTER outcome calculation
- Create Transaction records for all changes
- Log to AuditLog for complete audit trail

**Keeper AI:**
```python
_simulate_keeper(game) → keeper_data
  - Predict direction
  - Jump direction
  - Animation data
  - Reaction string

_calculate_outcome(game, shot_direction, keeper_data) → (outcome, win_amount, multiplier)
```

---

## 🎨 Frontend Implementation

### Telegram Handler (handlers/penalty_shootout.py)

**Game Flow with FSM States:**

1. **Command**: `/penalty`
   - Show game list with icons

2. **selecting_game**: User picks a game
   - Display game details (rules, bet limits, keeper stats)
   - Ask for number of rounds

3. **entering_rounds**: User selects 1-5 rounds
   - Create session
   - Move to betting screen

4. **betting**: [BEFORE EACH SHOT]
   - ✅ Show current balance (LIVE)
   - ✅ Show bet limits
   - ✅ Quick bet buttons
   - ✅ Custom bet input
   - ❌ Hide shooting direction buttons
   - ❌ Hide result details

5. **shooting**: [DURING SHOT]
   - ❌ Hide bet input
   - ✅ Show direction selection buttons
   - Show "taking shot..." animation

6. **result**: [AFTER SHOT]
   - ✅ Show outcome (GOAL/SAVED/MISS) with emoji
   - ✅ Show keeper reaction animation
   - ✅ Show new balance (UPDATED)
   - ✅ Show round progress (X/Y)
   - ❌ Hide direction buttons
   
   **Then:**
   - If more rounds → Back to **betting** state
   - If completed → Show final profit/loss, offer new game

### UI Elements

#### Betting Screen
```
⚽ Joulette 1/3

💰 Current Balance: 950.00

💵 Min Bet: 1.00
💵 Max Bet: 100.00

💬 Enter bet amount or choose from buttons:

[💰 10.00] [💰 50.00] [💰 100.00]
[❌ Cancel]
```

#### Shooting Screen
```
⚽ Joulette 1/3

💰 Your Bet: 50.00

🎯 Choose shot direction:

[👈 LEFT] [👍 CENTER] [👉 RIGHT]
```

#### Result Screen (Goal)
```
🎉 GOAL! Hdeeeef!

👨‍🦰 Keeper Reaction: Scored Against

💰 Bet: 50.00
💵 Winnings: 100.00

💳 Your New Balance: 1050.00

📊 Round: 2/3

[⚽ Next Round] 🔙 [Back to Menu]
```

---

## 🌐 API Endpoints

### Game Management

#### Create Game
```
POST /api/v1/penalty-shootout/games
Authorization: Bearer {admin_token}

Request:
{
  "name": "Penalty Shootout Pro",
  "description": "Advanced penalty shootout game",
  "min_bet": 5.00,
  "max_bet": 500.00,
  "min_rounds": 1,
  "max_rounds": 5,
  "goal_multiplier": 2.5,
  "keeper_save_probability": 30.0
}

Response: 201
{
  "id": 1,
  "name": "Penalty Shootout Pro",
  "is_active": true,
  ...
}
```

#### List Games
```
GET /api/v1/penalty-shootout/games

Response: 200
[
  { "id": 1, "name": "Penalty Shootout Pro", ... },
  { "id": 2, "name": "Penalty Shootout Expert", ... }
]
```

#### Get Game Details
```
GET /api/v1/penalty-shootout/games/{game_id}

Response: 200
{
  "id": 1,
  "name": "Penalty Shootout Pro",
  "min_bet_amount": 5.00,
  "max_bet_amount": 500.00,
  ...
}
```

### Session Management

#### Create Session
```
POST /api/v1/penalty-shootout/sessions
Authorization: Bearer {user_token}

Request:
{
  "game_id": 1,
  "num_rounds": 3
}

Response: 201
{
  "session_id": "abc123xyz789...",
  "player_id": 42,
  "game_id": 1,
  "num_rounds": 3,
  "rounds_completed": 0,
  "is_active": true
}
```

#### Get Session Details
```
GET /api/v1/penalty-shootout/sessions/{session_id}
Authorization: Bearer {user_token}

Response: 200
{
  "session_id": "abc123xyz789...",
  "rounds_completed": 1,
  "total_bet_amount": 50.00,
  "total_winnings": 100.00
}
```

### Gameplay

#### Take Shot (MAIN ENDPOINT)
```
POST /api/v1/penalty-shootout/sessions/{session_id}/shoot
Authorization: Bearer {user_token}

Request:
{
  "session_id": "abc123xyz789...",
  "bet_amount": 50.00,
  "shot_direction": "left"  # or "center" or "right"
}

Response: 200
{
  "round_number": 1,
  "outcome": "goal",
  "shot_direction": "left",
  "keeper_jump": "center",
  "keeper_reaction": "scored-against",
  "bet_amount": "50.00",
  "win_amount": "100.00",
  "multiplier": "2.0",
  "new_balance": "1050.00",
  "round": 1,
  "total_rounds": 3,
  "is_session_completed": false
}
```

### Statistics

#### Get Game Stats
```
GET /api/v1/penalty-shootout/games/{game_id}/stats

Response: 200
{
  "game_id": 1,
  "name": "Penalty Shootout Pro",
  "total_sessions": 150,
  "total_shots_taken": 450,
  "total_goals_scored": 315,
  "goal_rate": 70.0,
  "total_bets": "22500.00",
  "total_winnings": "15750.00",
  "house_profit": "6750.00"
}
```

#### Get User Sessions
```
GET /api/v1/penalty-shootout/my-sessions
Authorization: Bearer {user_token}

Response: 200
[
  {
    "session_id": "abc...",
    "game_id": 1,
    "rounds_completed": 3,
    "total_bet_amount": "150.00",
    "profit_loss": "50.00",
    "is_completed": true
  }
]
```

---

## 🔐 Security Features

### 1. Digital Signatures
Every transaction is signed with HMAC SHA-256:
```python
signature = hmac.new(
    secret_key.encode(),
    f"{user_id}|DEBIT|50.00|1000.00|950.00".encode(),
    hashlib.sha256
).hexdigest()
```

### 2. JWT Tokens
Session tokens with expiration:
```python
token = jwt.encode({
    'session_id': session_id,
    'player_id': player_id,
    'game_id': game_id,
    'exp': datetime.utcnow() + timedelta(hours=2),
    'iat': datetime.utcnow()
}, secret_key, algorithm='HS256')
```

### 3. Idempotency Keys
Prevent duplicate transactions:
```python
idempotency_key = f"penalty_bet_{session_id}_{round_number}"
```

### 4. Session Expiry
Sessions expire after 2 hours of inactivity

### 5. Transaction Integrity
- Deduct BEFORE outcome calculation
- Credit AFTER outcome verification
- Immutable Transaction records
- Balance before/after validation

### 6. Audit Logging
Every action logged:
- `penalty_shootout_game_created`
- `penalty_shootout_session_created`
- `penalty_shootout_round_completed`
- `penalty_shootout_bet_deducted`
- `penalty_shootout_winnings_credited`

---

## 🧪 Testing

### Unit Tests
```bash
pytest tests/test_penalty_shootout.py::test_create_game -v
pytest tests/test_penalty_shootout.py::test_create_session -v
pytest tests/test_penalty_shootout.py::test_take_shot_valid -v
```

### Integration Tests
```bash
pytest tests/test_penalty_shootout.py::test_full_game_flow -v
pytest tests/test_penalty_shootout.py::test_balance_tracking -v
pytest tests/test_penalty_shootout.py::test_multiple_rounds_session -v
```

### Test Coverage
- ✅ Game creation and retrieval
- ✅ Session lifecycle
- ✅ Shot mechanics and outcomes
- ✅ Balance deduction and crediting
- ✅ Multiple rounds in one session
- ✅ Transaction logging
- ✅ Audit trail
- ✅ Error handling
- ✅ Invalid inputs
- ✅ Insufficient balance

### Running Tests
```bash
# All tests
pytest tests/test_penalty_shootout.py -v

# Specific test
pytest tests/test_penalty_shootout.py::test_full_game_flow -v

# With coverage
pytest tests/test_penalty_shootout.py --cov=services.games --cov=models.penalty_shootout
```

---

## 🚀 Deployment

### Requirements
```
python-jose[cryptography]>=0.8.0
PyJWT>=2.8.0
python-magic-bin>=0.4.14  # For file type detection
```

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/langsense_db

# Encryption/Security
ENCRYPTION_KEY=your-32-character-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Game Configuration
PENALTY_GAME_MIN_BET=1.0
PENALTY_GAME_MAX_BET=1000.0
KEEPER_SAVE_PROBABILITY=30.0
```

### Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "bot_main.py"]
```

### Health Check
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "games": await get_active_games_count(),
        "active_sessions": await get_active_sessions_count()
    }
```

---

## ⚡ Quick Start

### 1. Create Test Game
```python
import asyncio
from decimal import Decimal
from database import session_maker
from services.games.penalty_shootout_service import PenaltyShootoutService

async def create_demo_game():
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        
        game = await service.create_game(
            name="Penalty Shootout",
            description="Classic penalty shootout game",
            min_bet=Decimal("1.0"),
            max_bet=Decimal("100.0"),
            goal_multiplier=Decimal("2.0"),
            keeper_save_probability=Decimal("30.0"),
            admin_id=1
        )
        
        print(f"✅ Game created: {game.name} (ID: {game.id})")

asyncio.run(create_demo_game())
```

### 2. Run Bot
```bash
python bot_main.py
```

### 3. In Telegram
```
/penalty
→ Select game
→ Choose rounds (1-5)
→ Enter bet amount
→ Select shot direction
→ See result
→ Continue or finish
```

### 4. Check Database
```sql
SELECT * FROM penalty_shootout_games;
SELECT * FROM penalty_shootout_sessions;
SELECT * FROM penalty_shootout_rounds;
```

---

## 📊 Monitoring

### Key Metrics
```
- Total games created
- Total sessions played
- Goals scored vs. shots taken (success rate)
- Total bets vs. total winnings (house profit)
- Average bet amount
- Player retention
- Keeper save rate
```

### Logging
```python
logger.info(f"Penalty Shootout round completed: {session_id} | Round: {round_num}/total | Outcome: {outcome}")
logger.error(f"Error in penalty_shootout: {e}", exc_info=True)
```

---

## 🎯 Future Enhancements

1. **Advanced Keeper AI**
   - Machine learning-based keeper predictions
   - Player-specific keeper behavior

2. **Multiplayer Mode**
   - Player vs. Player tournaments
   - Leaderboards

3. **Seasonal Events**
   - Double XP seasons
   - Special keeper challenges

4. **Mobile App**
   - Native iOS/Android app
   - Real-time updates via WebSocket

5. **Analytics Dashboard**
   - Player statistics
   - Game performance metrics
   - Revenue analytics

---

**Status:** ✅ Production Ready

**Version:** 1.0.0

**Last Updated:** 2026-01-04
