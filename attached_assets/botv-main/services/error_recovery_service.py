#!/usr/bin/env python3
"""
Error handling and recovery service
Graceful degradation and automatic recovery mechanisms
"""

from typing import Dict, Any, Optional, Callable, Coroutine
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession


logger = logging.getLogger(__name__)


class RecoveryStrategy(str, Enum):
    """Error recovery strategies"""
    RETRY = "RETRY"
    FALLBACK = "FALLBACK"
    DEGRADE = "DEGRADE"
    CIRCUIT_BREAK = "CIRCUIT_BREAK"


class CircuitBreaker:
    """Circuit breaker for failing services"""
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.is_open = False
    
    async def call(
        self,
        func: Callable[..., Coroutine],
        *args,
        **kwargs
    ) -> Any:
        """
        Call function through circuit breaker
        
        Args:
            func: Async function to call
            args: Function arguments
            kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            RuntimeError: If circuit is open
        """
        
        # Check if circuit should recover
        if self.is_open:
            if self._should_attempt_reset():
                self.is_open = False
                self.failure_count = 0
                logger.info(f"Circuit breaker {self.name} attempting reset")
            else:
                raise RuntimeError(f"Circuit breaker {self.name} is open")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    def _on_success(self):
        """Record successful call"""
        self.failure_count = 0
        self.is_open = False
    
    def _on_failure(self):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failure_count >= self.failure_threshold:
            self.is_open = True
            logger.warning(
                f"Circuit breaker {self.name} opened "
                f"({self.failure_count} failures)"
            )
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if not self.last_failure_time:
            return True
        
        elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout


class ErrorRecoveryService:
    """Service for error handling and recovery"""
    
    def __init__(self):
        """Initialize recovery service"""
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.error_logs: Dict[str, list] = {}
    
    def create_circuit_breaker(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
    ) -> CircuitBreaker:
        """
        Create or get circuit breaker
        
        Args:
            name: Circuit breaker name
            failure_threshold: Failures before opening
            recovery_timeout: Seconds before attempting reset
            
        Returns:
            CircuitBreaker instance
        """
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
            )
        
        return self.circuit_breakers[name]
    
    async def retry_with_backoff(
        self,
        func: Callable[..., Coroutine],
        max_retries: int = 3,
        initial_delay: int = 1,
        backoff_multiplier: float = 2.0,
        *args,
        **kwargs
    ) -> Any:
        """
        Call function with exponential backoff retry
        
        Args:
            func: Async function to call
            max_retries: Maximum retry attempts
            initial_delay: Initial delay in seconds
            backoff_multiplier: Multiply delay each retry
            args: Function arguments
            kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            Exception: Last exception if all retries fail
        """
        
        delay = initial_delay
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                
                if attempt < max_retries:
                    logger.warning(
                        f"Attempt {attempt + 1}/{max_retries + 1} failed, "
                        f"retrying in {delay}s: {e}"
                    )
                    await asyncio.sleep(delay)
                    delay *= backoff_multiplier
                else:
                    logger.error(
                        f"All {max_retries + 1} attempts failed: {e}"
                    )
        
        raise last_exception
    
    def log_error(
        self,
        service_name: str,
        error_type: str,
        details: Dict[str, Any],
    ):
        """
        Log error for monitoring
        
        Args:
            service_name: Name of service that errored
            error_type: Type of error
            details: Error details dictionary
        """
        
        if service_name not in self.error_logs:
            self.error_logs[service_name] = []
        
        error_record = {
            'timestamp': datetime.utcnow().isoformat(),
            'error_type': error_type,
            'details': details,
        }
        
        self.error_logs[service_name].append(error_record)
        
        # Keep only last 100 errors per service
        if len(self.error_logs[service_name]) > 100:
            self.error_logs[service_name] = self.error_logs[service_name][-100:]
    
    def get_error_summary(self, service_name: str) -> Dict[str, Any]:
        """
        Get error summary for service
        
        Args:
            service_name: Service name
            
        Returns:
            Error summary dictionary
        """
        
        errors = self.error_logs.get(service_name, [])
        
        if not errors:
            return {
                'service': service_name,
                'total_errors': 0,
                'recent_errors': [],
            }
        
        # Count by error type
        error_counts = {}
        for error in errors:
            error_type = error['error_type']
            error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        return {
            'service': service_name,
            'total_errors': len(errors),
            'error_types': error_counts,
            'recent_errors': errors[-10:],  # Last 10
        }


class GracefulDegradation:
    """Graceful degradation mechanism"""
    
    def __init__(self):
        """Initialize degradation tracker"""
        self.degraded_features: Dict[str, str] = {}  # feature -> reason
    
    def mark_degraded(self, feature_name: str, reason: str):
        """
        Mark feature as degraded
        
        Args:
            feature_name: Feature that's degraded
            reason: Reason for degradation
        """
        self.degraded_features[feature_name] = reason
        logger.warning(f"Feature degraded: {feature_name} - {reason}")
    
    def mark_recovered(self, feature_name: str):
        """
        Mark feature as recovered
        
        Args:
            feature_name: Feature that recovered
        """
        if feature_name in self.degraded_features:
            del self.degraded_features[feature_name]
            logger.info(f"Feature recovered: {feature_name}")
    
    def is_degraded(self, feature_name: str) -> bool:
        """
        Check if feature is degraded
        
        Args:
            feature_name: Feature name
            
        Returns:
            True if degraded, False otherwise
        """
        return feature_name in self.degraded_features
    
    def get_degradation_status(self) -> Dict[str, Any]:
        """
        Get current degradation status
        
        Returns:
            Degradation status dictionary
        """
        return {
            'degraded_count': len(self.degraded_features),
            'degraded_features': self.degraded_features.copy(),
            'is_degraded': len(self.degraded_features) > 0,
        }


# Global instances
recovery_service = ErrorRecoveryService()
graceful_degradation = GracefulDegradation()


# Pre-create common circuit breakers
DB_CIRCUIT_BREAKER = recovery_service.create_circuit_breaker(
    'database',
    failure_threshold=5,
    recovery_timeout=30,
)

ALGORITHM_CIRCUIT_BREAKER = recovery_service.create_circuit_breaker(
    'algorithm_system',
    failure_threshold=3,
    recovery_timeout=60,
)

NOTIFICATION_CIRCUIT_BREAKER = recovery_service.create_circuit_breaker(
    'notification_system',
    failure_threshold=10,
    recovery_timeout=120,
)
