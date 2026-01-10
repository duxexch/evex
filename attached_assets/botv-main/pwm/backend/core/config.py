import os
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    api_title: str = os.getenv("PWM_API_TITLE", "PWM API")
    api_version: str = os.getenv("PWM_API_VERSION", "1.0.0")
    api_port: int = int(os.getenv("PWM_API_PORT", "8011"))
    environment: str = os.getenv("PWM_ENV", "development")
    
    # Database
    database_url: str = os.getenv(
        "PWM_DATABASE_URL",
        "postgresql+asyncpg://pwm_user:pwm_password@localhost:5432/pwm_db"
    )
    
    # JWT
    jwt_secret_key: str = os.getenv(
        "JWT_SECRET_KEY",
        "your-super-secret-key-change-in-production-at-least-32-characters-long"
    )
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expiration_hours: int = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    
    # CORS
    cors_origins: list = [
        "http://localhost:3012",
        "http://localhost:3001",
        "http://pwm-web:3012",
        "http://localhost"
    ]
    
    # Logging
    log_level: str = os.getenv("PWM_LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env.pwm"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
