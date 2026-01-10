# 🔧 PRODUCTION READINESS - CRITICAL FIXES & ACTION ITEMS

**Date**: January 5, 2026  
**Priority**: BLOCKING - Must complete before production deployment  
**Estimated Time**: 6-8 hours

---

## 🔴 CRITICAL FIXES (Do First)

### Fix #1: Health Check Endpoint SQL Syntax Error

**File**: `/workspaces/botv/api/main.py`  
**Line**: ~62  
**Severity**: CRITICAL  
**Impact**: Health checks fail, monitoring fails, deployment verification fails

**Current Code** (❌ BROKEN):
```python
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        async with async_session_maker() as session:
            await session.execute("SELECT 1")  # ❌ WRONG - String not executable
        
        return {
            "status": "healthy",
            "environment": ENVIRONMENT,
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")
```

**Fixed Code** (✅ CORRECT):
```python
from sqlalchemy import text

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    checks = {
        "status": "healthy",
        "environment": ENVIRONMENT,
        "version": "1.0.0",
        "checks": {}
    }
    
    # Test database connection
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))  # ✅ CORRECT - Using text()
        checks["checks"]["database"] = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        checks["checks"]["database"] = f"error: {str(e)}"
        checks["status"] = "degraded"
    
    # Test Redis connection
    try:
        import redis
        r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        checks["checks"]["redis"] = "connected"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        checks["checks"]["redis"] = f"error: {str(e)}"
        checks["status"] = "degraded"
    
    # Return appropriate status code
    status_code = 200 if checks["status"] == "healthy" else 503
    return JSONResponse(status_code=status_code, content=checks)
```

**Validation**:
```bash
# Test the health endpoint
curl -s http://localhost:8000/health | jq .

# Expected output:
{
  "status": "healthy",
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**Time to Fix**: **15 minutes**

---

### Fix #2: Implement Graceful Shutdown Handler

**File**: `/workspaces/botv/bot.py`  
**Severity**: CRITICAL  
**Impact**: Data loss on restart, incomplete transactions, unclean shutdown

**Current Code** (❌ INCOMPLETE):
```python
async def main(async_session):
    """Main bot function"""
    global bot_instance, session_maker, broadcast_service
    
    try:
        # ... bot initialization ...
        
        # Start polling
        logger.info("Starting bot polling...")
        await dp.start_polling(bot_instance)  # ❌ Never returns until crash
        
    except Exception as e:
        logger.error(f"Bot startup failed: {e}")
        raise
    finally:
        if bot_instance:
            await bot_instance.session.close()  # ❌ Only called on error
```

**Fixed Code** (✅ CORRECT):
```python
import signal
import asyncio

async def main(async_session):
    """Main bot function"""
    global bot_instance, session_maker, broadcast_service
    
    # Create shutdown event
    shutdown_event = asyncio.Event()
    
    def handle_signal(signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        asyncio.create_task(graceful_shutdown())
    
    async def graceful_shutdown():
        """Gracefully shutdown all services"""
        logger.info("Shutting down bot gracefully...")
        try:
            # Stop broadcast service
            if broadcast_service:
                logger.info("Stopping broadcast service...")
                await broadcast_service.shutdown()
            
            # Stop bot
            if bot_instance:
                logger.info("Closing bot session...")
                await bot_instance.session.close()
            
            # Signal shutdown complete
            shutdown_event.set()
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
            shutdown_event.set()
    
    try:
        # Register signal handlers
        signal.signal(signal.SIGTERM, handle_signal)
        signal.signal(signal.SIGINT, handle_signal)
        
        # ... rest of bot initialization ...
        
        # Start polling with cancellation support
        polling_task = asyncio.create_task(dp.start_polling(bot_instance))
        
        # Wait for shutdown signal
        await shutdown_event.wait()
        
        # Cancel polling gracefully
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            logger.info("Polling cancelled successfully")
        
        logger.info("Bot shutdown complete")
        
    except Exception as e:
        logger.error(f"Bot startup failed: {e}")
        raise
    finally:
        if bot_instance:
            await bot_instance.session.close()
```

**Testing**:
```bash
# Start the bot
python3 bot_main.py &
BOT_PID=$!

# Let it run for 5 seconds
sleep 5

# Send shutdown signal
kill -TERM $BOT_PID

# Bot should log "Shutting down gracefully..." and exit cleanly
wait $BOT_PID
echo "Bot exited with code: $?"
```

**Time to Fix**: **1 hour**

---

### Fix #3: Rotate All Production Secrets

**Severity**: CRITICAL  
**Impact**: Prevent unauthorized access to production database and bot  
**Time to Fix**: **2-3 hours**

**Step 1: Generate New Secrets**

```bash
# 1. New PostgreSQL Password
NEW_DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(16))")
echo "New DB Password: $NEW_DB_PASSWORD"

# 2. New Encryption Key
NEW_ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
echo "New Encryption Key: $NEW_ENCRYPTION_KEY"

# 3. New JWT Secret
NEW_JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "New JWT Secret: $NEW_JWT_SECRET"

