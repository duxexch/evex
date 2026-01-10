# Integration Guide: Phases 3-6

## Quick Start Integration

### Step 1: Verify Files Created

```bash
# Check all new files exist
ls -la handlers/admin_*.py
ls -la services/{telegram_notification,notification_delivery,audit_log,game_algorithm}_*.py
ls -la algorithms/{base_strategy,conservative_algorithm,dynamic_algorithm}.py
ls -la tests/test_{regression,isolation,failures}.py
```

Expected: 13 files total (3 handlers + 4 services + 3 algorithms + 3 tests + 1 doc)

### Step 2: Update bot.py

Add handler registration:

```python
# At top of bot.py
from handlers.admin_distribution_ui import router as dist_router
from handlers.admin_algorithm_settings import router as algo_router
from handlers.admin_audit_views import router as audit_router

# In dispatcher setup (around where other routers registered)
dp.include_router(dist_router)
dp.include_router(algo_router)
dp.include_router(audit_router)
```

### Step 3: Update API routes (api/routes/)

Add algorithm endpoint:

```python
# In api/routes/admin.py or new api/routes/algorithms.py
from fastapi import APIRouter, Depends
from services.game_algorithm_manager import GameAlgorithmManager, AlgorithmMode

router = APIRouter(prefix="/admin/algorithms", tags=["algorithms"])

@router.get("/current")
async def get_current_algorithm(session=Depends(get_db)):
    algo, _ = await GameAlgorithmManager.get_algorithm(session)
    return algo.get_algorithm_info()

@router.post("/switch/{mode}")
async def switch_algorithm(
    mode: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    # Verify admin
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403)
    
    success, error = await GameAlgorithmManager.switch_algorithm(
        session,
        AlgorithmMode(mode)
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    return {"success": True, "message": f"Switched to {mode}"}
```

### Step 4: Initialize System Settings

On first startup, create default settings:

```python
# In bot startup or initialization
from services.system_settings_service import SystemSettingsService, SettingKey

async def initialize_system_settings(session):
    """Initialize default game algorithm settings"""
    
    # Check if already initialized
    existing = await SystemSettingsService.get_setting(
        session,
        SettingKey.GAME_ALGORITHM_MODE
    )
    
    if existing is None:
        # Set defaults
        await SystemSettingsService.set_setting(
            session,
            SettingKey.GAME_ALGORITHM_MODE,
            'FIXED_HOUSE_EDGE',
            category='game_algorithms',
            admin_id=None,
        )
        
        await SystemSettingsService.set_setting(
            session,
            SettingKey.HOUSE_EDGE_PERCENTAGE,
            '5.0',
            category='game_algorithms',
            admin_id=None,
        )
        
        await session.commit()
```

### Step 5: Test Integration

```bash
# Run all test suites
pytest tests/test_regression.py -v
pytest tests/test_isolation.py -v
pytest tests/test_failures.py -v

# Expected: 40+ tests passing
```

### Step 6: Deploy and Monitor

```bash
# 1. Backup database
cp langsense.db langsense.db.backup

# 2. Run migrations (if any)
alembic upgrade head

# 3. Start bot/API
python bot.py &
python api/main.py &

# 4. Monitor logs
tail -f logs/bot.log
tail -f logs/api.log
```

---

## Admin Commands

### Telegram Bot Commands

**Distribution Management**:
```
/distribution_settings        - View current distribution mode
/switch_distribution ROUND_ROBIN - Switch mode
/view_agents                  - List all agents
/view_distributions           - Active distributions
```

**Algorithm Management**:
```
/algorithm_settings           - View algorithm configuration
/algorithm_history            - View change history
/view_algo_stats             - Performance statistics
/emergency_reset              - Reset to safe default
```

**Audit Logs**:
```
/audit_logs                   - View audit dashboard
/export_audit_report          - Download as CSV
/audit_stats                  - Statistics dashboard
```

### API Endpoints

**Algorithms** (POST requests require admin JWT):
```
GET  /admin/algorithms/current      - Get current algorithm
POST /admin/algorithms/switch/{mode} - Switch algorithm mode
GET  /admin/algorithms/history      - Algorithm change history
```

**Audit Logs**:
```
GET /admin/audit/logs              - Recent logs
GET /admin/audit/logs/algorithm    - Algorithm changes
GET /admin/audit/logs/games        - Game events
POST /admin/audit/export           - Export as CSV
```

---

## Configuration Reference

### System Settings Table

Default values stored in `system_settings`:

| Key | Value | Category | Notes |
|-----|-------|----------|-------|
| `GAME_ALGORITHM_MODE` | `FIXED_HOUSE_EDGE` | game_algorithms | Can be `FIXED_HOUSE_EDGE` or `DYNAMIC` |
| `HOUSE_EDGE_PERCENTAGE` | `5.0` | game_algorithms | Percentage (0.1-50%) |
| `GAME_ALGORITHMS_ENABLED` | `true` | game_algorithms | Enable/disable feature |
| `MAX_PAYOUT_MULTIPLIER` | `36.0` | game_algorithms | Max payout (e.g., 36x) |
| `RTP_TARGET` | `95.0` | game_algorithms | Return To Player % |

