# 🚀 Penalty Shootout Game - Production Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Code Quality
- [ ] Run tests: `pytest tests/test_penalty_shootout.py -v --cov`
- [ ] All tests pass (15+ test cases)
- [ ] Code coverage > 90%
- [ ] No syntax errors: `python -m py_compile models/penalty_shootout.py`
- [ ] Linting: `flake8 models/ services/ api/ handlers/` (optional)
- [ ] Type checking: `mypy services/games/penalty_shootout_service.py` (optional)

### ✅ Security Review
- [ ] All financial transactions create records
- [ ] HMAC signatures verified on all balance changes
- [ ] JWT tokens expire correctly (2 hours)
- [ ] Session tokens validated before shot
- [ ] SQL injection prevention verified (using SQLAlchemy ORM)
- [ ] Rate limiting configured (if applicable)
- [ ] Admin endpoints protected with authentication

### ✅ Database
- [ ] PostgreSQL 13+ installed
- [ ] Database created: `createdb langsense_db`
- [ ] Migrations applied: `alembic upgrade head`
- [ ] Tables created: `penalty_shootout_games`, `penalty_shootout_sessions`, `penalty_shootout_rounds`
- [ ] Indexes created for performance
- [ ] Backup strategy defined

### ✅ Environment Variables
```bash
# Copy .env.example to .env
cp .env.example .env

# Required variables
DATABASE_URL=postgresql+asyncpg://user:password@localhost/langsense_db
BOT_TOKEN=your_telegram_bot_token
ADMIN_USER_IDS=123456789
ENCRYPTION_KEY=your-32-character-encryption-key
JWT_SECRET_KEY=your-jwt-secret-key

# Game Configuration (optional, has defaults)
PENALTY_GAME_MIN_BET=1.0
PENALTY_GAME_MAX_BET=1000.0
KEEPER_SAVE_PROBABILITY=30.0
GOAL_MULTIPLIER=2.0
KEEPER_DIRECTION_PREDICTION=50.0
```

### ✅ Dependencies
```bash
# Install all dependencies
pip install -r requirements.txt

# Key dependencies for Penalty Shootout
pip install aiogram>=3.0.0
pip install fastapi>=0.104.0
pip install sqlalchemy>=2.0.0
pip install python-jose[cryptography]>=0.8.0
pip install PyJWT>=2.8.0
```

---

## 🐳 Docker Deployment

### Docker Image Build

#### Option 1: Using Dockerfile
```bash
# Build image
docker build -t langsense-bot:latest -f Dockerfile .

# Build with specific tag
docker build -t langsense-bot:1.0.0 -f Dockerfile .

# List images
docker images | grep langsense
```

#### Option 2: Using docker-compose
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop services
docker-compose down
```

### Docker Compose Configuration
```yaml
version: '3.8'

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql+asyncpg://bot:password@db:5432/langsense
      - BOT_TOKEN=${BOT_TOKEN}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    depends_on:
      - db
    restart: always
    volumes:
      - ./logs:/app/logs
      - ./game_uploads:/app/game_uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=langsense
      - POSTGRES_USER=bot
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      - DATABASE_URL=postgresql+asyncpg://bot:password@db:5432/langsense
    ports:
      - "8000:8000"
    depends_on:
      - db
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
```

---

## 🏥 Health Checks

### API Health Endpoint
```python
@app.get("/health")
async def health_check():
    try:
        # Test database connection
        async with get_db() as session:
            await session.execute("SELECT 1")
        
        # Get game stats
        games = await get_active_games_count()
        sessions = await get_active_sessions_count()
        
        return {
            "status": "healthy",
            "database": "connected",
            "games_available": games,
            "active_sessions": sessions,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }, 503
```

### Docker Health Check
```bash
# Manually test health
curl http://localhost:8000/health

# Expected response (200 OK)
{
  "status": "healthy",
  "database": "connected",
  "games_available": 1,
  "active_sessions": 5
}
```

---

## 📊 Monitoring & Logging

### Structured Logging Configuration
```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)

# Configure logging
handler = logging.FileHandler("logs/penalty_shootout.log")
handler.setFormatter(JSONFormatter())
logger = logging.getLogger("penalty_shootout")
logger.addHandler(handler)
```

### Key Metrics to Monitor
```python
# Game metrics
- Total games created
- Active games count
- Game icon uploads (file sizes)

