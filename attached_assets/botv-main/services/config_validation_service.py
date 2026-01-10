#!/usr/bin/env python3
"""
Configuration validation service
Validate and load application configuration
"""

from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
import os


class ConfigStatus(str, Enum):
    """Configuration status"""
    VALID = "VALID"
    INVALID = "INVALID"
    INCOMPLETE = "INCOMPLETE"


@dataclass
class ConfigValue:
    """Single configuration value"""
    key: str
    value: Any
    required: bool
    data_type: type
    default: Optional[Any] = None
    description: str = ""
    valid: bool = True
    error: Optional[str] = None


class ConfigValidator:
    """Validate application configuration"""
    
    def __init__(self):
        """Initialize configuration validator"""
        self.config_values: Dict[str, ConfigValue] = {}
        self.status = ConfigStatus.INCOMPLETE
    
    def register(
        self,
        key: str,
        required: bool = True,
        data_type: type = str,
        default: Optional[Any] = None,
        description: str = "",
    ) -> ConfigValue:
        """
        Register configuration value
        
        Args:
            key: Configuration key
            required: Whether required
            data_type: Expected data type
            default: Default value
            description: Description
            
        Returns:
            ConfigValue instance
        """
        config_value = ConfigValue(
            key=key,
            value=default,
            required=required,
            data_type=data_type,
            default=default,
            description=description,
        )
        
        self.config_values[key] = config_value
        return config_value
    
    async def validate(self) -> Tuple[bool, List[str]]:
        """
        Validate all registered configuration
        
        Returns:
            (all_valid, errors) tuple
        """
        errors = []
        
        for key, config_value in self.config_values.items():
            # Get value from environment
            env_value = os.getenv(key)
            
            if env_value is None:
                if config_value.required and config_value.default is None:
                    errors.append(f"Required config missing: {key}")
                    config_value.valid = False
                    config_value.error = f"Missing required value"
                else:
                    config_value.value = config_value.default
                    config_value.valid = True
            else:
                # Type conversion and validation
                try:
                    if config_value.data_type == int:
                        config_value.value = int(env_value)
                    elif config_value.data_type == float:
                        config_value.value = float(env_value)
                    elif config_value.data_type == bool:
                        config_value.value = env_value.lower() in ('true', '1', 'yes')
                    else:
                        config_value.value = env_value
                    
                    config_value.valid = True
                except (ValueError, TypeError) as e:
                    config_value.valid = False
                    config_value.error = f"Invalid type: {str(e)}"
                    errors.append(f"Config validation failed for {key}: {str(e)}")
        
        if errors:
            self.status = ConfigStatus.INVALID
        else:
            self.status = ConfigStatus.VALID
        
        return len(errors) == 0, errors
    
    def get(self, key: str) -> Any:
        """
        Get configuration value
        
        Args:
            key: Configuration key
            
        Returns:
            Configuration value
        """
        if key not in self.config_values:
            raise KeyError(f"Unknown config key: {key}")
        
        config_value = self.config_values[key]
        
        if not config_value.valid:
            raise ValueError(f"Invalid config: {key} - {config_value.error}")
        
        return config_value.value
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get configuration summary
        
        Returns:
            Summary dictionary
        """
        valid_count = sum(1 for v in self.config_values.values() if v.valid)
        invalid_count = sum(1 for v in self.config_values.values() if not v.valid)
        
        return {
            'status': self.status.value,
            'valid_count': valid_count,
            'invalid_count': invalid_count,
            'total_count': len(self.config_values),
            'values': {
                key: {
                    'set': config_value.value is not None,
                    'type': config_value.data_type.__name__,
                    'required': config_value.required,
                    'valid': config_value.valid,
                    'error': config_value.error,
                    'description': config_value.description,
                }
                for key, config_value in self.config_values.items()
            },
        }


class DatabaseConfig:
    """Database configuration"""
    
    def __init__(self):
        """Initialize database config"""
        self.validator = ConfigValidator()
        
        # Register database configs
        self.validator.register(
            'DATABASE_URL',
            required=True,
            data_type=str,
            description='PostgreSQL async connection URL',
        )
        
        self.validator.register(
            'DB_POOL_SIZE',
            required=False,
            data_type=int,
            default=10,
            description='Connection pool size',
        )
        
        self.validator.register(
            'DB_MAX_OVERFLOW',
            required=False,
            data_type=int,
            default=20,
            description='Max overflow connections',
        )
    
    async def validate(self) -> bool:
        """Validate database configuration"""
        is_valid, errors = await self.validator.validate()
        if not is_valid:
            raise ValueError(f"Database config invalid: {errors}")
        return is_valid


class APIConfig:
    """API configuration"""
    
    def __init__(self):
        """Initialize API config"""
        self.validator = ConfigValidator()
        
        # Register API configs
        self.validator.register(
            'API_HOST',
            required=False,
            data_type=str,
            default='0.0.0.0',
            description='API host address',
        )
        
        self.validator.register(
            'API_PORT',
            required=False,
            data_type=int,
            default=8000,
            description='API port',
        )
        
        self.validator.register(
            'API_WORKERS',
            required=False,
            data_type=int,
            default=4,
            description='Number of worker processes',
        )
        
        self.validator.register(
            'SECRET_KEY',
            required=True,
            data_type=str,
            description='JWT secret key (min 32 chars)',
        )
    
    async def validate(self) -> bool:
        """Validate API configuration"""
        is_valid, errors = await self.validator.validate()
        
        if is_valid:
            secret_key = self.validator.get('SECRET_KEY')
            if len(secret_key) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters")
        
        if not is_valid:
            raise ValueError(f"API config invalid: {errors}")
        
        return is_valid


class BotConfig:
    """Telegram bot configuration"""
    
    def __init__(self):
        """Initialize bot config"""
        self.validator = ConfigValidator()
        
        # Register bot configs
        self.validator.register(
            'BOT_TOKEN',
            required=True,
            data_type=str,
            description='Telegram bot token',
        )
        
        self.validator.register(
            'ADMIN_IDS',
            required=False,
            data_type=str,
            default='',
            description='Comma-separated admin user IDs',
        )
    
    async def validate(self) -> bool:
        """Validate bot configuration"""
        is_valid, errors = await self.validator.validate()
        if not is_valid:
            raise ValueError(f"Bot config invalid: {errors}")
        return is_valid


class ApplicationConfig:
    """Master application configuration"""
    
    def __init__(self):
        """Initialize application config"""
        self.database = DatabaseConfig()
        self.api = APIConfig()
        self.bot = BotConfig()
    
    async def validate_all(self) -> bool:
        """
        Validate all configuration
        
        Returns:
            True if all valid
        """
        try:
            await self.database.validate()
            await self.api.validate()
            await self.bot.validate()
            return True
        except ValueError as e:
            raise ValueError(f"Configuration validation failed: {e}")
    
    def get_summary(self) -> Dict[str, Dict[str, Any]]:
        """
        Get configuration summary
        
        Returns:
            Summary dictionary
        """
        return {
            'database': self.database.validator.get_summary(),
            'api': self.api.validator.get_summary(),
            'bot': self.bot.validator.get_summary(),
        }


# Global instance
application_config = ApplicationConfig()
