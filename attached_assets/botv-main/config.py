#!/usr/bin/env python3
"""
Configuration module for LangSense PWM (Platform Web Management)
Web-based control panel - NO Telegram integration
"""

import os
from dotenv import load_dotenv
import secrets

# Load environment variables from .env file
load_dotenv()

# ==================== WEB ADMIN CONFIGURATION ====================
# Admin users (for web dashboard authentication)
ADMIN_USER_IDS_STR = os.getenv("ADMIN_USER_IDS", "1")
ADMIN_USER_IDS = [int(uid.strip()) for uid in ADMIN_USER_IDS_STR.split(",") if uid.strip().isdigit()]

# Web admin credentials (for initial setup)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@langsense.local")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change_this_password")

# BOT_TOKEN kept for backward compatibility with database (but not required)
BOT_TOKEN = os.getenv("BOT_TOKEN", "dummy-token-for-pwm-mode")
TELEGRAM_BOT_TOKEN = BOT_TOKEN  # Alias for backward compatibility

# ==================== DATABASE CONFIGURATION ====================
# Use PostgreSQL in production, SQLite for development
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./langsense.db"
)

# Database pool settings
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))

# ==================== SECURITY CONFIGURATION ====================
# ✅ Encryption key for sensitive data (phone, etc.)
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Generate a new key only in development
    if "sqlite" in DATABASE_URL:
        ENCRYPTION_KEY = os.urandom(32).hex()
        print(f"⚠️  WARNING: Generated temporary encryption key. Set ENCRYPTION_KEY in production!")
    else:
        raise ValueError("ENCRYPTION_KEY must be set in production environment")

# ✅ JWT Secret for API authentication
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    # Generate a new key only in development
    if "sqlite" in DATABASE_URL:
        JWT_SECRET_KEY = secrets.token_urlsafe(32)
        print(f"⚠️  WARNING: Generated temporary JWT secret. Set JWT_SECRET_KEY in production!")
    else:
        raise ValueError("JWT_SECRET_KEY must be set in production environment")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# ✅ CORS Configuration (restrict in production)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
if not CORS_ORIGINS or CORS_ORIGINS == [""]:
    # Allow localhost for development
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1"]

# ✅ HTTPS Configuration
FORCE_HTTPS = os.getenv("FORCE_HTTPS", "false").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ==================== BROADCAST CONFIGURATION ====================
BROADCAST_RATE_LIMIT = int(os.getenv("BROADCAST_RATE_LIMIT", "30"))  # messages per second
BROADCAST_CHUNK_SIZE = int(os.getenv("BROADCAST_CHUNK_SIZE", "100"))  # users per batch
BROADCAST_RETRY_ATTEMPTS = int(os.getenv("BROADCAST_RETRY_ATTEMPTS", "3"))
BROADCAST_RETRY_DELAY = int(os.getenv("BROADCAST_RETRY_DELAY", "5"))  # seconds

if BROADCAST_RATE_LIMIT > 30:
    BROADCAST_RATE_LIMIT = 30
    print("⚠️  WARNING: BROADCAST_RATE_LIMIT limited to 30 (Telegram API limit)")

# ==================== LOCALIZATION CONFIGURATION ====================
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "ar")
DEFAULT_COUNTRY = os.getenv("DEFAULT_COUNTRY", "SA")
SUPPORTED_LANGUAGES = ["ar", "en"]

# ==================== CUSTOMER ID CONFIGURATION ====================
CUSTOMER_ID_PREFIX = os.getenv("CUSTOMER_ID_PREFIX", "C")
CUSTOMER_ID_YEAR_FORMAT = os.getenv("CUSTOMER_ID_YEAR_FORMAT", "2025")

# ==================== FILE UPLOAD CONFIGURATION ====================
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "20")) * 1024 * 1024  # 20MB default
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

# ==================== PAGINATION CONFIGURATION ====================
USERS_PER_PAGE = int(os.getenv("USERS_PER_PAGE", "10"))
ANNOUNCEMENTS_PER_PAGE = int(os.getenv("ANNOUNCEMENTS_PER_PAGE", "5"))
TRANSACTIONS_PER_PAGE = int(os.getenv("TRANSACTIONS_PER_PAGE", "20"))

# ==================== LOGGING CONFIGURATION ====================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "bot.log")

# ==================== RATE LIMITING CONFIGURATION ====================
USER_RATE_LIMIT = int(os.getenv("USER_RATE_LIMIT", "5"))  # requests per minute
ADMIN_RATE_LIMIT = int(os.getenv("ADMIN_RATE_LIMIT", "30"))  # requests per minute
API_RATE_LIMIT = int(os.getenv("API_RATE_LIMIT", "100"))  # requests per minute

# ✅ Financial rate limiting
DEPOSIT_RATE_LIMIT = int(os.getenv("DEPOSIT_RATE_LIMIT", "10"))  # requests per hour
WITHDRAWAL_RATE_LIMIT = int(os.getenv("WITHDRAWAL_RATE_LIMIT", "10"))  # requests per hour

# ==================== FINANCIAL LIMITS ====================
MIN_DEPOSIT = float(os.getenv("MIN_DEPOSIT", "50"))
MAX_DEPOSIT = float(os.getenv("MAX_DEPOSIT", "100000"))
MIN_WITHDRAWAL = float(os.getenv("MIN_WITHDRAWAL", "100"))
MAX_DAILY_WITHDRAWAL = float(os.getenv("MAX_DAILY_WITHDRAWAL", "10000"))

# ==================== REDIS CONFIGURATION ====================
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ==================== RABBITMQ CONFIGURATION ====================
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

# ==================== ENVIRONMENT ====================
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = ENVIRONMENT == "development"

# Validation
def validate_config():
    """Validate configuration settings"""
    errors = []
    
    # Validate BOT_TOKEN
    if not BOT_TOKEN:
        errors.append("BOT_TOKEN is required")
    elif len(BOT_TOKEN) < 20 and BOT_TOKEN != "dummy-token-for-api-mode":
        errors.append("Invalid BOT_TOKEN format")
    
    # Validate admin IDs
    if not ADMIN_USER_IDS:
        errors.append("No valid admin user IDs configured")
    
    # Validate rate limits
    if BROADCAST_RATE_LIMIT > 30:
        errors.append("BROADCAST_RATE_LIMIT cannot exceed 30 messages/second (Telegram limit)")
    
    # Validate encryption key in production
    if ENVIRONMENT == "production" and not os.getenv("ENCRYPTION_KEY"):
        errors.append("ENCRYPTION_KEY must be explicitly set in production")
    
    # Validate JWT secret in production
    if ENVIRONMENT == "production" and not os.getenv("JWT_SECRET_KEY"):
        errors.append("JWT_SECRET_KEY must be explicitly set in production")
    
    # Validate database
    if not DATABASE_URL:
        errors.append("DATABASE_URL is required")
    
    # Validate financial limits
    if MIN_DEPOSIT >= MAX_DEPOSIT:
        errors.append("MIN_DEPOSIT must be less than MAX_DEPOSIT")
    
    if MIN_WITHDRAWAL >= MAX_DAILY_WITHDRAWAL:
        errors.append("MIN_WITHDRAWAL must be less than MAX_DAILY_WITHDRAWAL")
    
    if errors:
        raise ValueError("Configuration errors: " + "; ".join(errors))

# Validate configuration on import
validate_config()
