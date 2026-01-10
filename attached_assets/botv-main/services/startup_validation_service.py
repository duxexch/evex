#!/usr/bin/env python3
"""
Startup validation and initialization
Comprehensive system readiness checks
"""

from typing import Dict, List, Tuple, Any, Optional
import asyncio
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from services.extended_config_schema import (
    get_settings,
    ApplicationSettings,
    EnvironmentMode,
)
from services.deployment_checker_service import deployment_checker
from services.observability_service import observability_logger, EventType


logger = logging.getLogger(__name__)


class StartupValidator:
    """Validate system startup"""
    
    def __init__(self):
        """Initialize startup validator"""
        self.validation_results: Dict[str, Any] = {}
        self.startup_time: Optional[datetime] = None
    
    async def validate_all(
        self,
        session_maker: async_sessionmaker[AsyncSession],
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Run all startup validations
        
        Args:
            session_maker: AsyncSession maker
            
        Returns:
            (all_valid, results) tuple
        """
        self.startup_time = datetime.utcnow()
        self.validation_results = {}
        
        logger.info("Starting comprehensive startup validation...")
        
        observability_logger.log_event(
            EventType.SYSTEM_EVENT,
            "Startup validation begun",
        )
        
        # 1. Configuration validation
        config_valid = await self._validate_configuration()
        self.validation_results['configuration'] = config_valid
        
        if not config_valid['valid']:
            return False, self.validation_results
        
        # 2. Environment validation
        env_valid = await self._validate_environment()
        self.validation_results['environment'] = env_valid
        
        if not env_valid['valid']:
            return False, self.validation_results
        
        # 3. Deployment readiness
        deploy_valid = await self._validate_deployment()
        self.validation_results['deployment'] = deploy_valid
        
        if not deploy_valid['valid']:
            return False, self.validation_results
        
        # 4. Database validation
        db_valid = await self._validate_database(session_maker)
        self.validation_results['database'] = db_valid
        
        if not db_valid['valid']:
            return False, self.validation_results
        
        # 5. Settings validation
        settings_valid = await self._validate_settings()
        self.validation_results['settings'] = settings_valid
        
        all_valid = all(v['valid'] for v in self.validation_results.values())
        
        if all_valid:
            logger.info("All startup validations passed")
            observability_logger.log_event(
                EventType.SYSTEM_EVENT,
                "Startup validation passed",
            )
        else:
            logger.error("Startup validation failed")
            observability_logger.log_event(
                EventType.SYSTEM_EVENT,
                "Startup validation failed",
                failed_checks=[k for k, v in self.validation_results.items() if not v['valid']],
            )
        
        return all_valid, self.validation_results
    
    async def _validate_configuration(self) -> Dict[str, Any]:
        """Validate configuration loading"""
        try:
            settings = get_settings()
            
            if not settings.is_valid():
                errors = settings.validate()
                return {
                    'valid': False,
                    'message': 'Configuration validation failed',
                    'errors': errors,
                }
            
            return {
                'valid': True,
                'message': 'Configuration valid',
                'environment': settings.environment.value,
                'debug': settings.debug,
            }
        except Exception as e:
            logger.error(f"Configuration validation error: {e}")
            return {
                'valid': False,
                'message': f'Configuration error: {str(e)}',
                'errors': [str(e)],
            }
    
    async def _validate_environment(self) -> Dict[str, Any]:
        """Validate environment configuration"""
        try:
            settings = get_settings()
            
            env_errors = settings.validate_environment()
            
            if env_errors:
                return {
                    'valid': False,
                    'message': 'Environment configuration invalid',
                    'errors': env_errors,
                }
            
            return {
                'valid': True,
                'message': 'Environment configuration valid',
                'mode': settings.environment.value,
            }
        except Exception as e:
            logger.error(f"Environment validation error: {e}")
            return {
                'valid': False,
                'message': f'Environment error: {str(e)}',
                'errors': [str(e)],
            }
    
    async def _validate_deployment(self) -> Dict[str, Any]:
        """Validate deployment readiness"""
        try:
            all_pass, results = await deployment_checker.run_all_checks()
            
            if not all_pass:
                failed_checks = [r.name for r in results if r.status.value == 'FAIL']
                return {
                    'valid': False,
                    'message': 'Deployment checks failed',
                    'failed_checks': failed_checks,
                    'details': {r.name: r.message for r in results},
                }
            
            return {
                'valid': True,
                'message': 'All deployment checks passed',
                'checks_passed': len(results),
            }
        except Exception as e:
            logger.error(f"Deployment validation error: {e}")
            return {
                'valid': False,
                'message': f'Deployment check error: {str(e)}',
                'errors': [str(e)],
            }
    
    async def _validate_database(
        self,
        session_maker: async_sessionmaker[AsyncSession],
    ) -> Dict[str, Any]:
        """Validate database connectivity"""
        try:
            async with session_maker() as session:
                result = await session.execute("SELECT 1")
                if result.scalar() is None:
                    raise RuntimeError("Database connection test failed")
            
            return {
                'valid': True,
                'message': 'Database connection valid',
            }
        except Exception as e:
            logger.error(f"Database validation error: {e}")
            return {
                'valid': False,
                'message': f'Database error: {str(e)}',
                'errors': [str(e)],
            }
    
    async def _validate_settings(self) -> Dict[str, Any]:
        """Validate critical settings"""
        try:
            settings = get_settings()
            
            critical_errors = []
            
            # Check required settings
            if not settings.database.url:
                critical_errors.append("DATABASE_URL not configured")
            
            if not settings.api.secret_key:
                critical_errors.append("SECRET_KEY not configured")
            
            if not settings.bot.token:
                critical_errors.append("BOT_TOKEN not configured")
            
            if critical_errors:
                return {
                    'valid': False,
                    'message': 'Critical settings missing',
                    'errors': critical_errors,
                }
            
            return {
                'valid': True,
                'message': 'All critical settings configured',
                'configured_components': {
                    'database': True,
                    'api': True,
                    'bot': True,
                    'logging': settings.logging.enabled if hasattr(settings.logging, 'enabled') else True,
                    'notifications': settings.notification.enabled,
                    'rate_limiting': settings.rate_limit.enabled,
                    'health_checks': settings.health_check.enabled,
                    'audit': settings.audit.enabled,
                },
            }
        except Exception as e:
            logger.error(f"Settings validation error: {e}")
            return {
                'valid': False,
                'message': f'Settings error: {str(e)}',
                'errors': [str(e)],
            }
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get validation summary
        
        Returns:
            Summary dictionary
        """
        valid_count = sum(1 for v in self.validation_results.values() if v['valid'])
        invalid_count = sum(1 for v in self.validation_results.values() if not v['valid'])
        
        elapsed_ms = (
            (datetime.utcnow() - self.startup_time).total_seconds() * 1000
            if self.startup_time else 0
        )
        
        return {
            'overall_valid': all(v['valid'] for v in self.validation_results.values()),
            'valid_count': valid_count,
            'invalid_count': invalid_count,
            'total_count': len(self.validation_results),
            'elapsed_ms': elapsed_ms,
            'results': self.validation_results,
        }


# Global instance
startup_validator = StartupValidator()


async def run_startup_validation(
    session_maker: async_sessionmaker[AsyncSession],
) -> bool:
    """
    Run startup validation and return result
    
    Args:
        session_maker: AsyncSession maker
        
    Returns:
        True if all validations pass, False otherwise
    """
    all_valid, results = await startup_validator.validate_all(session_maker)
    
    summary = startup_validator.get_summary()
    logger.info(f"Startup validation summary: {summary}")
    
    return all_valid
