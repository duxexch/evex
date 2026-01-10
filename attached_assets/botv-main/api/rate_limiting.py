#!/usr/bin/env python3
"""
✅ RATE LIMITING MIDDLEWARE
Protects API from abuse and DoS attacks
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import logging

logger = logging.getLogger(__name__)

# Create limiter instance
limiter = Limiter(key_func=get_remote_address)


def get_rate_limit_error_handler(exc: RateLimitExceeded):
    """
    Custom error handler for rate limit exceeded
    """
    return {
        "detail": "❌ لقد تجاوزت حد الطلبات. يرجى المحاولة لاحقاً.",
        "detail_en": "❌ Rate limit exceeded. Please try again later."
    }


# Predefined rate limit rules
RATE_LIMITS = {
    "default": "100/minute",                    # عام - 100 طلب/دقيقة
    "deposit": "10/hour",                       # إيداع - 10 طلبات/ساعة
    "withdrawal": "10/hour",                    # سحب - 10 طلبات/ساعة
    "login": "5/minute",                        # دخول - 5 محاولات/دقيقة
    "send_message": "30/minute",                # إرسال رسالة - 30/دقيقة
    "get_user": "100/minute",                   # جلب مستخدم - 100/دقيقة
    "list_users": "50/minute",                  # قائمة المستخدمين - 50/دقيقة
    "admin_action": "30/minute",                # إجراء إداري - 30/دقيقة
}
