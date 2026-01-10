#!/usr/bin/env python3
"""
Health check service for production monitoring
Comprehensive system health verification and reporting
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text


class HealthStatus(str, Enum):
    """Health check status"""
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNHEALTHY = "UNHEALTHY"


class ComponentHealth:
    """Health status of a single component"""
    
    def __init__(
        self,
        name: str,
        status: HealthStatus,
        response_time_ms: float,
        last_check: datetime,
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ):
        self.name = name
        self.status = status
        self.response_time_ms = response_time_ms
        self.last_check = last_check
        self.details = details or {}
        self.error_message = error_message
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'name': self.name,
            'status': self.status.value,
            'response_time_ms': round(self.response_time_ms, 2),
            'last_check': self.last_check.isoformat(),
            'details': self.details,
            'error': self.error_message,
        }


class HealthCheckService:
    """Service for comprehensive health checking"""
    
    def __init__(self, session_maker):
        """Initialize with session maker"""
        self.session_maker = session_maker
        self.checks = {}
        self.last_full_check = None
    
    async def check_database(self, session: AsyncSession) -> ComponentHealth:
        """Check database connectivity and performance"""
        start = datetime.utcnow()
        try:
            # Test query
            result = await session.execute(text("SELECT 1"))
            result.scalar()
            
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            
            # Check if response time is acceptable (<100ms)
            if response_time > 100:
                status = HealthStatus.DEGRADED
            else:
                status = HealthStatus.HEALTHY
            
            return ComponentHealth(
                name='database',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                details={'query_time_ms': round(response_time, 2)}
            )
        except Exception as e:
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            return ComponentHealth(
                name='database',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                error_message=str(e)
            )
    
    async def check_algorithm_system(self, session: AsyncSession) -> ComponentHealth:
        """Check algorithm system health"""
        start = datetime.utcnow()
        try:
            from services.game_algorithm_manager import GameAlgorithmManager
            
            # Try to get algorithm
            algo, is_fallback = await GameAlgorithmManager.get_algorithm(session)
            
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            
            status = HealthStatus.HEALTHY if algo else HealthStatus.UNHEALTHY
            
            return ComponentHealth(
                name='algorithm_system',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                details={
                    'algorithm': algo.name if algo else None,
                    'fallback_used': is_fallback,
                }
            )
        except Exception as e:
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            return ComponentHealth(
                name='algorithm_system',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                error_message=str(e)
            )
    
    async def check_notification_system(self, session: AsyncSession) -> ComponentHealth:
        """Check notification system health"""
        start = datetime.utcnow()
        try:
            from models import Outbox, OutboxStatus
            from sqlalchemy import func
            
            # Count pending notifications
            pending_query = select(func.count(Outbox.id)).where(
                Outbox.status == OutboxStatus.PENDING
            )
            result = await session.execute(pending_query)
            pending_count = result.scalar() or 0
            
            # Count failed notifications
            failed_query = select(func.count(Outbox.id)).where(
                Outbox.status == OutboxStatus.FAILED
            )
            result = await session.execute(failed_query)
            failed_count = result.scalar() or 0
            
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            
            # Degraded if too many pending or failed
            if pending_count > 100 or failed_count > 10:
                status = HealthStatus.DEGRADED
            else:
                status = HealthStatus.HEALTHY
            
            return ComponentHealth(
                name='notification_system',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                details={
                    'pending_notifications': pending_count,
                    'failed_notifications': failed_count,
                }
            )
        except Exception as e:
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            return ComponentHealth(
                name='notification_system',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                error_message=str(e)
            )
    
    async def check_audit_system(self, session: AsyncSession) -> ComponentHealth:
        """Check audit logging system health"""
        start = datetime.utcnow()
        try:
            from models import AuditLog
            from sqlalchemy import func
            
            # Count recent audit logs
            recent_query = select(func.count(AuditLog.id)).where(
                AuditLog.created_at >= datetime.utcnow() - timedelta(hours=1)
            )
            result = await session.execute(recent_query)
            recent_count = result.scalar() or 0
            
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            
            return ComponentHealth(
                name='audit_system',
                status=HealthStatus.HEALTHY,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                details={'recent_audit_logs_1h': recent_count}
            )
        except Exception as e:
            response_time = (datetime.utcnow() - start).total_seconds() * 1000
            return ComponentHealth(
                name='audit_system',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                error_message=str(e)
            )
    
    async def full_health_check(self) -> Dict[str, Any]:
        """Run comprehensive health check"""
        start = datetime.utcnow()
        
        async with self.session_maker() as session:
            checks = {
                'database': await self.check_database(session),
                'algorithm_system': await self.check_algorithm_system(session),
                'notification_system': await self.check_notification_system(session),
                'audit_system': await self.check_audit_system(session),
            }
        
        total_time = (datetime.utcnow() - start).total_seconds() * 1000
        
        # Determine overall status
        statuses = [c.status for c in checks.values()]
        if HealthStatus.UNHEALTHY in statuses:
            overall_status = HealthStatus.UNHEALTHY
        elif HealthStatus.DEGRADED in statuses:
            overall_status = HealthStatus.DEGRADED
        else:
            overall_status = HealthStatus.HEALTHY
        
        self.last_full_check = datetime.utcnow()
        
        return {
            'status': overall_status.value,
            'timestamp': datetime.utcnow().isoformat(),
            'total_check_time_ms': round(total_time, 2),
            'components': {name: check.to_dict() for name, check in checks.items()},
        }
    
    async def liveness_check(self) -> bool:
        """Quick liveness check (is service running?)"""
        try:
            async with self.session_maker() as session:
                await session.execute(text("SELECT 1"))
            return True
        except:
            return False
    
    async def readiness_check(self) -> bool:
        """Readiness check (is service ready to accept traffic?)"""
        try:
            health = await self.full_health_check()
            return health['status'] in [HealthStatus.HEALTHY.value, HealthStatus.DEGRADED.value]
        except:
            return False
