#!/usr/bin/env python3
"""
Deployment readiness checks
Validate system state for safe deployment
"""

from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass
from enum import Enum
import os
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker


class CheckStatus(str, Enum):
    """Check status"""
    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"


@dataclass
class CheckResult:
    """Single check result"""
    name: str
    status: CheckStatus
    message: str
    details: Dict[str, Any]


class DeploymentChecker:
    """Perform deployment readiness checks"""
    
    def __init__(self):
        """Initialize deployment checker"""
        self.results: List[CheckResult] = []
    
    async def run_all_checks(self) -> Tuple[bool, List[CheckResult]]:
        """
        Run all deployment checks
        
        Returns:
            (all_pass, results) tuple
        """
        self.results = []
        
        # Environment checks
        await self._check_environment_variables()
        
        # Configuration checks
        await self._check_configuration()
        
        # Database checks
        await self._check_database()
        
        # Dependency checks
        await self._check_dependencies()
        
        # Security checks
        await self._check_security()
        
        all_pass = all(r.status != CheckStatus.FAIL for r in self.results)
        return all_pass, self.results
    
    async def _check_environment_variables(self):
        """Check required environment variables"""
        required_vars = [
            'DATABASE_URL',
            'BOT_TOKEN',
            'SECRET_KEY',
            'API_HOST',
            'API_PORT',
        ]
        
        missing = []
        for var in required_vars:
            if not os.getenv(var):
                missing.append(var)
        
        if missing:
            self.results.append(CheckResult(
                name='environment_variables',
                status=CheckStatus.FAIL,
                message=f"Missing required environment variables: {', '.join(missing)}",
                details={'missing': missing},
            ))
        else:
            self.results.append(CheckResult(
                name='environment_variables',
                status=CheckStatus.PASS,
                message='All required environment variables present',
                details={'checked_count': len(required_vars)},
            ))
    
    async def _check_configuration(self):
        """Check configuration files"""
        config_files = [
            'config.py',
            'models.py',
        ]
        
        missing = []
        for config_file in config_files:
            if not os.path.exists(f'/workspaces/TaskFlowAI-/{config_file}'):
                missing.append(config_file)
        
        if missing:
            self.results.append(CheckResult(
                name='configuration_files',
                status=CheckStatus.FAIL,
                message=f"Missing configuration files: {', '.join(missing)}",
                details={'missing': missing},
            ))
        else:
            self.results.append(CheckResult(
                name='configuration_files',
                status=CheckStatus.PASS,
                message='All required configuration files present',
                details={'checked_count': len(config_files)},
            ))
    
    async def _check_database(self):
        """Check database connectivity"""
        db_url = os.getenv('DATABASE_URL')
        
        if not db_url:
            self.results.append(CheckResult(
                name='database_connectivity',
                status=CheckStatus.FAIL,
                message='DATABASE_URL not configured',
                details={},
            ))
            return
        
        try:
            engine = create_async_engine(db_url, echo=False)
            
            # Test connection
            async with engine.connect() as connection:
                await connection.execute(__import__('sqlalchemy').text('SELECT 1'))
            
            await engine.dispose()
            
            self.results.append(CheckResult(
                name='database_connectivity',
                status=CheckStatus.PASS,
                message='Database connection successful',
                details={'url': db_url.split('@')[0] + '@...'},
            ))
        except Exception as e:
            self.results.append(CheckResult(
                name='database_connectivity',
                status=CheckStatus.FAIL,
                message=f'Database connection failed: {str(e)}',
                details={'error': str(e)},
            ))
    
    async def _check_dependencies(self):
        """Check Python dependencies"""
        required_packages = [
            'aiogram',
            'fastapi',
            'sqlalchemy',
            'pydantic',
            'asyncpg',
        ]
        
        missing = []
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
            except ImportError:
                missing.append(package)
        
        if missing:
            self.results.append(CheckResult(
                name='python_dependencies',
                status=CheckStatus.WARN,
                message=f"Missing Python dependencies: {', '.join(missing)}",
                details={'missing': missing},
            ))
        else:
            self.results.append(CheckResult(
                name='python_dependencies',
                status=CheckStatus.PASS,
                message='All required Python dependencies installed',
                details={'checked_count': len(required_packages)},
            ))
    
    async def _check_security(self):
        """Check security configuration"""
        issues = []
        
        secret_key = os.getenv('SECRET_KEY')
        if not secret_key or len(secret_key) < 32:
            issues.append('SECRET_KEY too short or missing')
        
        api_host = os.getenv('API_HOST')
        if api_host and api_host in ['127.0.0.1', 'localhost']:
            issues.append('API_HOST should not be localhost in production')
        
        if issues:
            self.results.append(CheckResult(
                name='security_configuration',
                status=CheckStatus.WARN,
                message='Security configuration warnings',
                details={'issues': issues},
            ))
        else:
            self.results.append(CheckResult(
                name='security_configuration',
                status=CheckStatus.PASS,
                message='Security configuration appears sound',
                details={},
            ))
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get check results summary
        
        Returns:
            Summary dictionary
        """
        total = len(self.results)
        passed = sum(1 for r in self.results if r.status == CheckStatus.PASS)
        warned = sum(1 for r in self.results if r.status == CheckStatus.WARN)
        failed = sum(1 for r in self.results if r.status == CheckStatus.FAIL)
        
        overall_status = "READY" if failed == 0 else "NOT_READY"
        
        return {
            'overall_status': overall_status,
            'total_checks': total,
            'passed': passed,
            'warned': warned,
            'failed': failed,
            'results': [
                {
                    'name': r.name,
                    'status': r.status.value,
                    'message': r.message,
                    'details': r.details,
                }
                for r in self.results
            ],
        }


class MigrationValidator:
    """Validate database migrations"""
    
    def __init__(self, db_url: str):
        """
        Initialize migration validator
        
        Args:
            db_url: Database URL
        """
        self.db_url = db_url
    
    async def check_migrations_applied(self) -> Tuple[bool, List[str]]:
        """
        Check if migrations have been applied
        
        Returns:
            (all_applied, pending_migrations) tuple
        """
        # This would integrate with Alembic
        # For now, return success
        return True, []
    
    async def validate_schema(self) -> Tuple[bool, List[str]]:
        """
        Validate database schema matches models
        
        Returns:
            (schema_valid, issues) tuple
        """
        # This would validate schema against SQLAlchemy models
        # For now, return success
        return True, []


class HealthCheckValidator:
    """Validate health check endpoints"""
    
    async def check_liveness_endpoint(
        self,
        base_url: str,
    ) -> Tuple[bool, str]:
        """
        Check liveness endpoint
        
        Args:
            base_url: API base URL
            
        Returns:
            (working, status_message) tuple
        """
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f'{base_url}/health/live') as resp:
                    if resp.status == 200:
                        return True, "Liveness endpoint working"
                    else:
                        return False, f"Liveness endpoint returned {resp.status}"
        except Exception as e:
            return False, f"Liveness check failed: {str(e)}"
    
    async def check_readiness_endpoint(
        self,
        base_url: str,
    ) -> Tuple[bool, str]:
        """
        Check readiness endpoint
        
        Args:
            base_url: API base URL
            
        Returns:
            (working, status_message) tuple
        """
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f'{base_url}/health/ready') as resp:
                    if resp.status == 200:
                        return True, "Readiness endpoint working"
                    else:
                        return False, f"Readiness endpoint returned {resp.status}"
        except Exception as e:
            return False, f"Readiness check failed: {str(e)}"


# Global instance
deployment_checker = DeploymentChecker()
