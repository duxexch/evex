# Phase 7, Sub-phase 7.2: Configuration Validation - Complete

## Overview

Sub-phase 7.2 implements comprehensive configuration validation and schema definition. All system components are configured through a unified, validated schema with sensible defaults and environment-based override.

## Deliverables

### 1. Extended Configuration Schema (services/extended_config_schema.py)

**Core Components**:

#### DatabaseSettings
- `url`: PostgreSQL async connection URL (required)
- `pool_size`: Connection pool size (default: 10)
- `max_overflow`: Max overflow connections (default: 20)
- `echo`: SQL logging (default: false)
- `pool_recycle`: Connection recycle timeout (default: 3600s)
- `pool_pre_ping`: Test connections before use (default: true)

#### APISettings
- `host`: API host (default: 0.0.0.0)
- `port`: API port (default: 8000)
- `workers`: Worker processes (default: 4)
- `reload`: Auto-reload on changes (default: false)
- `secret_key`: JWT secret (required, min 32 chars)
- `cors_origins`: CORS allowed origins (default: ["*"])
- `timeout`: Request timeout seconds (default: 300)
- `max_request_size`: Max request size bytes (default: 10MB)

#### BotSettings
- `token`: Telegram bot token (required)
- `admin_ids`: Admin user IDs (default: [])
- `default_language`: Default language (default: "en", allowed: "en", "ar")
- `session_timeout`: Session timeout seconds (default: 1800)
- `webhook_url`: Webhook URL for updates (optional)
- `webhook_secret`: Webhook secret (optional)

#### LoggingSettings
- `level`: Log level (default: INFO)
- `format`: Log format string
- `file_path`: Log file path (optional)
- `file_size_mb`: Max log file size (default: 100)
- `backup_count`: Log file backups (default: 10)
- `structured_logging`: JSON logging (default: true)

#### AlgorithmSettings
- `default_algorithm`: FIXED_HOUSE_EDGE or DYNAMIC (default: FIXED_HOUSE_EDGE)
- `allow_dynamic`: Allow dynamic algorithm (default: false)
- `dynamic_beta_users`: Beta user list (default: [])
- `house_edge`: House edge percentage (default: 0.05, range: 0-1)
- `min_payout_multiplier`: Min payout multiplier (default: 0.1)
- `max_payout_multiplier`: Max payout multiplier (default: 10.0)

#### NotificationSettings
- `enabled`: Enable notifications (default: true)
- `queue_max_size`: Max queue size (default: 10000)
- `batch_size`: Batch processing size (default: 100)
- `retry_max_attempts`: Retry attempts (default: 5)
- `retry_initial_delay_seconds`: Initial retry delay (default: 300)
- `retry_max_delay_seconds`: Max retry delay (default: 7200)
- `dead_letter_retention_days`: DLQ retention (default: 7)

#### RateLimitSettings
- `enabled`: Enable rate limiting (default: true)
- `user_capacity`: User token capacity (default: 100)
- `user_refill_rate`: User tokens/interval (default: 10)
- `user_refill_interval`: Refill interval seconds (default: 1)
- `api_capacity`: API token capacity (default: 1000)
- `api_refill_rate`: API tokens/interval (default: 100)
- `api_refill_interval`: Refill interval seconds (default: 1)
- `abuse_spike_threshold`: Spike detection threshold (default: 50 events)
- `abuse_window_minutes`: Detection window minutes (default: 5)
- `ddos_threshold_per_minute`: DDoS threshold (default: 100)
- `ddos_block_duration_minutes`: Block duration (default: 15)

#### HealthCheckSettings
- `enabled`: Enable health checks (default: true)
- `db_response_time_threshold_ms`: DB threshold (default: 100)
- `notification_pending_threshold`: Pending limit (default: 100)
- `notification_failed_threshold`: Failed limit (default: 10)
- `check_interval_seconds`: Check interval (default: 30)
- `degraded_threshold`: Degradation threshold (default: 3)

