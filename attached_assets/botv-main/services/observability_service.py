#!/usr/bin/env python3
"""
Logging and observability service
Structured logging and distributed tracing support
"""

from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
import json
import logging
import time
from contextlib import asynccontextmanager
from functools import wraps


logger = logging.getLogger(__name__)


class LogLevel(str, Enum):
    """Log levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class EventType(str, Enum):
    """Event types for structured logging"""
    USER_ACTION = "USER_ACTION"
    SYSTEM_EVENT = "SYSTEM_EVENT"
    ERROR_EVENT = "ERROR_EVENT"
    PERFORMANCE_EVENT = "PERFORMANCE_EVENT"
    SECURITY_EVENT = "SECURITY_EVENT"
    AUDIT_EVENT = "AUDIT_EVENT"


class StructuredLogger:
    """Structured logging with context"""
    
    def __init__(self, name: str):
        """
        Initialize structured logger
        
        Args:
            name: Logger name
        """
        self.logger = logging.getLogger(name)
        self.name = name
        self.context_stack: list[Dict[str, Any]] = []
    
    def log_event(
        self,
        event_type: EventType,
        message: str,
        level: LogLevel = LogLevel.INFO,
        **metadata
    ):
        """
        Log structured event
        
        Args:
            event_type: Type of event
            message: Event message
            level: Log level
            metadata: Additional event metadata
        """
        
        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type.value,
            'message': message,
            'metadata': metadata,
        }
        
        # Add context
        if self.context_stack:
            event['context'] = self.context_stack[-1].copy()
        
        log_method = getattr(self.logger, level.value.lower())
        log_method(json.dumps(event))
    
    def log_user_action(
        self,
        action: str,
        user_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        """
        Log user action
        
        Args:
            action: Action description
            user_id: User ID
            details: Action details
        """
        self.log_event(
            EventType.USER_ACTION,
            f"User action: {action}",
            user_id=user_id,
            **(details or {}),
        )
    
    def log_error(
        self,
        error: Exception,
        message: str = "",
        **context
    ):
        """
        Log error
        
        Args:
            error: Exception that occurred
            message: Error message
            context: Error context
        """
        self.log_event(
            EventType.ERROR_EVENT,
            message or str(error),
            level=LogLevel.ERROR,
            error_type=type(error).__name__,
            error_message=str(error),
            **context,
        )
    
    def log_performance(
        self,
        operation: str,
        duration_ms: float,
        **details
    ):
        """
        Log performance metric
        
        Args:
            operation: Operation name
            duration_ms: Duration in milliseconds
            details: Performance details
        """
        status = "slow" if duration_ms > 1000 else "normal"
        self.log_event(
            EventType.PERFORMANCE_EVENT,
            f"Performance: {operation}",
            operation=operation,
            duration_ms=duration_ms,
            status=status,
            **details,
        )
    
    def log_security_event(
        self,
        event: str,
        severity: str = "INFO",
        **details
    ):
        """
        Log security event
        
        Args:
            event: Security event description
            severity: Event severity (LOW, MEDIUM, HIGH, CRITICAL)
            details: Event details
        """
        self.log_event(
            EventType.SECURITY_EVENT,
            f"Security event: {event}",
            level=LogLevel[severity],
            severity=severity,
            **details,
        )
    
    @asynccontextmanager
    async def operation_context(
        self,
        operation_name: str,
        **context_data
    ):
        """
        Context manager for operation tracing
        
        Args:
            operation_name: Name of operation
            context_data: Context data to include
            
        Usage:
            async with logger.operation_context("get_user", user_id=123):
                # Operation code here
        """
        
        context = {
            'operation': operation_name,
            'started_at': datetime.utcnow().isoformat(),
            **context_data,
        }
        
        self.context_stack.append(context)
        start_time = time.time()
        
        try:
            self.log_event(
                EventType.SYSTEM_EVENT,
                f"Operation started: {operation_name}",
                **context_data,
            )
            yield
        except Exception as e:
            self.log_error(e, f"Operation failed: {operation_name}")
            raise
        finally:
            elapsed = (time.time() - start_time) * 1000
            self.context_stack.pop()
            
            self.log_event(
                EventType.SYSTEM_EVENT,
                f"Operation completed: {operation_name}",
                duration_ms=elapsed,
            )
    
    def add_context(self, **context_data):
        """
        Add data to current context
        
        Args:
            context_data: Data to add to context
        """
        if self.context_stack:
            self.context_stack[-1].update(context_data)


class PerformanceMonitor:
    """Monitor and track performance metrics"""
    
    def __init__(self):
        """Initialize performance monitor"""
        self.metrics: Dict[str, list[float]] = {}
    
    def record_metric(self, metric_name: str, value: float):
        """
        Record performance metric
        
        Args:
            metric_name: Name of metric
            value: Metric value
        """
        if metric_name not in self.metrics:
            self.metrics[metric_name] = []
        
        self.metrics[metric_name].append(value)
        
        # Keep only last 1000 measurements
        if len(self.metrics[metric_name]) > 1000:
            self.metrics[metric_name] = self.metrics[metric_name][-1000:]
    
    def get_statistics(self, metric_name: str) -> Dict[str, float]:
        """
        Get statistics for metric
        
        Args:
            metric_name: Metric name
            
        Returns:
            Statistics dictionary with min, max, avg
        """
        values = self.metrics.get(metric_name, [])
        
        if not values:
            return {
                'metric': metric_name,
                'count': 0,
                'min': 0,
                'max': 0,
                'avg': 0,
            }
        
        return {
            'metric': metric_name,
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'avg': sum(values) / len(values),
        }
    
    def get_all_statistics(self) -> Dict[str, Dict[str, float]]:
        """
        Get statistics for all metrics
        
        Returns:
            Dictionary of all metric statistics
        """
        return {
            metric: self.get_statistics(metric)
            for metric in self.metrics.keys()
        }


class MetricsCollector:
    """Collect system metrics"""
    
    def __init__(self):
        """Initialize metrics collector"""
        self.counters: Dict[str, int] = {}
        self.gauges: Dict[str, float] = {}
        self.histograms: Dict[str, list[float]] = {}
    
    def increment_counter(self, name: str, value: int = 1):
        """
        Increment counter
        
        Args:
            name: Counter name
            value: Value to increment by
        """
        self.counters[name] = self.counters.get(name, 0) + value
    
    def set_gauge(self, name: str, value: float):
        """
        Set gauge value
        
        Args:
            name: Gauge name
            value: Value to set
        """
        self.gauges[name] = value
    
    def record_histogram(self, name: str, value: float):
        """
        Record histogram value
        
        Args:
            name: Histogram name
            value: Value to record
        """
        if name not in self.histograms:
            self.histograms[name] = []
        
        self.histograms[name].append(value)
        
        # Keep only last 1000 values
        if len(self.histograms[name]) > 1000:
            self.histograms[name] = self.histograms[name][-1000:]
    
    def get_metrics_snapshot(self) -> Dict[str, Any]:
        """
        Get current metrics snapshot
        
        Returns:
            Dictionary of all metrics
        """
        histograms_summary = {}
        for name, values in self.histograms.items():
            if values:
                histograms_summary[name] = {
                    'count': len(values),
                    'min': min(values),
                    'max': max(values),
                    'avg': sum(values) / len(values),
                }
        
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'counters': self.counters.copy(),
            'gauges': self.gauges.copy(),
            'histograms': histograms_summary,
        }


def log_performance(logger: StructuredLogger):
    """
    Decorator for logging function performance
    
    Args:
        logger: StructuredLogger instance
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                elapsed = (time.time() - start) * 1000
                logger.log_performance(
                    func.__name__,
                    elapsed,
                    args_count=len(args),
                    kwargs_count=len(kwargs),
                )
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                elapsed = (time.time() - start) * 1000
                logger.log_performance(
                    func.__name__,
                    elapsed,
                    args_count=len(args),
                    kwargs_count=len(kwargs),
                )
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# Global instances
observability_logger = StructuredLogger('observability')
performance_monitor = PerformanceMonitor()
metrics_collector = MetricsCollector()
