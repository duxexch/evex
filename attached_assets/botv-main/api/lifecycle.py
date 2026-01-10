#!/usr/bin/env python3
"""
Application lifecycle hooks
Startup validation and graceful shutdown
"""

from typing import Optional, List
import asyncio
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from services.deployment_checker_service import deployment_checker
from services.health_check_service import HealthCheckService
from services.observability_service import observability_logger, EventType
from services.error_recovery_service import recovery_service


logger = logging.getLogger(__name__)


class ApplicationLifecycle:
    """Manage application startup and shutdown"""
    
    def __init__(self):
        """Initialize lifecycle manager"""
        self.startup_time: Optional[datetime] = None
        self.is_healthy = False
        self.checks_passed: List[str] = []
        self.checks_failed: List[str] = []
    
    async def on_startup(self, session_maker: async_sessionmaker[AsyncSession]):
        """
        Execute startup sequence
        
        Args:
            session_maker: AsyncSession maker
        """
        self.startup_time = datetime.utcnow()
        logger.info("Starting application startup sequence...")
        
        observability_logger.log_event(
            EventType.SYSTEM_EVENT,
            "Application startup begun",
        )
        
        try:
            # Run deployment checks
            all_pass, results = await deployment_checker.run_all_checks()
            
            for result in results:
                logger.info(f"Check {result.name}: {result.status.value}")
                if result.status.value == "PASS":
                    self.checks_passed.append(result.name)
                else:
                    if result.status.value == "FAIL":
                        self.checks_failed.append(result.name)
            
            if not all_pass:
                logger.warning(f"Startup checks failed: {self.checks_failed}")
                observability_logger.log_event(
                    EventType.SYSTEM_EVENT,
                    "Startup checks failed",
                    failed_checks=self.checks_failed,
                )
                self.is_healthy = False
                return
            
            # Initialize health check service
            health_service = HealthCheckService(session_maker)
            health = await health_service.full_health_check()
            
            logger.info(f"Health check result: {health['status']}")
            
            if health['status'] == "UNHEALTHY":
                logger.error("System unhealthy at startup")
                self.is_healthy = False
                return
            
            self.is_healthy = True
            
            observability_logger.log_event(
                EventType.SYSTEM_EVENT,
                "Application startup complete",
                startup_time_ms=(datetime.utcnow() - self.startup_time).total_seconds() * 1000,
                checks_passed_count=len(self.checks_passed),
            )
            
            logger.info("Application startup complete")
        
        except Exception as e:
            logger.error(f"Startup failed: {e}")
            observability_logger.log_error(
                e,
                "Application startup error",
                phase="startup",
            )
            self.is_healthy = False
            raise
    
    async def on_shutdown(self):
        """Execute shutdown sequence"""
        logger.info("Starting application shutdown sequence...")
        
        observability_logger.log_event(
            EventType.SYSTEM_EVENT,
            "Application shutdown begun",
            uptime_seconds=(
                (datetime.utcnow() - self.startup_time).total_seconds()
                if self.startup_time else None
            ),
        )
        
        try:
            # Close circuit breakers gracefully
            for cb_name, cb in recovery_service.circuit_breakers.items():
                logger.info(f"Circuit breaker {cb_name}: failures={cb.failure_count}, open={cb.is_open}")
            
            # Wait for pending operations
            await asyncio.sleep(0.5)
            
            observability_logger.log_event(
                EventType.SYSTEM_EVENT,
                "Application shutdown complete",
            )
            
            logger.info("Application shutdown complete")
        
        except Exception as e:
            logger.error(f"Shutdown error: {e}")
            observability_logger.log_error(e, "Application shutdown error")


# Global instance
application_lifecycle = ApplicationLifecycle()


async def setup_lifespan(session_maker: async_sessionmaker[AsyncSession]):
    """
    Setup application lifespan events
    
    Args:
        session_maker: AsyncSession maker
        
    Use in FastAPI:
        @app.on_event("startup")
        async def startup():
            await setup_lifespan(session_maker)
    """
    await application_lifecycle.on_startup(session_maker)