#### AuditSettings
- `enabled`: Enable audit logging (default: true)
- `log_user_actions`: Log user actions (default: true)
- `log_admin_actions`: Log admin actions (default: true)
- `log_financial_transactions`: Log transactions (default: true)
- `retention_days`: Retention period (default: 365)
- `immutable`: Immutable logs (default: true)

#### ApplicationSettings (Master)
- `environment`: Environment mode (development/staging/production)
- `version`: Application version
- `debug`: Debug mode (default: false)
- All sub-component settings

### 2. Startup Validation Service (services/startup_validation_service.py)

**Validation Phases**:

1. **Configuration Validation**
   - Load settings from environment
   - Validate all component settings
   - Catch configuration errors early

2. **Environment Validation**
   - Production-specific checks
   - Debug mode restrictions
   - Host/port appropriateness

3. **Deployment Readiness**
   - Environment variables present
   - Config files exist
   - Dependencies installed
   - Database accessible

4. **Database Validation**
   - Connection test
   - Pool configuration verification

5. **Settings Validation**
   - Critical settings check
   - All components configured
   - Feature flags validated

**StartupValidator Class**:
- `validate_all()`: Run all validations
- `get_summary()`: Validation summary with timing
- Per-component validators for isolation
- Detailed error reporting

## Configuration Loading

### Method 1: Load from Environment
```python
from services.extended_config_schema import load_settings

settings = load_settings()  # Load from env vars
if not settings.is_valid():
    errors = settings.validate()
    print(f"Config errors: {errors}")
```

### Method 2: Get Current Settings
```python
from services.extended_config_schema import get_settings

settings = get_settings()  # Singleton pattern
api_port = settings.api.port
db_url = settings.database.url
```

### Method 3: Startup Validation
```python
from services.startup_validation_service import run_startup_validation

all_valid = await run_startup_validation(session_maker)
if not all_valid:
    print("Startup validation failed")
```

## Environment Variable Mapping

**Database**:
- `DATABASE_URL` → `settings.database.url`
- `DB_POOL_SIZE` → `settings.database.pool_size`
- `DB_MAX_OVERFLOW` → `settings.database.max_overflow`
- `DB_ECHO` → `settings.database.echo`

**API**:
- `API_HOST` → `settings.api.host`
- `API_PORT` → `settings.api.port`
- `API_WORKERS` → `settings.api.workers`
- `API_RELOAD` → `settings.api.reload`
- `SECRET_KEY` → `settings.api.secret_key`

**Bot**:
- `BOT_TOKEN` → `settings.bot.token`
- `BOT_LANGUAGE` → `settings.bot.default_language`
- `ADMIN_IDS` → `settings.bot.admin_ids` (parsed from comma-separated)

**Algorithm**:
- `DEFAULT_ALGORITHM` → `settings.algorithm.default_algorithm`
- `ALLOW_DYNAMIC_ALGORITHM` → `settings.algorithm.allow_dynamic`
- `HOUSE_EDGE` → `settings.algorithm.house_edge`

**Notification**:
- `NOTIFICATIONS_ENABLED` → `settings.notification.enabled`
- `NOTIFICATION_QUEUE_SIZE` → `settings.notification.queue_max_size`
- `NOTIFICATION_RETRY_ATTEMPTS` → `settings.notification.retry_max_attempts`

**Rate Limiting**:
- `RATE_LIMITING_ENABLED` → `settings.rate_limit.enabled`
- `RATE_LIMIT_CAPACITY` → `settings.rate_limit.user_capacity`
- `RATE_LIMIT_DDOS_THRESHOLD` → `settings.rate_limit.ddos_threshold_per_minute`

**Health Checks**:
- `HEALTH_CHECKS_ENABLED` → `settings.health_check.enabled`
- `HEALTH_CHECK_DB_THRESHOLD_MS` → `settings.health_check.db_response_time_threshold_ms`

