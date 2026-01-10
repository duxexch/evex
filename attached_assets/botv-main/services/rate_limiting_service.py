#!/usr/bin/env python3
"""
Rate limiting and protection service
Protect against abuse and resource exhaustion
"""

from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import time
from collections import defaultdict


class RateLimitAction(str, Enum):
    """Rate limit actions"""
    ALLOW = "ALLOW"
    DELAY = "DELAY"
    REJECT = "REJECT"


class RateLimiter:
    """Token bucket rate limiter"""
    
    def __init__(
        self,
        name: str,
        capacity: int,
        refill_rate: int,  # tokens per second
        refill_interval: int = 1,  # seconds
    ):
        """
        Initialize rate limiter
        
        Args:
            name: Limiter name
            capacity: Maximum tokens in bucket
            refill_rate: Tokens added per interval
            refill_interval: Interval in seconds
        """
        self.name = name
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.refill_interval = refill_interval
        
        self.tokens = capacity
        self.last_refill = time.time()
    
    def allow_request(self, tokens_required: int = 1) -> RateLimitAction:
        """
        Check if request is allowed
        
        Args:
            tokens_required: Tokens required for request
            
        Returns:
            RateLimitAction indicating what to do
        """
        self._refill()
        
        if self.tokens >= tokens_required:
            self.tokens -= tokens_required
            return RateLimitAction.ALLOW
        
        return RateLimitAction.REJECT
    
    def get_delay_seconds(self, tokens_required: int = 1) -> float:
        """
        Get delay before request allowed
        
        Args:
            tokens_required: Tokens required
            
        Returns:
            Seconds to wait
        """
        self._refill()
        
        if self.tokens >= tokens_required:
            return 0.0
        
        tokens_needed = tokens_required - self.tokens
        refills_needed = (tokens_needed + self.refill_rate - 1) // self.refill_rate
        return refills_needed * self.refill_interval
    
    def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill
        
        refills = int(elapsed / self.refill_interval)
        if refills > 0:
            tokens_to_add = refills * self.refill_rate
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = now


class PerUserRateLimiter:
    """Per-user rate limiter"""
    
    def __init__(
        self,
        name: str,
        capacity: int,
        refill_rate: int,
        refill_interval: int = 1,
    ):
        """
        Initialize per-user rate limiter
        
        Args:
            name: Limiter name
            capacity: Tokens per user
            refill_rate: Tokens per interval
            refill_interval: Interval in seconds
        """
        self.name = name
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.refill_interval = refill_interval
        
        self.limiters: Dict[int, RateLimiter] = {}
    
    def allow_request(
        self,
        user_id: int,
        tokens_required: int = 1,
    ) -> RateLimitAction:
        """
        Check if user request is allowed
        
        Args:
            user_id: User ID
            tokens_required: Tokens required
            
        Returns:
            RateLimitAction
        """
        if user_id not in self.limiters:
            self.limiters[user_id] = RateLimiter(
                f"{self.name}_{user_id}",
                self.capacity,
                self.refill_rate,
                self.refill_interval,
            )
        
        return self.limiters[user_id].allow_request(tokens_required)
    
    def get_delay_seconds(
        self,
        user_id: int,
        tokens_required: int = 1,
    ) -> float:
        """
        Get delay for user
        
        Args:
            user_id: User ID
            tokens_required: Tokens required
            
        Returns:
            Seconds to wait
        """
        if user_id not in self.limiters:
            self.limiters[user_id] = RateLimiter(
                f"{self.name}_{user_id}",
                self.capacity,
                self.refill_rate,
                self.refill_interval,
            )
        
        return self.limiters[user_id].get_delay_seconds(tokens_required)