# 4. New Redis Password
NEW_REDIS_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(16))")
echo "New Redis Password: $NEW_REDIS_PASSWORD"

# Save these in a secure location temporarily
```

**Step 2: Update PostgreSQL**

```bash
# On the production VPS (if using native PostgreSQL)
sudo -u postgres psql << EOF
-- Create new database user
CREATE USER dotv_prod WITH PASSWORD '$NEW_DB_PASSWORD';

-- Grant privileges
ALTER ROLE dotv_prod WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE dotv TO dotv_prod;

-- Or update existing user
ALTER USER dotv WITH PASSWORD '$NEW_DB_PASSWORD';
EOF
```

**Step 3: Request New Telegram Bot Token**

```
1. Message @BotFather on Telegram
2. Use `/mybots` to list current bots
3. Select the bot
4. Use `/revoke` to revoke current token
5. Create new bot (or request new token)
6. Copy new token
```

**Step 4: Update Configuration Files**

**Create new `.env.local` for testing** (DO NOT COMMIT):
```env
# .env.local - LOCAL TESTING ONLY
DATABASE_URL=postgresql+asyncpg://dotv_prod:$NEW_DB_PASSWORD@localhost:5432/dotv
BOT_TOKEN=$NEW_BOT_TOKEN
ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY
JWT_SECRET_KEY=$NEW_JWT_SECRET
REDIS_URL=redis://:$NEW_REDIS_PASSWORD@localhost:6379/0
ENVIRONMENT=production
```

**Update `.env.example`** (public template):
```env
# .env.example - DO NOT INCLUDE ACTUAL SECRETS
# Copy this to .env and fill in your actual values

DATABASE_URL=postgresql+asyncpg://USERNAME:PASSWORD@localhost:5432/dotv
BOT_TOKEN=your_bot_token_here
ENCRYPTION_KEY=your_encryption_key_here
JWT_SECRET_KEY=your_jwt_secret_here
REDIS_URL=redis://:PASSWORD@localhost:6379/0
ENVIRONMENT=production
```

**Step 5: Remove .env from Git History**

```bash
# 1. Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
git add .gitignore

# 2. Remove .env from git history (PERMANENT)
git filter-branch --tree-filter 'rm -f .env .env.local' -- --all

# 3. Verify removal
git log --all --format="%h %s" | grep -i env

# 4. Force push (WARNING: This rewrites history)
git push origin --force --all
git push origin --force --tags

# 5. Notify all developers to re-clone the repository
```

**Step 6: Set Up GitHub Secrets**

Go to: `https://github.com/promnes/botv/settings/secrets/actions`

Add the following secrets:
```
DATABASE_URL = postgresql+asyncpg://dotv_prod:PASSWORD@localhost:5432/dotv
BOT_TOKEN = 1234567:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
ENCRYPTION_KEY = base64_encoded_32_byte_key
JWT_SECRET_KEY = base64_encoded_32_byte_key
REDIS_URL = redis://:PASSWORD@localhost:6379/0
ENVIRONMENT = production
```

**Step 7: Use in CI/CD Workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      BOT_TOKEN: ${{ secrets.BOT_TOKEN }}
      ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
      JWT_SECRET_KEY: ${{ secrets.JWT_SECRET_KEY }}
      REDIS_URL: ${{ secrets.REDIS_URL }}
      ENVIRONMENT: ${{ secrets.ENVIRONMENT }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          # Deploy commands here
          docker-compose -f docker-compose.local-db.yml up -d
```

**Validation**:
```bash
# After rotation, verify no secrets in git
git log --all -S "8549135277" --oneline  # Old bot token
# Should return empty

git log --all -S "m784951m" --oneline  # Old DB password
# Should return empty
```

**Time to Fix**: **2-3 hours**

---

## 🟡 HIGH PRIORITY FIXES (Do Next)

### Fix #4: Add Redis Health Check to Endpoint

**File**: `/workspaces/botv/api/main.py`  
**Severity**: HIGH  
**Impact**: Cannot detect Redis failures in production

**Addition to health check** (already included in Fix #1):
```python
# Test Redis connection
try:
    import redis
    r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    r.ping()
    checks["checks"]["redis"] = "connected"
except Exception as e:
    logger.error(f"Redis health check failed: {e}")
    checks["checks"]["redis"] = f"error: {str(e)}"
    checks["status"] = "degraded"
```

**Time to Fix**: **15 minutes** (included in Fix #1)

---

### Fix #5: Implement CI/CD Pipeline

**File**: `.github/workflows/tests.yml` (NEW FILE)  
**Severity**: HIGH  
**Impact**: Automate testing, prevent regressions

**Create File**: `.github/workflows/tests.yml`

```yaml
name: Tests & Code Quality

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Lint with flake8
        run: |
          flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
          flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
      
      - name: Format check with black
        run: black --check .
      
      - name: Security scan with bandit
        run: bandit -r . -ll
        continue-on-error: true
      
      - name: Test with pytest
        env:
          DATABASE_URL: postgresql+asyncpg://test_user:test_password@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/0
          BOT_TOKEN: test_token_1234567:ABC-DEF
          ENCRYPTION_KEY: test_encryption_key_32_bytes_____
          JWT_SECRET_KEY: test_jwt_secret_key_32_bytes_____
          ADMIN_USER_IDS: 123456789
          ENVIRONMENT: testing
        run: |
          pytest tests/ -v --cov=. --cov-report=xml --cov-report=term
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: true
```

**Time to Fix**: **1-2 hours**

---

### Fix #6: Add Request Size Limits

**File**: `/workspaces/botv/api/main.py`  
**Severity**: HIGH  
**Impact**: Prevent DoS attacks via large payloads

**Addition after FastAPI initialization**:
```python
# Add after app = FastAPI(...)
from fastapi import FastAPI

# Limit request body size to 10MB
app = FastAPI(
    title="LangSense API",
    description="REST API for LangSense Mobile Application",
    version="1.0.0",
    lifespan=lifespan
)

# Add request size limit middleware
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse

class RequestSizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB
        super().__init__(app)
        self.max_size = max_size
    
    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" or request.method == "PUT" or request.method == "PATCH":
            if "content-length" in request.headers:
                content_length = int(request.headers["content-length"])
                if content_length > self.max_size:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Payload too large"},
                    )
        return await call_next(request)

