# Copilot Instructions – LangSense

## Scope & Architecture
- Core components: Aiogram v3 bot ([bot.py](bot.py) + `handlers/`), FastAPI API (see [config.py](config.py) for shared settings), React Native/Expo app ([mobile-app](mobile-app/README.md)).
- Single ORM source in [models.py](models.py); async SQLAlchemy 2.0 only; Decimal/Numeric for money; JSON for extensible fields.
- Telegram production entrypoint is [bot.py](bot.py) with routers and middleware; legacy CSV-driven [comprehensive_bot.py](comprehensive_bot.py) exists—do not mix storage styles when extending.
- Broadcasts flow through `BroadcastService` with worker startup in [bot.py](bot.py); avoid new messaging channels.

## Data & Financial Rules
- Outbox/OutboxRecipient track all user-facing financial requests; any deposit/withdrawal/complaint path must create Outbox records using `OutboxType`/`OutboxStatus` enums.
- Transactions/AuditLog are immutable; keep balance snapshots and HMAC signatures aligned with `Transaction` schema; commissions and wallets live in wallet/affiliate models inside [models.py](models.py).
- Wallets are per-currency with `WalletTransaction` ledger; keep Decimal math and non-negative balance constraints.

## Bot Patterns
- Routers must be registered in [bot.py](bot.py); session_maker injected by `SessionMiddleware`; wrap writes in `async with session_maker() as session` and `await session.commit()`.
- Use existing i18n helpers (e.g., `get_text`) and preserve RTL Arabic text; avoid hardcoded strings.
- Keep admin flows behind existing admin middleware/decorators; reuse keyboards and reply markup patterns from handlers.

## API & Config
- Configuration validated on import in [config.py](config.py); required envs: BOT_TOKEN, ADMIN_USER_IDS, DATABASE_URL/ENCRYPTION_KEY/JWT_SECRET_KEY. Respect rate-limit and financial limit settings.
- FastAPI routes (if editing) are async, depend on `get_db` for sessions, and rely on JWT auth utilities; avoid manual commits inside routes.

## Mobile App
- Expo app reads API base URL from `mobile-app/src/constants/config.js`; keep JWT in AsyncStorage and use shared services under `mobile-app/src/services/`.

## Development Workflow
- Python setup: `pip install -r requirements.txt`; run bot via `python bot_main.py` (Aiogram) after setting env; legacy `comprehensive_bot.py` uses CSV files for offline/demo only.
- Tests (when present): `pytest tests/ -v --cov`; keep async fixtures compatible with SQLAlchemy async engine.
- Mobile: `cd mobile-app && npm install && npm start` (or `npm run ios`/`android`).

## Change Management
- Maintain existing architecture; prefer extending models/services already defined; no new schemas outside [models.py](models.py).
- Keep responses and code minimal—avoid unsolicited refactors or new patterns; match existing logging and validation styles.
