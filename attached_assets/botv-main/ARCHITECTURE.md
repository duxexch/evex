# TaskFlowAI Bot Architecture

**Last Updated:** January 2, 2026  
**Status:** ✅ PRODUCTION ACTIVE

---

## 🎯 Official Entry Point

**PRIMARY:** `main.py` ✅
- **Framework:** aiogram v3
- **Database:** SQLAlchemy 2.0 (AsyncSession)
- **Status:** ACTIVE (PID 32741)
- **Bot:** @Gkdkkdkfbot (Testerr)

### Startup Command:
```bash
cd /workspaces/TaskFlowAI-
source venv/bin/activate
python main.py
```

---

## 📂 Project Structure

```
TaskFlowAI-/
├── main.py                    # ✅ PRIMARY ENTRY POINT
├── bot.py                     # Bot initialization & router registration
├── config.py                  # Configuration & environment variables
├── models.py                  # SQLAlchemy data models
├── requirements.txt           # Python dependencies
│
├── handlers/                  # Telegram command handlers
│   ├── __init__.py
│   ├── admin.py              # Admin panel commands
│   ├── start.py              # /start & user registration
│   ├── user_settings.py      # User preferences
│   ├── broadcast.py          # Broadcast messaging
│   ├── announcements.py      # Announcements
│   ├── flying_plane_handler.py  # 🎮 Flying Plane game
│   └── legacy_handlers.py    # 📦 Legacy feature handlers (NEW)
│
├── services/                  # Business logic services
│   ├── broadcast_service.py  # Broadcast queue worker
│   ├── customer_id.py        # Customer ID generation
│   ├── i18n.py               # Internationalization
│   ├── legacy_service.py     # 📦 Legacy CSV-based features (NEW)
│   └── domain_services/      # Phase 1 Modular Services
│       ├── csv_manager.py    # ✅ CSV file operations
│       └── games_service.py  # ✅ Games logic & anti-cheat
│
├── utils/                     # Utility functions
│   ├── auth.py               # Authentication decorators
│   └── keyboards.py          # Telegram keyboard builders
│
├── translations/              # i18n translation files
│   ├── ar.json               # Arabic
│   └── en.json               # English
│
├── data/                      # CSV data storage
│   ├── games.csv             # Game definitions
│   ├── game_sessions.csv     # Game session records
│   ├── flying_plane_scores.csv  # Flying Plane scores
│   ├── game_logs.csv         # Anti-cheat logs
│   └── wallets.csv           # User wallets (test)
│
└── comprehensive_bot.py       # ⚠️ LEGACY (5,818 lines)
                               # DO NOT USE - Archived code
```

---

## 🔄 Execution Flow

### 1. Startup (main.py)
```python
asyncio.run(main())
  ↓
Initialize database (SQLAlchemy async engine)
  ↓
Create async_sessionmaker
  ↓
Call bot.main(async_session)
```

### 2. Bot Initialization (bot.py)
```python
bot.main(async_session)
  ↓
Initialize Bot instance (aiogram)
  ↓
Initialize Dispatcher + MemoryStorage
  ↓
Initialize BroadcastService worker
  ↓
Register routers:
  - start.router
  - user_settings.router
  - admin.router
  - broadcast.router
  - announcements.router
  - flying_plane_handler.router
  - legacy_handlers.router (NEW)
  - announcements.router
  - flying_plane_handler.router  # ✅ Flying Plane integrated
  ↓
Register SessionMiddleware (inject session_maker)
  ↓
Start broadcast worker (asyncio.create_task)
  ↓
Start polling (dp.start_polling)
```

### 3. Message Handling
```
Telegram Message
  ↓
Dispatcher routes to handler
  ↓
SessionMiddleware injects session_maker
  ↓
Handler executes business logic
  ↓
Services (GamesService, CSVManager, etc.)
  ↓
Database/CSV persistence
  ↓
Response sent to user
```

---

## ✅ Phase 1 Integration Status

### Completed Services:
- ✅ **CSVManager** (`services/domain_services/csv_manager.py`)
  - CRUD operations for CSV files
  - File creation, reading, writing
  - Used by all services for persistence

- ✅ **GamesService** (`services/domain_services/games_service.py`)
  - Game session management
  - Anti-cheat detection
  - Payout calculation
  - Logging and auditing

- ✅ **Flying Plane Game** (`handlers/flying_plane_game.py`)
  - Game engine (400+ lines)
  - Telegram handler (`handlers/flying_plane_handler.py`)
  - Commands: `/play_flying_plane`, `/flying_plane_help`, `/flying_plane_stats`
  - Integration with GamesService ✅
  - CSV persistence ✅
  - Anti-cheat logging ✅

### Admin Protection:
- **User ID:** 7146701713 (Mohand)
- **Balance:** 10,000,000,000 SAR (CONSTANT)
- **File:** `wallets.csv`
- **Status:** ✅ Protected - Not modified by gameplay

---

## 🚀 Phase 2 Roadmap

### Pending Services (To be integrated through main.py):

1. **Agents Service** (600+ lines)
   - Location: `services/domain_services/agents_service.py`
   - Features: Agent registration, commission tracking, hierarchy
   - Integration: Import in bot.py, register router