### Environment Variables

```bash
# Bot configuration
TELEGRAM_BOT_TOKEN=your_token_here
ADMIN_CHAT_ID=your_admin_id

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/langsense

# Notification settings
NOTIFICATION_BATCH_SIZE=10
NOTIFICATION_BATCH_DELAY=5  # seconds
MAX_RETRIES=3

# Algorithm settings
DEFAULT_ALGORITHM=FIXED_HOUSE_EDGE
MAX_HOUSE_EDGE=15.0
MIN_HOUSE_EDGE=2.5
```

---

## Troubleshooting

### Algorithm switching not working

```
Error: "Algorithm switch failed: Validation error"

Solution:
1. Check system settings table exists
2. Verify DEFAULT_ALGORITHM is valid
3. Run: SELECT * FROM system_setting WHERE key like '%ALGORITHM%'
4. Try: /emergency_reset (will reset to FIXED_HOUSE_EDGE)
```

### Notifications not being delivered

```
Error: "Notification failed to deliver"

Solution:
1. Check agent has valid telegram_id in users table
2. Verify bot token is correct in environment
3. Check notification_delivery_handler retry count:
   SELECT * FROM outbox_recipient WHERE retry_count > 0
4. Monitor logs for rate limiting (429 errors)
```

### Tests failing

```bash
# Run with verbose output
pytest tests/test_regression.py -v -s

# Check for SQLite/database issues
sqlite3 :memory: ".quit"

# Verify all imports work
python -c "from algorithms.base_strategy import *; print('OK')"
```

---

## Performance Tuning

### For 1000+ concurrent sessions

**Algorithm optimization**:
```python
# In game_algorithm_manager.py, increase cache size
class GameAlgorithmManager:
    _instance_cache = {}  # Add caching for algorithm instances
    
    @classmethod
    def get_cached_algorithm(cls, name):
        if name not in cls._instance_cache:
            cls._instance_cache[name] = cls.get_algorithm(...)
        return cls._instance_cache[name]
```

**Notification batching**:
```python
# Process notifications in batches
NOTIFICATION_BATCH_SIZE = 50  # Increase from 10
NOTIFICATION_BATCH_DELAY = 2  # Decrease from 5
```

**Database indexing**:
```sql
-- Add indexes for audit queries
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_admin ON audit_log(admin_id);
CREATE INDEX idx_outbox_status ON outbox(status);
CREATE INDEX idx_outbox_recipient_status ON outbox_recipient(delivery_status);
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Algorithm Performance**
   - Distribution of WIN/LOSS outcomes (should match house edge)
   - Average payout per round
   - Algorithm switch frequency

2. **Notification System**
   - Delivery success rate (target >95%)
   - Retry counts (should be low)
   - Dead-letter queue size (should be <1% of total)

3. **System Health**
   - Average game outcome calculation time (<100ms)
   - Audit log insertion time (<50ms)
   - Algorithm manager cache hit rate (target >90%)

### Sample Monitoring Queries

```sql
-- Algorithm statistics
SELECT 
    algorithm_used,
    result,
    COUNT(*) as count,
    AVG(payout_multiplier) as avg_payout
FROM game_round
WHERE created_at > now() - interval '24 hours'
GROUP BY algorithm_used, result;

-- Notification delivery
SELECT 
    delivery_status,
    COUNT(*) as count
FROM outbox_recipient
GROUP BY delivery_status;

-- Audit trail
SELECT 
    action,
    COUNT(*) as count,
    MIN(created_at) as first_at,
    MAX(created_at) as last_at
FROM audit_log
WHERE created_at > now() - interval '24 hours'
GROUP BY action;
```

---

## Rollback Plan

If critical issues arise:

```bash
# 1. Emergency switch to conservative algorithm (no code changes)
# Admin runs: /emergency_reset

# 2. If that doesn't work, restart bot with fallback
# Bot automatically falls back on startup

# 3. If needed, restore from backup
# psql langsense < langsense.backup

# 4. Check logs for root cause
grep -i error logs/*.log | head -20
```

---

## Verification Checklist

After integration, verify:

- [ ] All 3 handler files exist and import correctly
- [ ] Algorithm manager initializes without errors
- [ ] `/algorithm_settings` command works in Telegram
- [ ] Audit logs appear when algorithm changes
- [ ] Tests pass: `pytest tests/ -v`
- [ ] System settings table populated
- [ ] No database constraint violations
- [ ] Bot doesn't crash on game outcomes
- [ ] Notifications queue without error
- [ ] Admin can view audit logs

---

## Support & Documentation

See detailed documentation:
- `PHASES_3_6_COMPLETE.md` - Implementation details
- `algorithms/base_strategy.py` - Algorithm interface docs
- `services/game_algorithm_manager.py` - Manager usage
- `handlers/admin_algorithm_settings.py` - Admin commands

For issues:
1. Check logs: `tail -f logs/*.log`
2. Run tests: `pytest tests/ -v`
3. Check database: `SELECT COUNT(*) FROM [table_name]`
4. Review commit history for changes
