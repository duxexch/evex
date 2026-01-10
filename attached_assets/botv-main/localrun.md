# 🔍 **LOCAL DEPLOYMENT ANALYSIS MODE**

## **PROJECT OVERVIEW**

**Project Type:** Hybrid System (Telegram Bot + FastAPI REST API + Web Dashboard)  
**Structure:** Monorepo with integrated components  
**Language:** Python 3.11  
**Key Components:**
- 🤖 **Telegram Bot** (Aiogram v3) - Message handling, user interactions
- 🌐 **FastAPI API** - REST endpoints, admin panel backend
- 📊 **Web Dashboard** (React/Next.js) - Admin control panel
- 📱 **Mobile App** (React Native/Expo) - Optional mobile client
- 🎮 **Gaming System** - Penalty Shootout game integrated

---

## 📋 **ENVIRONMENT & REQUIREMENTS**

### **System Requirements**
```
OS:           Linux, macOS, or Windows (with WSL2 recommended)
Python:       3.11+ (required)
Node.js:      18+ (optional, for web dashboard)
Docker:       Recommended (any recent version)
Docker Compose: 1.29+
```

### **Core Dependencies**
```
FastAPI          ==0.115.7   (REST API framework)
Aiogram          ==3.16.0    (Telegram bot framework)
SQLAlchemy       ==2.0.37    (Async ORM)
Pydantic         ==2.10.6    (Data validation)
Uvicorn          ==0.34.0    (ASGI server)
PostgreSQL       >=13        (Production database)
Redis            >=6         (Cache & queue)
Alembic          ==1.13.3    (Database migrations)
```

### **Required Environment Variables**

**CRITICAL (Must be set):**
```env
BOT_TOKEN=<your-telegram-bot-token>              # From BotFather
ADMIN_USER_IDS=<comma-separated-user-ids>       # Your Telegram user ID(s)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db  # Production
ENCRYPTION_KEY=<32-char-random-string>          # For sensitive data
JWT_SECRET_KEY=<32-char-random-string>          # For API auth
```

**IMPORTANT (Should be configured):**
```env
ENVIRONMENT=production                          # production|development
LOG_LEVEL=info                                  # debug|info|warning|error
FORCE_HTTPS=true                                # Require HTTPS
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com
```

**OPTIONAL (Have sensible defaults):**
```env
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=3600
CORS_ORIGINS=https://yourdomain.com
PORT=8000
API_PORT=8000
```

**Generate Strong Keys:**
```bash
# For ENCRYPTION_KEY and JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 📁 **PROJECT STRUCTURE**

```
botv/ (root)
├── bot_main.py              ⭐ MAIN ENTRY: Telegram bot polling
├── main.py                  ⭐ MAIN ENTRY: Database init + bot start
├── config.py                Configuration loader (reads .env)
├── requirements.txt         Python dependencies
├── docker-compose.yml       Full stack (bot + api + db + redis)
├── Dockerfile               Bot image
├── Dockerfile.api           API image
├── Dockerfile.prod          Production image
│
├── api/                     FastAPI REST API
│   ├── main.py             API entry point
│   ├── routes/             Endpoints (games, users, transactions, etc.)
│   └── v1/                 API versioning
│
├── handlers/                Telegram bot handlers
│   ├── commands.py         /start, /help, etc.
│   ├── balance.py          Balance & wallet commands
│   ├── deposit.py          Deposit flow
│   ├── penalty_shootout.py Game handler
│   ├── middleware.py       Auth, logging, i18n
│   └── database.py         Session management
│
├── models/                  Database models
│   ├── __init__.py
│   ├── penalty_shootout.py Game models
│   └── (other models)
│
├── services/                Business logic
│   ├── games/
│   │   └── penalty_shootout_service.py
│   └── control_panel/
│
├── migrations/              (if using Alembic)
│   └── versions/
│
├── tests/                   Test suite
│   ├── test_penalty_shootout.py
│   └── test_*.py
│
├── web/                     React/Next.js dashboard (optional)
│   ├── package.json
│   └── src/
│
├── mobile-app/              React Native app (optional)
│   ├── package.json
│   └── src/
│
├── .env                     ⭐ LOCAL: Environment variables (create this!)
├── .env.example            Template for .env
├── .env.production         Production template
│
└── alembic/                Database migrations
    └── env.py
```

---

## 🚀 **LOCAL SETUP STEPS**

### **STEP 1: Clone & Navigate**
```bash
git clone https://github.com/promnes/botv.git
cd botv
```

### **STEP 2: Create Python Virtual Environment**
```bash
# Create venv
python3.11 -m venv venv

# Activate venv
# On Linux/macOS:
source venv/bin/activate

# On Windows (PowerShell):
venv\Scripts\Activate.ps1