# Session metrics
- Active sessions count
- Sessions completed (daily/weekly)
- Average session duration
- Average rounds per session

# Financial metrics
- Total bets amount (daily/weekly)
- Total winnings amount
- House profit (bets - winnings)
- Average bet size
- Min/max bet used

# Performance metrics
- Shot endpoint response time (< 500ms)
- Take shot errors rate (< 1%)
- Database query time (< 100ms)
- API availability (> 99.5%)

# Player metrics
- Unique players (daily/weekly)
- Goals scored rate (should be ~70%)
- Player retention
- Average profit/loss per player
```

### Prometheus Metrics Example
```python
from prometheus_client import Counter, Histogram, Gauge

# Counters
shots_taken_counter = Counter(
    'penalty_shootout_shots_taken_total',
    'Total penalty shots taken',
    ['outcome']  # goal, saved, miss
)

bets_counter = Counter(
    'penalty_shootout_bets_total',
    'Total bets amount',
    ['currency']
)

# Histograms
shot_duration = Histogram(
    'penalty_shootout_shot_duration_seconds',
    'Time to complete a shot'
)

bet_amount = Histogram(
    'penalty_shootout_bet_amount',
    'Bet amount distribution'
)

# Gauges
active_sessions = Gauge(
    'penalty_shootout_active_sessions',
    'Number of active game sessions'
)

# Usage
shots_taken_counter.labels(outcome='goal').inc()
shot_duration.observe(0.42)  # 420ms
active_sessions.set(current_sessions)
```

---

## 🔄 Backup & Recovery Strategy

### Database Backups
```bash
# Daily backup
pg_dump langsense_db > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump langsense_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Backup with Docker
docker exec postgres_container pg_dump -U bot langsense_db > backup.sql

# Restore from backup
psql langsense_db < backup_2026-01-04.sql

# Restore with Docker
docker exec -i postgres_container psql -U bot langsense_db < backup.sql
```

### Backup Automation (cron)
```bash
# Add to crontab: crontab -e
0 2 * * * pg_dump langsense_db | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Keep last 30 days
0 3 * * * find /backups -name "db_*.sql.gz" -mtime +30 -delete
```

### Game Upload Backups
```bash
# Backup game icons/uploads
tar czf game_uploads_$(date +%Y%m%d).tar.gz /app/game_uploads/

# Clean up old backups
find /backups -name "game_uploads_*.tar.gz" -mtime +30 -delete
```

---

## 🚨 Troubleshooting

### Issue: "Error creating penalty_shootout_games table"
```
Solution:
1. Check DATABASE_URL is correct
2. Ensure PostgreSQL is running
3. Run migrations: alembic upgrade head
4. Check user has create table permissions
```

### Issue: "Insufficient Balance Error"
```
Solution:
1. Verify user has balance in wallet
2. Check min_bet_amount is less than balance
3. Verify transaction wasn't already deducted
```

### Issue: "Session Expired"
```
Solution:
1. Check JWT_SECRET_KEY is same in all instances
2. Verify server time is synchronized
3. Create new session instead of using old one
```

### Issue: "High Memory Usage"
```
Solution:
1. Check for memory leaks in session handling
2. Limit concurrent sessions
3. Implement session cleanup (expire after 2 hours)
4. Monitor with: ps aux | grep python
```

### Issue: "Database Connection Pool Exhausted"
```
Solution:
1. Increase pool size in DATABASE_URL
2. Check for connection leaks (sessions not closed)
3. Monitor with: SELECT count(*) FROM pg_stat_activity
```

---

## 📈 Scaling Considerations

### Horizontal Scaling
```
Load Balancer
    ↓
├─ Bot Instance 1
├─ Bot Instance 2
├─ Bot Instance 3
    ↓
PostgreSQL Primary
    ↓
PostgreSQL Replica (read-only)
```

### Cache Strategy (Redis)
```python
# Cache active games (5 minute TTL)
games = await redis.get("penalty_shootout:games")
if not games:
    games = await db.query(PenaltyShootoutGame)
    await redis.set("penalty_shootout:games", games, ex=300)

# Cache game statistics (15 minute TTL)
stats = await redis.get(f"penalty_shootout:stats:{game_id}")
if not stats:
    stats = await calculate_game_stats(game_id)
    await redis.set(f"penalty_shootout:stats:{game_id}", stats, ex=900)