**Audit**:
- `AUDIT_ENABLED` → `settings.audit.enabled`
- `AUDIT_RETENTION_DAYS` → `settings.audit.retention_days`

## Validation Rules

### Critical (Required)
- `DATABASE_URL`: Must be PostgreSQL async URL
- `SECRET_KEY`: Must be ≥32 characters
- `BOT_TOKEN`: Must not be empty

### Range Validations
- `pool_size`: Must be > 0
- `API_PORT`: Must be 1-65535
- `house_edge`: Must be 0-1
- `timeout`: Must be > 0

### Environment-Specific
**Production Mode** (ENVIRONMENT=production):
- `debug` must be false
- `api.reload` must be false
- `database.echo` must be false
- `log_level` should not be DEBUG
- `api.host` should not be localhost

**Development Mode**:
- `debug` can be true
- `api.reload` can be true (recommended)

## Setup Instructions

### 1. Create `.env` file
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Set Required Variables
```bash
# Minimum required
export DATABASE_URL="postgresql+asyncpg://user:password@localhost/langsense"
export SECRET_KEY="your-secret-key-minimum-32-characters-long"
export BOT_TOKEN="your-telegram-bot-token"
```

### 3. Validate Configuration
```bash
python -c "from services.startup_validation_service import startup_validator; import asyncio; asyncio.run(startup_validator._validate_configuration())"
```

### 4. Run Startup Validation
```bash
python -c "
from services.startup_validation_service import startup_validator
from api.dependencies import session_maker
import asyncio
result = asyncio.run(startup_validator.validate_all(session_maker))
print(result)
"
```

## Testing Configuration

### Test Configuration Loading
```python
from services.extended_config_schema import load_settings

settings = load_settings()
assert settings.is_valid()
assert settings.database.url.startswith('postgresql')
assert len(settings.api.secret_key) >= 32
```

### Test Validation
```python
from services.extended_config_schema import ApplicationSettings, DatabaseSettings

db = DatabaseSettings(url='')
errors = db.validate()
assert 'DATABASE_URL required' in errors
```

### Test Environment Constraints
```python
from services.extended_config_schema import (
    ApplicationSettings,
    EnvironmentMode,
    APISettings,
)

settings = ApplicationSettings(
    environment=EnvironmentMode.PRODUCTION,
    debug=True,  # Invalid for production
)

env_errors = settings.validate_environment()
assert len(env_errors) > 0
```

## Integration Checklist

- [ ] `.env` file created with all required variables
- [ ] Configuration schema loaded successfully
- [ ] All validations passing
- [ ] Startup validator integrated into app initialization
- [ ] Health check service using settings
- [ ] Rate limiter configured from settings
- [ ] Notification service respecting queue settings
- [ ] Audit system configured with retention

## Default Values Summary

| Component | Setting | Default |
|-----------|---------|---------|
| Database | pool_size | 10 |
| Database | max_overflow | 20 |
| API | host | 0.0.0.0 |
| API | port | 8000 |
| API | workers | 4 |
| Bot | language | en |
| Bot | session_timeout | 1800 |
| Algorithm | default | FIXED_HOUSE_EDGE |
| Algorithm | house_edge | 0.05 |
| Notification | queue_max_size | 10000 |
| Notification | retry_attempts | 5 |
| Rate Limit | user_capacity | 100 |
| Health Check | db_threshold_ms | 100 |
| Audit | retention_days | 365 |

## Status

✅ Sub-phase 7.2 COMPLETE
- Extended configuration schema defined
- All components configurable
- Startup validation implemented
- Environment-based configuration
- Comprehensive defaults
- Validation rules enforced
- Production-ready setup

## Next Sub-phase

**Sub-phase 7.3: Database & Migrations**
- Alembic integration
- Migration scripts
- Schema versioning
- Database initialization
