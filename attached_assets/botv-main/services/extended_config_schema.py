#!/usr/bin/env python3
"""
Extended configuration schemas
Detailed configuration for all system components
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import os


class EnvironmentMode(str, Enum):
    """Application environment"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(str, Enum):
    """Logging level"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class DatabaseSettings:
    """Database configuration"""
    url: str
    pool_size: int = 10
    max_overflow: int = 20
    echo: bool = False
    pool_recycle: int = 3600
    pool_pre_ping: bool = True
    
    def validate(self) -> List[str]:
        """Validate database settings"""
        errors = []
        if not self.url:
            errors.append("DATABASE_URL required")
        if not self.url.startswith(('postgresql://', 'postgresql+asyncpg://')):
            errors.append("DATABASE_URL must be PostgreSQL async URL")
        if self.pool_size < 1:
            errors.append("pool_size must be > 0")
        if self.max_overflow < 0:
            errors.append("max_overflow must be >= 0")
        return errors


@dataclass
class APISettings:
    """API configuration"""
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    reload: bool = False
    secret_key: str = ""
    cors_origins: List[str] = field(default_factory=lambda: ["*"])
    timeout: int = 300
    max_request_size: int = 10485760  # 10MB
    
    def validate(self) -> List[str]:
        """Validate API settings"""
        errors = []
        if not self.secret_key:
            errors.append("SECRET_KEY required")
        if len(self.secret_key) < 32:
            errors.append("SECRET_KEY must be >= 32 characters")
        if self.port < 1 or self.port > 65535:
            errors.append("port must be 1-65535")
        if self.workers < 1:
            errors.append("workers must be > 0")
        if self.timeout < 1:
            errors.append("timeout must be > 0")
        return errors


@dataclass
class BotSettings:
    """Telegram bot configuration"""
    token: str = ""
    admin_ids: List[int] = field(default_factory=list)
    default_language: str = "en"
    session_timeout: int = 1800
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    
    def validate(self) -> List[str]:
        """Validate bot settings"""
        errors = []
        if not self.token:
            errors.append("BOT_TOKEN required")
        if self.session_timeout < 60:
            errors.append("session_timeout must be >= 60 seconds")
        if self.default_language not in ("en", "ar"):
            errors.append("default_language must be 'en' or 'ar'")
        return errors


@dataclass
class LoggingSettings:
    """Logging configuration"""
    level: LogLevel = LogLevel.INFO
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    file_path: Optional[str] = None
    file_size_mb: int = 100
    backup_count: int = 10
    structured_logging: bool = True
    
    def validate(self) -> List[str]:
        """Validate logging settings"""
        errors = []
        if self.file_size_mb < 1:
            errors.append("file_size_mb must be > 0")
        if self.backup_count < 0:
            errors.append("backup_count must be >= 0")
        return errors


@dataclass
class AlgorithmSettings:
    """Game algorithm configuration"""
    default_algorithm: str = "FIXED_HOUSE_EDGE"
    allow_dynamic: bool = False
    dynamic_beta_users: List[int] = field(default_factory=list)
    house_edge: float = 0.05
    min_payout_multiplier: float = 0.1
    max_payout_multiplier: float = 10.0
    
    def validate(self) -> List[str]:
        """Validate algorithm settings"""
        errors = []
        if self.default_algorithm not in ("FIXED_HOUSE_EDGE", "DYNAMIC"):
            errors.append("default_algorithm must be FIXED_HOUSE_EDGE or DYNAMIC")
        if self.house_edge < 0 or self.house_edge > 1:
            errors.append("house_edge must be 0-1")
        if self.min_payout_multiplier < 0:
            errors.append("min_payout_multiplier must be >= 0")
        if self.max_payout_multiplier <= self.min_payout_multiplier:
            errors.append("max_payout_multiplier must be > min_payout_multiplier")
        return errors


@dataclass
class NotificationSettings:
    """Notification system configuration"""
    enabled: bool = True
    queue_max_size: int = 10000
    batch_size: int = 100
    retry_max_attempts: int = 5
    retry_initial_delay_seconds: int = 300  # 5 minutes
    retry_max_delay_seconds: int = 7200  # 2 hours
    dead_letter_retention_days: int = 7
    
    def validate(self) -> List[str]:
        """Validate notification settings"""
        errors = []
        if self.queue_max_size < 100:
            errors.append("queue_max_size must be >= 100")
        if self.batch_size < 1:
            errors.append("batch_size must be > 0")
        if self.retry_max_attempts < 1:
            errors.append("retry_max_attempts must be > 0")
        if self.retry_max_delay_seconds <= self.retry_initial_delay_seconds:
            errors.append("retry_max_delay_seconds must be > retry_initial_delay_seconds")
        return errors


@dataclass
class RateLimitSettings:
    """Rate limiting configuration"""
    enabled: bool = True
    user_capacity: int = 100
    user_refill_rate: int = 10
    user_refill_interval: int = 1
    api_capacity: int = 1000
    api_refill_rate: int = 100
    api_refill_interval: int = 1
    abuse_spike_threshold: int = 50
    abuse_window_minutes: int = 5
    ddos_threshold_per_minute: int = 100
    ddos_block_duration_minutes: int = 15
    
    def validate(self) -> List[str]:
        """Validate rate limit settings"""
        errors = []
        if self.user_capacity < 1:
            errors.append("user_capacity must be > 0")
        if self.user_refill_rate < 1:
            errors.append("user_refill_rate must be > 0")
        if self.abuse_spike_threshold < 10:
            errors.append("abuse_spike_threshold must be >= 10")
        if self.ddos_threshold_per_minute < 10:
            errors.append("ddos_threshold_per_minute must be >= 10")
        return errors


@dataclass
class HealthCheckSettings:
    """Health check configuration"""
    enabled: bool = True
    db_response_time_threshold_ms: int = 100
    notification_pending_threshold: int = 100
    notification_failed_threshold: int = 10
    check_interval_seconds: int = 30
    degraded_threshold: int = 3
    
    def validate(self) -> List[str]:
        """Validate health check settings"""
        errors = []
        if self.db_response_time_threshold_ms < 1:
            errors.append("db_response_time_threshold_ms must be > 0")
        if self.notification_pending_threshold < 1:
            errors.append("notification_pending_threshold must be > 0")
        if self.check_interval_seconds < 1:
            errors.append("check_interval_seconds must be > 0")
        return errors


@dataclass
class AuditSettings:
    """Audit logging configuration"""
    enabled: bool = True
    log_user_actions: bool = True
    log_admin_actions: bool = True
    log_financial_transactions: bool = True
    retention_days: int = 365
    immutable: bool = True
    
    def validate(self) -> List[str]:
        """Validate audit settings"""
        errors = []
        if self.retention_days < 1:
            errors.append("retention_days must be > 0")
        return errors


@dataclass
class ApplicationSettings:
    """Master application settings"""
    environment: EnvironmentMode = EnvironmentMode.DEVELOPMENT
    version: str = "1.0.0"
    debug: bool = False
    
    database: DatabaseSettings = field(default_factory=DatabaseSettings)
    api: APISettings = field(default_factory=APISettings)
    bot: BotSettings = field(default_factory=BotSettings)
    logging: LoggingSettings = field(default_factory=LoggingSettings)
    algorithm: AlgorithmSettings = field(default_factory=AlgorithmSettings)
    notification: NotificationSettings = field(default_factory=NotificationSettings)
    rate_limit: RateLimitSettings = field(default_factory=RateLimitSettings)
    health_check: HealthCheckSettings = field(default_factory=HealthCheckSettings)
    audit: AuditSettings = field(default_factory=AuditSettings)
    
    def validate(self) -> Dict[str, List[str]]:
        """
        Validate all settings
        
        Returns:
            Dictionary of component -> errors
        """
        all_errors = {}
        
        for component_name in dir(self):
            component = getattr(self, component_name)
            if hasattr(component, 'validate'):
                errors = component.validate()
                if errors:
                    all_errors[component_name] = errors
        
        return all_errors
    
    def is_valid(self) -> bool:
        """Check if all settings are valid"""
        errors = self.validate()
        return len(errors) == 0
    
    def validate_environment(self) -> List[str]:
        """
        Validate environment-specific requirements
        
        Returns:
            List of errors
        """
        errors = []
        
        if self.environment == EnvironmentMode.PRODUCTION:
            if self.debug:
                errors.append("debug must be False in production")
            if self.api.reload:
                errors.append("reload must be False in production")
            if self.database.echo:
                errors.append("database.echo must be False in production")
            if self.logging.level == LogLevel.DEBUG:
                errors.append("log level should not be DEBUG in production")
            if "localhost" in self.api.host or "127.0.0.1" in self.api.host:
                errors.append("API host should not be localhost in production")
        
        return errors


# Global settings instance
settings: Optional[ApplicationSettings] = None


def load_settings() -> ApplicationSettings:
    """
    Load settings from environment variables
    
    Returns:
        ApplicationSettings instance
    """
    global settings
    
    db_settings = DatabaseSettings(
        url=os.getenv('DATABASE_URL', ''),
        pool_size=int(os.getenv('DB_POOL_SIZE', '10')),
        max_overflow=int(os.getenv('DB_MAX_OVERFLOW', '20')),
        echo=os.getenv('DB_ECHO', 'false').lower() == 'true',
    )
    
    api_settings = APISettings(
        host=os.getenv('API_HOST', '0.0.0.0'),
        port=int(os.getenv('API_PORT', '8000')),
        workers=int(os.getenv('API_WORKERS', '4')),
        reload=os.getenv('API_RELOAD', 'false').lower() == 'true',
        secret_key=os.getenv('SECRET_KEY', ''),
    )
    
    bot_settings = BotSettings(
        token=os.getenv('BOT_TOKEN', ''),
        default_language=os.getenv('BOT_LANGUAGE', 'en'),
    )
    
    logging_settings = LoggingSettings(
        level=LogLevel[os.getenv('LOG_LEVEL', 'INFO')],
        structured_logging=os.getenv('STRUCTURED_LOGGING', 'true').lower() == 'true',
    )
    
    algorithm_settings = AlgorithmSettings(
        default_algorithm=os.getenv('DEFAULT_ALGORITHM', 'FIXED_HOUSE_EDGE'),
        allow_dynamic=os.getenv('ALLOW_DYNAMIC_ALGORITHM', 'false').lower() == 'true',
        house_edge=float(os.getenv('HOUSE_EDGE', '0.05')),
    )
    
    notification_settings = NotificationSettings(
        enabled=os.getenv('NOTIFICATIONS_ENABLED', 'true').lower() == 'true',
        queue_max_size=int(os.getenv('NOTIFICATION_QUEUE_SIZE', '10000')),
    )
    
    rate_limit_settings = RateLimitSettings(
        enabled=os.getenv('RATE_LIMITING_ENABLED', 'true').lower() == 'true',
        user_capacity=int(os.getenv('RATE_LIMIT_CAPACITY', '100')),
    )
    
    health_check_settings = HealthCheckSettings(
        enabled=os.getenv('HEALTH_CHECKS_ENABLED', 'true').lower() == 'true',
    )
    
    audit_settings = AuditSettings(
        enabled=os.getenv('AUDIT_ENABLED', 'true').lower() == 'true',
    )
    
    settings = ApplicationSettings(
        environment=EnvironmentMode(os.getenv('ENVIRONMENT', 'development')),
        debug=os.getenv('DEBUG', 'false').lower() == 'true',
        database=db_settings,
        api=api_settings,
        bot=bot_settings,
        logging=logging_settings,
        algorithm=algorithm_settings,
        notification=notification_settings,
        rate_limit=rate_limit_settings,
        health_check=health_check_settings,
        audit=audit_settings,
    )
    
    return settings


def get_settings() -> ApplicationSettings:
    """
    Get current application settings
    
    Returns:
        ApplicationSettings instance
    """
    global settings
    if settings is None:
        settings = load_settings()
    return settings