app.add_middleware(RequestSizeMiddleware, max_size=10 * 1024 * 1024)
```

**Time to Fix**: **30 minutes**

---

## 📋 VERIFICATION CHECKLIST

After applying all fixes, verify:

### Database & Redis
- [ ] PostgreSQL running with new credentials
- [ ] Redis running with new password
- [ ] Connection strings updated in all config files
- [ ] Database migrations completed

### Application
- [ ] Health check endpoint returns 200 OK
- [ ] Health check includes database and redis status
- [ ] Bot can connect and get bot info
- [ ] API starts without errors

### Security
- [ ] No secrets in git history
- [ ] `.env` not tracked in git
- [ ] GitHub Secrets configured
- [ ] All new encryption/JWT keys generated

### Testing
- [ ] All tests pass: `pytest tests/ -v`
- [ ] Coverage >80%: `pytest --cov=. --cov-report=term`
- [ ] No security issues: `bandit -r .`
- [ ] Code formatted: `black .`
- [ ] Imports sorted: `isort .`

### Deployment
- [ ] Docker images build successfully
- [ ] Docker Compose up/down works
- [ ] Health checks pass
- [ ] All services start correctly
- [ ] Logs are clean (no errors)

### Monitoring (First 30 Minutes)
- [ ] API responds to requests
- [ ] Bot processes messages
- [ ] Database queries execute
- [ ] Redis cache works
- [ ] No memory leaks
- [ ] CPU usage reasonable
- [ ] Network traffic normal

---

## QUICK FIX SCRIPT

You can run this script to apply some fixes automatically:

```bash
#!/bin/bash
set -e

echo "🔧 Applying Production Fixes..."

# Fix 1: Create pytest configuration
echo "[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    asyncio: marks tests as async (deselect with '-m \"not asyncio\"')
" > pytest.ini
echo "✅ pytest.ini created"

# Fix 2: Update .gitignore
if ! grep -q "^\.env$" .gitignore; then
  echo ".env" >> .gitignore
  echo ".env.local" >> .gitignore
  echo "✅ .gitignore updated"
fi

# Fix 3: Generate new secrets (for local testing)
ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

cat > .env.example << 'EOF'
# Copy this to .env and update with actual production secrets
DATABASE_URL=postgresql+asyncpg://dotv:password@localhost:5432/dotv
BOT_TOKEN=your_bot_token_here
ENCRYPTION_KEY=your_encryption_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=production
ADMIN_USER_IDS=123456789
EOF
echo "✅ .env.example created"

# Fix 4: Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/tests.yml << 'EOF'
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest tests/ -v --cov
EOF
echo "✅ GitHub Actions workflow created"

echo ""
echo "✅ All automatic fixes applied!"
echo ""
echo "Next steps:"
echo "1. Manually fix the health check endpoint (api/main.py)"
echo "2. Manually implement graceful shutdown (bot.py)"
echo "3. Rotate all production secrets"
echo "4. Run: pytest tests/ -v"
echo "5. Run: git add -A && git commit -m 'fix: production readiness improvements'"
```

---

## SUMMARY

**Total Fixes Required**: 6 (3 Critical + 3 High Priority)  
**Estimated Time**: 6-8 hours  
**Blocking Fixes**: 3 (Secrets, Health Check, Shutdown)  
**Nice to Have**: 3 (CI/CD, Request Limits, Redis Check)  

**After All Fixes**:
- ✅ Application ready for production
- ✅ All security issues resolved
- ✅ Health checks working
- ✅ Graceful shutdown implemented
- ✅ CI/CD pipeline automated
- ✅ Request limits enforced
- ✅ Tests passing
- ✅ Documentation complete

---

**Generated**: January 5, 2026  
**Valid For**: 30 days  
**Next Review**: After fixes applied and staging deployment