# On Windows (cmd):
venv\Scripts\activate.bat
```

### **STEP 3: Install Dependencies**
```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### **STEP 4: Create `.env` File**
```bash
# Copy template
cp .env.example .env

# Edit .env with your values
# CRITICAL: Set these with REAL values!
nano .env  # or use your editor
```

**Minimum viable `.env`:**
```env
BOT_TOKEN=YOUR_ACTUAL_BOT_TOKEN
ADMIN_USER_IDS=YOUR_TELEGRAM_USER_ID
DATABASE_URL=sqlite+aiosqlite:///./langsense.db
ENCRYPTION_KEY=generated-key-here
JWT_SECRET_KEY=generated-key-here
ENVIRONMENT=development
LOG_LEVEL=info
```

### **STEP 5: Initialize Database**
```bash
# Option A: Using Python script
python main.py

# Option B: Manual SQLite
# Database creates automatically on first run

# Option C: PostgreSQL (if configured)
# Make sure PostgreSQL is running
psql -U postgres -c "CREATE DATABASE langsense;"
```

### **STEP 6: Run Tests (Optional but Recommended)**
```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=services --cov=models --cov=handlers

# Run specific test
pytest tests/test_penalty_shootout.py -v
```

---

## ▶️ **RUNNING LOCALLY - PRODUCTION MODE**

### **OPTION 1: Bot Only (Minimal - 80MB RAM)**
```bash
# Activate venv first
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Start bot
python bot_main.py

# Expected output:
# 2026-01-04 10:30:15 - bot - INFO - Starting Telegram bot polling...
```

**Verification:**
- Open Telegram and find your bot
- Send `/start` command
- Should receive greeting message

---

### **OPTION 2: Full Stack with Docker (Recommended)**

#### **Prerequisites:**
```bash
# Install Docker & Docker Compose (if not already installed)
docker --version
docker-compose --version
```

#### **Setup & Run:**
```bash
# Create .env from template
cp .env.example .env

# Edit .env with production values
nano .env

# Build all images (first time only)
docker-compose build

# Start all services (daemon mode)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Expected services running:
# - langsense-postgres (Database on port 5432)
# - langsense-redis (Cache on port 6379)
# - langsense-api (API on port 8000)
# - langsense-bot (Telegram bot)
```

**Verification:**
```bash
# Check API health
curl http://localhost:8000/health
# Expected: {"status": "healthy", ...}

# Check bot logs
docker-compose logs langsense-bot | tail -20

# Access database
docker-compose exec postgres psql -U langsense -d langsense_db
```

---

### **OPTION 3: Python + External Database**

**If you have PostgreSQL/Redis running externally:**

```bash
# Update .env with your database credentials
DATABASE_URL=postgresql+asyncpg://user:password@your-host:5432/langsense

# Activate venv
source venv/bin/activate

# Start bot
python bot_main.py

# Start API (in another terminal)
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### **OPTION 4: API Only (FastAPI)**

```bash
source venv/bin/activate

# Start API server (production)
uvicorn api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --loop uvloop

# OR: Development mode (with auto-reload)
uvicorn api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload

# Expected output:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete
```

**Verification:**
```bash
curl http://localhost:8000/docs  # Swagger UI
curl http://localhost:8000/health
```

---

## ✅ **VERIFICATION & HEALTH CHECKS**

### **Bot Running Check**
```bash
# Telegram: Send /start command
# Expected: Bot responds with greeting

# Or check logs
docker-compose logs langsense-bot | grep "Starting\|polling"
```

### **API Running Check**
```bash
# Terminal:
curl http://localhost:8000/health

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "timestamp": "2026-01-04T10:30:00Z"
# }
```

### **Database Connected Check**
```bash
# PostgreSQL
docker-compose exec postgres pg_isready -U langsense

# SQLite
ls -la langsense.db

# Expected: Database file exists
```

### **Redis Connected Check**
```bash
docker-compose exec redis redis-cli ping
# Expected: PONG
```

---

## 🔧 **TROUBLESHOOTING - COMMON ISSUES**

### **❌ Error: "BOT_TOKEN must be set"**
```
Solution: Check .env file
  1. cat .env | grep BOT_TOKEN
  2. Ensure BOT_TOKEN=your_actual_token (no quotes, no whitespace)
  3. Reload: source venv/bin/activate
```

### **❌ Error: "No module named 'aiogram'"**
```
Solution: Install dependencies
  1. source venv/bin/activate
  2. pip install -r requirements.txt
  3. Verify: python -c "import aiogram; print(aiogram.__version__)"
```

### **❌ Error: "Connection refused" for PostgreSQL**
```
Solution: Start database
  1. docker-compose up -d postgres
  2. Wait 10 seconds for startup
  3. Test: docker-compose exec postgres pg_isready