```

---

## 🔒 Security Hardening

### Network Security
```bash
# Firewall rules
ufw allow 22/tcp       # SSH
ufw allow 80/tcp       # HTTP
ufw allow 443/tcp      # HTTPS
ufw allow 5432/tcp     # PostgreSQL (internal only)
```

### Database Security
```bash
# Use non-root user
createuser bot -P

# Limited permissions
GRANT CONNECT ON DATABASE langsense_db TO bot;
GRANT USAGE ON SCHEMA public TO bot;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bot;
```

### Environment Security
```bash
# Don't commit .env file
echo ".env" >> .gitignore

# Use environment variables (not hardcoded)
export BOT_TOKEN="your_token_here"
export ENCRYPTION_KEY="your_32_char_key"
export JWT_SECRET_KEY="your_secret_key"

# Verify no secrets in code
grep -r "BOT_TOKEN" . --exclude-dir=.git  # Should be empty
grep -r "password" . --exclude-dir=.git   # Should be empty
```

---

## 🧪 Pre-Production Testing

### Manual Testing Checklist
- [ ] Create test user with 1000 balance
- [ ] Create test game via admin API
- [ ] Play one round: bet → shoot → result
- [ ] Verify balance deducted after bet
- [ ] Verify balance updated after result
- [ ] Play 3-round game, complete all rounds
- [ ] Check transaction logs in database
- [ ] Verify all transactions signed correctly
- [ ] Test insufficient balance error
- [ ] Test invalid direction error

### Load Testing
```bash
# Using Apache Bench
ab -n 1000 -c 100 "http://localhost:8000/api/v1/penalty-shootout/games"

# Using locust
pip install locust

# locustfile.py
from locust import HttpUser, task, between

class PenaltyShootoutUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def create_session(self):
        self.client.post("/api/v1/penalty-shootout/sessions", json={
            "game_id": 1,
            "num_rounds": 3
        })
    
    @task
    def take_shot(self):
        self.client.post("/api/v1/penalty-shootout/sessions/abc/shoot", json={
            "bet_amount": 50.0,
            "shot_direction": "left"
        })

# Run: locust -f locustfile.py
```

---

## 📝 Documentation Checklist

- [ ] API documentation (Swagger)
- [ ] Deployment guide (this file)
- [ ] Quick reference guide (PENALTY_SHOOTOUT_QUICKREF.md)
- [ ] Complete implementation guide (PENALTY_SHOOTOUT_COMPLETE_GUIDE.md)
- [ ] README updated with game info
- [ ] Code comments and docstrings
- [ ] Error code documentation
- [ ] Admin panel documentation (if applicable)

---

## ✅ Final Deployment Checklist

```bash
# 1. Run tests
pytest tests/test_penalty_shootout.py -v --cov
# Expected: All tests pass, coverage > 90%

# 2. Build Docker image
docker build -t langsense-bot:latest .
# Expected: Image built successfully

# 3. Start services
docker-compose up -d
# Expected: All containers running

# 4. Check health
curl http://localhost:8000/health
# Expected: {"status": "healthy", ...}

# 5. Create test game
curl -X POST http://localhost:8000/api/v1/penalty-shootout/games \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Game", "min_bet": 1, "max_bet": 100}'
# Expected: 201 Created

# 6. Play test game
# Via Telegram: /penalty → Select game → Choose rounds → Play

# 7. Monitor logs
docker-compose logs -f bot
# Expected: No errors, only info/debug logs

# 8. Database integrity check
docker exec postgres_container psql -U bot -d langsense_db -c \
  "SELECT COUNT(*) FROM penalty_shootout_games;"
# Expected: 1 (or more)
```

---

## 📞 Support & Escalation

### Issues Contact
- **Database Issues**: Check logs, verify PostgreSQL running
- **Bot Not Responding**: Check BOT_TOKEN, verify Telegram API
- **Payment Issues**: Verify ENCRYPTION_KEY, check balance

### Performance Issues
- **Slow responses**: Check database query time
- **High memory**: Monitor session connections
- **Failed transactions**: Check database backups

---

**Deployment Status:** ✅ Ready for Production

**Version:** 1.0.0

**Last Updated:** 2026-01-04

**Estimated Downtime for First Deployment:** 0-5 minutes