2. **Affiliates Service** (500+ lines)
   - Location: `services/domain_services/affiliates_service.py`
   - Features: Affiliate links, referral tracking, revenue sharing
   - Integration: Import in bot.py, register router

3. **UserProfile Service** (400+ lines)
   - Location: `services/domain_services/user_profile_service.py`
   - Features: Statistics, achievements, badges, activity tracking
   - Integration: Import in bot.py, register router

---

## ⚠️ Legacy Code

### comprehensive_bot.py (5,818 lines)
**Status:** ⚠️ ARCHIVED - Original features extracted to legacy_service.py

**Integration Strategy:**
Instead of using comprehensive_bot.py directly, we extracted its valuable features into:
- `services/legacy_service.py` - Async-compatible wrapper (850+ lines)
- `handlers/legacy_handlers.py` - Aiogram handlers (650+ lines)

**Features Migrated:**
- ✅ Deposit/Withdrawal system
- ✅ User registration and management
- ✅ Multi-currency support (18 currencies)
- ✅ Transaction tracking
- ✅ Company/payment method management
- ✅ System settings
- ✅ Complaints system

**Technical Approach:**
- Wrapped synchronous CSV operations with `@async_csv_operation` decorator
- Thread-safe CSV access using `threading.Lock`
- FSM states for multi-step flows (registration, deposit, withdrawal)
- Admin balance protection maintained (User 7146701713 = 10B SAR)

**Why we don't use comprehensive_bot.py directly:**
- Uses urllib (not aiogram v3)
- Synchronous architecture (blocking I/O)
- Monolithic class structure
- Not compatible with Phase 1 services

**Why we DO use legacy_service.py:**
- ✅ Async-compatible with aiogram
- ✅ Thread-safe CSV operations
- ✅ Preserves all original features
- ✅ Integrates with main.py architecture
- ✅ Maintains admin balance protection
- ✅ Reusable by all handlers

---

## 📦 Legacy Service Integration

### services/legacy_service.py

**Purpose:** Async-compatible wrapper for comprehensive_bot.py features

**Key Components:**

#### 1. Thread Safety
```python
csv_lock = threading.Lock()

@thread_safe_csv
def find_user(self, telegram_id):
    with csv_lock:
        # Read users.csv safely
```

#### 2. Async Bridge
```python
@async_csv_operation
async def create_deposit(telegram_id, amount, company, wallet):
    # Execute in thread pool to avoid blocking
```

#### 3. Admin Protection
```python
PROTECTED_ADMIN_ID = 7146701713
PROTECTED_ADMIN_BALANCE = 10_000_000_000

async def get_user_balance(telegram_id):
    if telegram_id == PROTECTED_ADMIN_ID:
        return PROTECTED_ADMIN_BALANCE  # Always constant
```

#### 4. CSV Files Managed
- `users.csv` - User registration data
- `transactions.csv` - Deposit/withdrawal records
- `companies.csv` - Payment providers
- `exchange_addresses.csv` - Withdrawal addresses
- `complaints.csv` - Customer complaints
- `system_settings.csv` - Configuration

#### 5. Multi-Currency System
18 currencies supported:
- SAR, AED, EGP, KWD, QAR, BHD, OMR, JOD
- LBP, IQD, SYP, MAD, TND, DZD, LYD
- USD, EUR, TRY

**API Methods:**
```python
# User Management
find_user(telegram_id) -> Dict
create_user(telegram_id, name, phone, language, currency) -> str
update_user_currency(telegram_id, currency) -> bool
get_user_balance(telegram_id) -> float

# Transactions
create_deposit(telegram_id, amount, company, wallet_number) -> str
create_withdrawal(telegram_id, amount, exchange_address) -> str
get_user_transactions(telegram_id, status=None) -> List[Dict]
approve_transaction(trans_id, admin_id, note) -> bool
reject_transaction(trans_id, admin_id, note) -> bool

# Companies
get_companies(service_type=None) -> List[Dict]
add_company(name, service_type, details) -> str

# System
get_setting(key) -> str
update_setting(key, value) -> bool
get_statistics() -> Dict

# Currency
get_currency_info(currency_code) -> Dict
format_amount(amount, currency_code) -> str
```

### handlers/legacy_handlers.py

**Purpose:** Aiogram handlers for legacy features

**Commands Implemented:**
- `/register` - User registration flow
- `💰 طلب إيداع` - Deposit request
- `💸 طلب سحب` - Withdrawal request
- `📋 طلباتي` - View transactions
- `👤 حسابي` - View profile
- `💱 تغيير العملة` - Change currency
- `🆘 دعم` - Support information

**FSM States:**
- `RegistrationStates` - name → phone
- `DepositStates` - company → wallet → amount
- `WithdrawalStates` - amount → address
- `CurrencyStates` - select currency

**Integration Points:**
All handlers use `legacy_service` for business logic:
```python
from services.legacy_service import legacy_service

@router.message(Command("register"))
async def cmd_register(message, state):
    customer_id = await legacy_service.create_user(...)
```

---