class AbuseDetector:
    """Detect and track abuse patterns"""
    
    def __init__(self):
        """Initialize abuse detector"""
        self.user_events: Dict[int, list[datetime]] = defaultdict(list)
        self.flagged_users: Dict[int, str] = {}
        self.detection_window = timedelta(minutes=5)
        self.spike_threshold = 50  # Events in window
    
    def record_event(self, user_id: int):
        """
        Record user event
        
        Args:
            user_id: User ID
        """
        now = datetime.utcnow()
        self.user_events[user_id].append(now)
        
        # Clean old events outside window
        cutoff = now - self.detection_window
        self.user_events[user_id] = [
            event for event in self.user_events[user_id]
            if event > cutoff
        ]
        
        # Check for spike
        event_count = len(self.user_events[user_id])
        if event_count > self.spike_threshold:
            self._flag_user(user_id, f"event_spike:{event_count}")
    
    def is_abuser(self, user_id: int) -> bool:
        """
        Check if user is flagged as abuser
        
        Args:
            user_id: User ID
            
        Returns:
            True if flagged
        """
        return user_id in self.flagged_users
    
    def get_abuse_reason(self, user_id: int) -> Optional[str]:
        """
        Get abuse reason for user
        
        Args:
            user_id: User ID
            
        Returns:
            Abuse reason or None
        """
        return self.flagged_users.get(user_id)
    
    def unflag_user(self, user_id: int):
        """
        Remove user from flagged list
        
        Args:
            user_id: User ID
        """
        if user_id in self.flagged_users:
            del self.flagged_users[user_id]
    
    def _flag_user(self, user_id: int, reason: str):
        """
        Flag user as abuser
        
        Args:
            user_id: User ID
            reason: Reason for flagging
        """
        self.flagged_users[user_id] = reason
    
    def get_flagged_count(self) -> int:
        """
        Get count of flagged users
        
        Returns:
            Number of flagged users
        """
        return len(self.flagged_users)
    
    def get_flagged_summary(self) -> Dict[str, any]:
        """
        Get summary of flagged users
        
        Returns:
            Summary dictionary
        """
        reasons = defaultdict(int)
        for reason in self.flagged_users.values():
            reasons[reason] += 1
        
        return {
            'flagged_count': len(self.flagged_users),
            'reasons': dict(reasons),
        }


class DDoSProtection:
    """Protect against DDoS attacks"""
    
    def __init__(self):
        """Initialize DDoS protection"""
        self.request_timestamps: Dict[str, list[datetime]] = defaultdict(list)
        self.blocked_ips: Dict[str, datetime] = {}
        self.request_window = timedelta(minutes=1)
        self.threshold = 100  # Requests per minute
        self.block_duration = timedelta(minutes=15)
    
    def is_allowed(self, client_ip: str) -> Tuple[bool, Optional[str]]:
        """
        Check if request from IP is allowed
        
        Args:
            client_ip: Client IP address
            
        Returns:
            (allowed, reason) tuple
        """
        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            block_end = self.blocked_ips[client_ip]
            if datetime.utcnow() < block_end:
                return False, f"IP blocked until {block_end}"
            else:
                del self.blocked_ips[client_ip]
        
        # Record request
        now = datetime.utcnow()
        self.request_timestamps[client_ip].append(now)
        
        # Clean old requests
        cutoff = now - self.request_window
        self.request_timestamps[client_ip] = [
            ts for ts in self.request_timestamps[client_ip]
            if ts > cutoff
        ]
        
        # Check threshold
        request_count = len(self.request_timestamps[client_ip])
        if request_count > self.threshold:
            self.blocked_ips[client_ip] = now + self.block_duration
            return False, "Too many requests"
        
        return True, None
    
    def get_blocked_ips(self) -> Dict[str, str]:
        """
        Get currently blocked IPs
        
        Returns:
            Dictionary of blocked IPs
        """
        now = datetime.utcnow()
        active_blocks = {}
        
        for ip, block_end in self.blocked_ips.items():
            if block_end > now:
                active_blocks[ip] = block_end.isoformat()
        
        return active_blocks
    
    def unblock_ip(self, client_ip: str):
        """
        Unblock IP
        
        Args:
            client_ip: IP to unblock
        """
        if client_ip in self.blocked_ips:
            del self.blocked_ips[client_ip]


# Global instances
user_rate_limiter = PerUserRateLimiter(
    'default_user',
    capacity=100,
    refill_rate=10,
    refill_interval=1,
)

api_rate_limiter = PerUserRateLimiter(
    'api_user',
    capacity=1000,
    refill_rate=100,
    refill_interval=1,
)

abuse_detector = AbuseDetector()
ddos_protection = DDoSProtection()
