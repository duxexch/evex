#!/usr/bin/env python3
"""
Security and performance middleware
Request protection, rate limiting, and performance tracking
"""

from typing import Callable
from datetime import datetime
import time
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from services.rate_limiting_service import (
    user_rate_limiter,
    abuse_detector,
    ddos_protection,
    RateLimitAction,
)
from services.observability_service import (
    metrics_collector,
    observability_logger,
    EventType,
)


logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request with rate limiting
        
        Args:
            request: HTTP request
            call_next: Next middleware/handler
            
        Returns:
            HTTP response
        """
        client_ip = request.client.host if request.client else "unknown"
        
        # Check DDoS protection
        allowed, reason = ddos_protection.is_allowed(client_ip)
        if not allowed:
            metrics_collector.increment_counter('ddos_blocked')
            return JSONResponse(
                status_code=429,
                content={"error": "Too many requests"},
            )
        
        # Get user ID if authenticated
        user_id = request.headers.get("X-User-ID")
        
        if user_id:
            try:
                user_id = int(user_id)
                
                # Check per-user rate limit
                action = user_rate_limiter.allow_request(user_id)
                
                if action == RateLimitAction.REJECT:
                    metrics_collector.increment_counter('rate_limit_rejected')
                    return JSONResponse(
                        status_code=429,
                        content={"error": "Rate limit exceeded"},
                    )
                
                # Record user event for abuse detection
                abuse_detector.record_event(user_id)
                
                if abuse_detector.is_abuser(user_id):
                    reason = abuse_detector.get_abuse_reason(user_id)
                    metrics_collector.increment_counter('abuse_blocked')
                    logger.warning(f"Abuse detected for user {user_id}: {reason}")
                    return JSONResponse(
                        status_code=403,
                        content={"error": "Account flagged for abuse"},
                    )
            
            except (ValueError, TypeError):
                pass  # Invalid user ID header
        
        response = await call_next(request)
        return response


class PerformanceTrackingMiddleware(BaseHTTPMiddleware):
    """Track request performance"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and track performance
        
        Args:
            request: HTTP request
            call_next: Next middleware/handler
            
        Returns:
            HTTP response
        """
        start_time = time.time()
        
        # Extract useful context
        method = request.method
        path = request.url.path
        
        try:
            response = await call_next(request)
            
            # Record metrics
            elapsed = (time.time() - start_time) * 1000
            status_code = response.status_code
            
            metrics_collector.record_histogram(f'request_duration_ms_{method}_{path}', elapsed)
            metrics_collector.increment_counter(f'request_count_{status_code}')
            
            # Log slow requests
            if elapsed > 1000:
                observability_logger.log_performance(
                    f"{method} {path}",
                    elapsed,
                    status_code=status_code,
                )
            
            return response
        
        except Exception as e:
            elapsed = (time.time() - start_time) * 1000
            metrics_collector.increment_counter('request_errors')
            
            observability_logger.log_error(
                e,
                f"Request error: {method} {path}",
                duration_ms=elapsed,
            )
            
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Add security headers to response
        
        Args:
            request: HTTP request
            call_next: Next middleware/handler
            
        Returns:
            HTTP response with security headers
        """
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Log request and response
        
        Args:
            request: HTTP request
            call_next: Next middleware/handler
            
        Returns:
            HTTP response
        """
        client_ip = request.client.host if request.client else "unknown"
        
        observability_logger.log_event(
            EventType.SYSTEM_EVENT,
            f"Incoming request: {request.method} {request.url.path}",
            client_ip=client_ip,
            method=request.method,
            path=request.url.path,
        )
        
        response = await call_next(request)
        
        observability_logger.log_event(
            EventType.SYSTEM_EVENT,
            f"Completed request: {request.method} {request.url.path}",
            status_code=response.status_code,
        )
        
        return response


def setup_middleware(app):
    """
    Setup all middleware
    
    Args:
        app: FastAPI application
    """
    # Order matters: innermost first
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(PerformanceTrackingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
