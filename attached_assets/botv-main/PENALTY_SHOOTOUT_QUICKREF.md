# ⚽ Penalty Shootout - Quick Reference Guide

## 📁 File Structure
```
models/penalty_shootout.py                    # Database models (280 lines)
services/games/penalty_shootout_service.py   # Game logic (620 lines)
api/routes/penalty_shootout.py                # API endpoints (380 lines)
handlers/penalty_shootout.py                  # Telegram handlers (420 lines)
tests/test_penalty_shootout.py                # Test suite (480 lines)
PENALTY_SHOOTOUT_COMPLETE_GUIDE.md           # Full documentation
```

---

## 🔥 Most Important Functions

### Service Layer (PenaltyShootoutService)

#### Create a Game
```python
game = await service.create_game(
    name="Penalty Shootout",
    description="Classic penalty game",
    min_bet=Decimal("1.0"),
    max_bet=Decimal("100.0"),
    goal_multiplier=Decimal("2.0"),
    keeper_save_probability=Decimal("30.0"),
    admin_id=1
)
```

#### Create a Session
```python
session = await service.create_session(
    player_id=42,
    game_id=1,
    num_rounds=3
)
# Returns: session_id, session_token, signature
```

#### Take a Shot (MAIN FUNCTION)
```python
round_record, result = await service.take_shot(
    session_id="abc123...",
    bet_amount=Decimal("50.00"),
    shot_direction="left"  # or "center" or "right"
)

# result contains:
# {
#     "outcome": "goal",  # or "saved", "miss"
#     "shot_direction": "left",
#     "keeper_jump": "center",
#     "keeper_reaction": "scored-against",
#     "keeper_animation": "falling-right",
#     "bet_amount": "50.00",
#     "win_amount": "100.00",
#     "multiplier": "2.0",
#     "new_balance": "1050.00"
# }
```

---

## 🎯 API Endpoints Quick Reference

### Game Management
```
POST   /api/v1/penalty-shootout/games              # Create game
GET    /api/v1/penalty-shootout/games              # List games
GET    /api/v1/penalty-shootout/games/{id}         # Get details
```

### Session Management
```
POST   /api/v1/penalty-shootout/sessions           # Create session
GET    /api/v1/penalty-shootout/sessions/{id}      # Get session
```

### Gameplay
```
POST   /api/v1/penalty-shootout/sessions/{id}/shoot  # Take shot
GET    /api/v1/penalty-shootout/my-sessions          # My sessions
GET    /api/v1/penalty-shootout/games/{id}/stats     # Game stats
```

---

## 🤖 Telegram Bot FSM States

```
/penalty command
    ↓
[selecting_game] - Display game list
    ↓
[entering_rounds] - Ask "How many rounds? (1-5)"
    ↓
[betting] ←─────────────────────┐
    ↓                           │
    Show betting screen         │
    (balance, bet input, quick  │
    buttons)                    │
    ↓                           │
[shooting]                      │
    ↓                           │
    Ask direction               │
    (left/center/right)         │
    ↓                           │
[result]                        │
    ↓                           │
    Show outcome + new balance  │
    ↓                           │
    More rounds? ───────────────┘
    (if yes, return to [betting])
    ↓
    No → Session complete
```

---

## 💡 Key Concepts

### Betting UI Flow
```
Round 1 of 3
│
├─ BETTING STATE
│  └─ Show: balance, input field, quick buttons
│     Hide: direction buttons
│
├─ User enters bet (50.00)
│
├─ SHOOTING STATE
│  └─ Hide: bet input
│     Show: direction buttons (👈 👍 👉)
│
├─ User picks direction (LEFT)
│
├─ RESULT STATE
│  └─ Show: outcome, balance update
│     Next round? 
│
└─ IF YES → Back to BETTING for round 2
```

### Financial Flow
```
User Bet: 50.00 SAR
│
├─ [DEBIT] Player balance: 1000 → 950
│  (Recorded in Transaction with signature)
│
├─ Outcome Calculation:
│  ├─ Keeper predicts direction (50% accuracy)
│  ├─ Keeper jumps
│  ├─ Check if save (configurable probability)
│  └─ Determine goal/saved/miss
│
└─ If GOAL (70% probability):
   ├─ Win amount: 50 × 2.0 = 100.00
   ├─ [CREDIT] Player balance: 950 → 1050
   └─ Recorded in Transaction with signature
```

---

## 🧪 Running Tests

```bash
# All tests
pytest tests/test_penalty_shootout.py -v

# Specific test
pytest tests/test_penalty_shootout.py::test_take_shot_valid -v

# With coverage
pytest tests/test_penalty_shootout.py --cov

# Test patterns
pytest tests/test_penalty_shootout.py -k "balance" -v     # Balance tests only
pytest tests/test_penalty_shootout.py -k "full_flow" -v   # Full flow test
```