```

### **❌ Error: "Port 8000 already in use"**
```
Solution: Use different port or kill process
  Option A: USE different port
    uvicorn api.main:app --port 8001
  
  Option B: Kill process using port
    # Linux/macOS:
    lsof -ti:8000 | xargs kill -9
    
    # Windows:
    netstat -ano | findstr :8000
    taskkill /PID <PID> /F
```

### **❌ Error: "ENCRYPTION_KEY must be set"**
```
Solution: Generate & set key
  1. python -c "import secrets; print(secrets.token_urlsafe(32))"
  2. Copy output to .env: ENCRYPTION_KEY=<output>
  3. Restart bot
```

### **❌ Bot not receiving messages**
```
Troubleshooting:
  1. Verify BOT_TOKEN is correct
  2. Check telegram bot is polling: grep "polling" logs
  3. Ensure ADMIN_USER_IDS includes your user ID
  4. Test: Send /ping command (if handler exists)
```

---

## 📊 **PRODUCTION MODE SETTINGS**

### **For Production Deployment:**

**Update `.env`:**
```env
ENVIRONMENT=production
LOG_LEVEL=warning          # Reduce noise in logs
FORCE_HTTPS=true           # Require HTTPS
DEBUG=false                # Disable debug mode
ALLOW_ORIGINS=yourdomain.com,api.yourdomain.com

# Database: Use PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:STRONG_PASSWORD@db-host:5432/langsense

# Cache: Use Redis
REDIS_URL=redis://:STRONG_PASSWORD@redis-host:6379/0

# Security: Use strong random keys
ENCRYPTION_KEY=<strong-32-char-key>
JWT_SECRET_KEY=<strong-32-char-key>
```

**Run with proper workers:**
```bash
# Uvicorn with multiple workers
uvicorn api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --loop uvloop \
  --no-access-log

# Or with Gunicorn (recommended)
gunicorn api.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

**Docker Production:**
```bash
docker-compose -f docker-compose.yml up -d
```

---

## 📈 **RESOURCE USAGE**

### **Expected Resources (Running Locally)**

| Component | RAM | CPU | Notes |
|-----------|-----|-----|-------|
| **Bot Only** | 80 MB | 2-5% | Minimal |
| **Bot + API** | 200 MB | 5-15% | Standard |
| **Full Stack (Docker)** | 500-800 MB | 10-30% | With DB + Cache |
| **PostgreSQL** | 150-300 MB | 5-10% | Production DB |
| **Redis** | 50 MB | 1-3% | Cache server |

---

## 📝 **QUICK REFERENCE COMMANDS**

```bash
# Setup
git clone https://github.com/promnes/botv.git && cd botv
python3.11 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values

# Run Bot
python bot_main.py

# Run API
uvicorn api.main:app --reload

# Run Full Stack (Docker)
docker-compose up -d

# View Logs
docker-compose logs -f

# Run Tests
pytest tests/ -v

# Stop Everything
docker-compose down
```

---

## 🎯 **ENTRY POINTS**

| Purpose | File | Command |
|---------|------|---------|
| **Telegram Bot** | `bot_main.py` | `python bot_main.py` |
| **Bot + Database** | `main.py` | `python main.py` |
| **FastAPI REST** | `api/main.py` | `uvicorn api.main:app --reload` |
| **Full Stack** | `docker-compose.yml` | `docker-compose up -d` |
| **Tests** | `tests/` | `pytest tests/ -v` |

---

## 🔐 **SECURITY CHECKLIST FOR PRODUCTION**

- [ ] `BOT_TOKEN` - Real bot token from BotFather
- [ ] `ADMIN_USER_IDS` - Only authorized admins
- [ ] `ENCRYPTION_KEY` - 32-char random string
- [ ] `JWT_SECRET_KEY` - 32-char random string (different from ENCRYPTION_KEY)
- [ ] `FORCE_HTTPS=true` - Require HTTPS
- [ ] `ALLOWED_HOSTS` - Only your domains
- [ ] Database credentials - Complex passwords
- [ ] Redis password - Complex password
- [ ] `.env` file - NEVER committed to git
- [ ] Firewall - Restrict port access
- [ ] SSL/TLS certificates - Valid HTTPS

---

## 📚 **ADDITIONAL RESOURCES**

- **Config Details:** [config.py](config.py)
- **Game Documentation:** [PENALTY_SHOOTOUT_COMPLETE_GUIDE.md](PENALTY_SHOOTOUT_COMPLETE_GUIDE.md)
- **API Documentation:** [PENALTY_SHOOTOUT_API_EXAMPLES.md](PENALTY_SHOOTOUT_API_EXAMPLES.md)
- **Deployment Guide:** [PENALTY_SHOOTOUT_DEPLOYMENT.md](PENALTY_SHOOTOUT_DEPLOYMENT.md)

---

**✅ This is a COMPLETE LOCAL DEPLOYMENT ANALYSIS WITHOUT CODE CHANGES**

All instructions are ready-to-use. No modifications needed to source code. 🚀