## 🔀 Data Flow: Legacy vs New Services

### Legacy Features (CSV-based)
```
User Request
  ↓
legacy_handlers.py (aiogram)
  ↓
legacy_service.py (async wrapper)
  ↓
@async_csv_operation decorator
  ↓
Thread-safe CSV operations
  ↓
users.csv, transactions.csv, etc.
```

### New Features (Database-based)
```
User Request
  ↓
handlers/*.py (aiogram)
  ↓
services/domain_services/*.py
  ↓
SQLAlchemy AsyncSession
  ↓
PostgreSQL/SQLite database
```

### Compatibility
- Legacy and new services run independently
- No data conflicts (separate storage)
- Both use aiogram framework
- Both registered in bot.py

---

## 🛠️ Development Guidelines

### Adding New Features:

1. **Create handler in `handlers/` directory**
   ```python
   # handlers/new_feature.py
   from aiogram import Router
   router = Router()
   
   @router.message(Command("new_command"))
   async def handle_new_command(message, session_maker):
       # Your logic here
       pass
   ```

2. **Register router in `bot.py`**
   ```python
   from handlers import new_feature
   
   dp.include_routers(
       ...,
       new_feature.router
   )
   ```

3. **Add middleware if needed**
   ```python
   new_feature.router.message.middleware.register(
       SessionMiddleware(async_session)
   )
   ```

### Creating New Services:

1. **Create service in `services/domain_services/`**
   ```python
   # services/domain_services/new_service.py
   class NewService:
       def __init__(self, csv_manager):
           self.csv_manager = csv_manager
       
       async def do_something(self):
           # Business logic
           pass
   ```

2. **Initialize in handler or bot.py**
   ```python
   from services.domain_services.new_service import NewService
   new_service = NewService(csv_manager)
   ```

### CSV Persistence:
All data storage uses CSVManager:
```python
from services.domain_services.csv_manager import csv_manager

# Create file
csv_manager.create_file("new_data", ["col1", "col2"])

# Read all
data = csv_manager.read_all("new_data")

# Write row
csv_manager.write_row("new_data", ["col1", "col2"], ["val1", "val2"])
```

---

## 📝 Critical Notes

### DO:
- ✅ Use `main.py` as entry point
- ✅ Create modular handlers in `handlers/`
- ✅ Create services in `services/domain_services/`
- ✅ Use CSVManager for all CSV operations
- ✅ Use SQLAlchemy for database operations
- ✅ Register new routers in `bot.py`
- ✅ Test in isolation before integration

### DON'T:
- ❌ Modify `comprehensive_bot.py`
- ❌ Use direct Telegram API calls (urllib)
- ❌ Duplicate logic from Phase 1 services
- ❌ Modify admin balance (7146701713)
- ❌ Create standalone bot files
- ❌ Use synchronous database operations

---

## 🔍 Monitoring & Logs

### Check Bot Status:
```bash
ps aux | grep "[p]ython main.py"
```

### View Live Logs:
```bash
tail -f /workspaces/TaskFlowAI-/bot_output.log
```

### Stop Bot:
```bash
pkill -f "python main.py"
```

### Restart Bot:
```bash
cd /workspaces/TaskFlowAI-
source venv/bin/activate
python main.py > bot_output.log 2>&1 &
```

---

## 📊 Current Bot Info

- **Bot Username:** @Gkdkkdkfbot
- **Bot Name:** Testerr
- **Bot ID:** 8549135277
- **Process ID:** 32741 (as of Jan 2, 2026)
- **Uptime:** Running since 09:28 UTC
- **Status:** ✅ ACTIVE & POLLING

---

## 🎮 Integrated Games

### Flying Plane
- **Handler:** `handlers/flying_plane_handler.py`
- **Engine:** `handlers/flying_plane_game.py` (400+ lines)
- **Commands:**
  - `/play_flying_plane <amount>` - Play game
  - `/flying_plane_help` - Instructions
  - `/flying_plane_stats` - Statistics
- **Status:** ✅ WORKING
- **CSV Files:** 
  - `data/flying_plane_scores.csv`
  - `data/game_sessions.csv`
  - `data/game_logs.csv`

---

## 🔐 Security & Protection

### Admin Balance Protection:
- **User:** 7146701713 (Mohand)
- **Balance:** 10,000,000,000 SAR
- **Status:** CONSTANT (not modified by games)
- **Purpose:** Testing only

### Anti-Cheat:
- **Service:** GamesService._detect_suspicious_patterns()
- **Logging:** All games logged to game_logs.csv
- **Alerts:** Scores > 1000 flagged as suspicious

---

## 📞 Contact & Support

For questions about this architecture, refer to:
- `/workspaces/TaskFlowAI-/ARCHITECTURE.md` (this file)
- `/workspaces/TaskFlowAI-/FLYING_PLANE_GAME_TEST_REPORT.md`
- `/workspaces/TaskFlowAI-/FLYING_PLANE_GAME_README.md`

---

**Last Verified:** January 2, 2026 @ 09:32 UTC  
**Bot Status:** ✅ OPERATIONAL  
**Entry Point:** main.py (OFFICIAL)