### Test Coverage
- ✅ Game CRUD operations
- ✅ Session creation and retrieval
- ✅ Shot mechanics (all outcomes)
- ✅ Balance deduction/crediting
- ✅ Multiple rounds per session
- ✅ Transaction logging
- ✅ Error handling

---

## 🔐 Security Checklist

- ✅ **Signatures**: Every financial transaction has HMAC SHA-256 signature
- ✅ **Tokens**: Session created with JWT token
- ✅ **Idempotency**: Same bet can't be processed twice
- ✅ **Balance Atomicity**: Balance deducted BEFORE outcome, credited AFTER
- ✅ **Audit Trail**: Every action logged to AuditLog
- ✅ **Validation**: Bet limits, directions, balance checks

---

## ⚠️ Common Issues & Solutions

### Issue: "Insufficient Balance"
```
Error: Bet amount (100.00) exceeds balance (50.00)
Solution: User must have minimum bet amount available
```

### Issue: "Invalid Direction"
```
Error: shot_direction must be 'left', 'center', or 'right'
Solution: Direction is case-sensitive and must be one of three values
```

### Issue: "Session Expired"
```
Error: Session token has expired
Solution: Sessions expire after 2 hours. Create new session.
```

### Issue: "Round Limit Exceeded"
```
Error: Cannot take shot in round 4 (max rounds: 3)
Solution: Session already completed. Create new session for more rounds.
```

---

## 📊 Database Queries

### Get all active games
```sql
SELECT id, name, min_bet_amount, max_bet_amount, is_active
FROM penalty_shootout_games
WHERE is_active = true
ORDER BY name;
```

### Get player's sessions
```sql
SELECT session_id, num_rounds, rounds_completed, 
       total_bet_amount, total_winnings, profit_loss
FROM penalty_shootout_sessions
WHERE player_id = 42
ORDER BY start_time DESC;
```

### Get session details
```sql
SELECT r.round_number, r.outcome, r.bet_amount, r.win_amount,
       r.player_shot_direction, r.keeper_jump_direction
FROM penalty_shootout_rounds r
WHERE r.session_id = 'abc123...'
ORDER BY r.round_number;
```

### Calculate game statistics
```sql
SELECT 
  COUNT(*) as total_sessions,
  SUM(CASE WHEN outcome = 'goal' THEN 1 ELSE 0 END) as total_goals,
  COUNT(DISTINCT player_id) as unique_players,
  SUM(bet_amount) as total_bets,
  SUM(CASE WHEN outcome = 'goal' THEN win_amount ELSE 0 END) as total_winnings
FROM penalty_shootout_rounds
WHERE created_at >= NOW() - INTERVAL 7 DAY;
```

---

## 🚀 Deployment Checklist

- [ ] Create database migrations
- [ ] Set environment variables (.env file)
- [ ] Run tests: `pytest tests/test_penalty_shootout.py -v`
- [ ] Initialize database: `python -m alembic upgrade head`
- [ ] Create default game via admin API
- [ ] Start bot: `python bot_main.py`
- [ ] Verify `/penalty` command works
- [ ] Test bet → shot → result flow
- [ ] Check transaction logs
- [ ] Monitor error logs

---

## 🎯 Example: Complete Game Flow

```python
import asyncio
from decimal import Decimal
from database import session_maker
from services.games.penalty_shootout_service import PenaltyShootoutService

async def demo():
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        
        # 1. Get game
        game = await service.get_game(1)
        print(f"Game: {game.name}")
        
        # 2. Create session
        session_data = await service.create_session(
            player_id=42,
            game_id=1,
            num_rounds=2
        )
        session_id = session_data['session_id']
        print(f"Session created: {session_id}")
        
        # 3. Round 1 - Take shot
        round1, result1 = await service.take_shot(
            session_id=session_id,
            bet_amount=Decimal("50.00"),
            shot_direction="left"
        )
        print(f"Round 1: {result1['outcome']} | Balance: {result1['new_balance']}")
        
        # 4. Round 2 - Take shot
        round2, result2 = await service.take_shot(
            session_id=session_id,
            bet_amount=Decimal("100.00"),
            shot_direction="center"
        )
        print(f"Round 2: {result2['outcome']} | Balance: {result2['new_balance']}")
        
        # 5. Get final session
        session = await service.get_session(session_id)
        profit = session.profit_loss
        print(f"Total Profit/Loss: {profit}")

asyncio.run(demo())
```

---

## 📞 Support

- 📖 Full documentation: [PENALTY_SHOOTOUT_COMPLETE_GUIDE.md](PENALTY_SHOOTOUT_COMPLETE_GUIDE.md)
- 🐛 Report bugs in tests: `tests/test_penalty_shootout.py`
- 💬 Questions? Check the docstrings in service files
- 🔍 Debug mode: Set `LOG_LEVEL=DEBUG` in .env

---

**Last Updated:** 2026-01-04  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
