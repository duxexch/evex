#!/usr/bin/env python3
"""
SystemSettings Service - Dynamic configuration management
Handles reading, updating, and caching of all system settings
"""

from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import SystemSettings, AuditLog


class SettingKey:
    """Centralized definition of all setting keys"""
    
    # ✅ Agent Distribution Settings
    AGENT_DISTRIBUTION_MODE = "agent_distribution_mode"  # MANUAL, AUTO_ROUND_ROBIN, AUTO_LOAD_BASED
    AGENT_DISTRIBUTION_ENABLED = "agent_distribution_enabled"  # bool: feature flag
    AGENT_RR_POINTER = "agent_rr_pointer"  # int: current round-robin index
    AGENT_LOAD_METHOD = "agent_load_calculation_method"  # PENDING_COUNT, TIME_WINDOW, WEIGHTED
    AGENT_LOAD_WEIGHT_PENDING = "agent_load_weight_pending"  # float: multiplier
    AGENT_LOAD_TIME_WINDOW_MINUTES = "agent_load_time_window_minutes"  # int
    
    # ✅ Game Algorithm Settings
    GAME_ALGORITHM_MODE = "game_algorithm_mode"  # FIXED_HOUSE_EDGE, DYNAMIC
    GAME_ALGORITHMS_ENABLED = "game_algorithms_enabled"  # bool: feature flag
    HOUSE_EDGE_PERCENTAGE = "house_edge_percentage"  # float: 0.0-100.0
    MAX_PAYOUT_MULTIPLIER = "max_payout_multiplier"  # float: max payout
    RTP_TARGET = "rtp_target"  # float: Return to Player percentage
    
    # ✅ Feature Flags (Gradual Rollout)
    FEATURE_AUTO_ROUND_ROBIN_ENABLED = "feature_auto_round_robin_enabled"
    FEATURE_AUTO_LOAD_BASED_ENABLED = "feature_auto_load_based_enabled"
    FEATURE_DYNAMIC_ALGORITHM_ENABLED = "feature_dynamic_algorithm_enabled"


class SystemSettingsService:
    """Service for managing system-wide configuration"""
    
    # In-memory cache (TTL: 5 minutes)
    _cache: Dict[str, tuple[Any, datetime]] = {}
    CACHE_TTL_SECONDS = 300
    
    @staticmethod
    async def get_setting(
        session: AsyncSession,
        key: str,
        default: Any = None,
        use_cache: bool = True
    ) -> Any:
        """
        Get a setting value
        
        Args:
            session: Database session
            key: Setting key
            default: Default value if not found
            use_cache: Use in-memory cache
            
        Returns:
            Parsed setting value or default
        """
        
        # Check cache first
        if use_cache and key in SystemSettingsService._cache:
            value, cached_at = SystemSettingsService._cache[key]
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            if age < SystemSettingsService.CACHE_TTL_SECONDS:
                return value
        
        # Query database
        query = select(SystemSettings).where(SystemSettings.key == key)
        result = await session.execute(query)
        setting = result.scalar_one_or_none()
        
        if setting is None:
            return default
        
        # Parse value based on data_type
        parsed_value = SystemSettingsService._parse_value(setting.value, setting.data_type)
        
        # Cache it
        if use_cache:
            SystemSettingsService._cache[key] = (parsed_value, datetime.now(timezone.utc))
        
        return parsed_value
    
    @staticmethod
    async def set_setting(
        session: AsyncSession,
        key: str,
        value: Any,
        category: Optional[str] = None,
        description: Optional[str] = None,
        data_type: Optional[str] = None,
        admin_id: Optional[int] = None,
    ) -> SystemSettings:
        """
        Set a setting value (create or update)
        
        Args:
            session: Database session
            key: Setting key
            value: New value
            category: Setting category
            description: Setting description
            data_type: Type hint (string, int, float, bool, enum)
            admin_id: Admin who made the change
            
        Returns:
            Updated SystemSettings object
        """
        
        query = select(SystemSettings).where(SystemSettings.key == key)
        result = await session.execute(query)
        setting = result.scalar_one_or_none()
        
        # Convert value to string for storage
        str_value = str(value)
        
        if setting:
            # Update
            setting.value = str_value
            setting.updated_at = datetime.now(timezone.utc)
            setting.updated_by_admin_id = admin_id
            if category:
                setting.category = category
            if description:
                setting.description = description
            if data_type:
                setting.data_type = data_type
        else:
            # Create
            setting = SystemSettings(
                key=key,
                value=str_value,
                category=category,
                description=description,
                data_type=data_type or 'string',
                updated_by_admin_id=admin_id,
            )
            session.add(setting)
        
        await session.flush()
        
        # Invalidate cache
        if key in SystemSettingsService._cache:
            del SystemSettingsService._cache[key]
        
        return setting
    
    @staticmethod
    async def log_setting_change(
        session: AsyncSession,
        key: str,
        old_value: Any,
        new_value: Any,
        admin_id: int,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Log a setting change to AuditLog
        
        Args:
            session: Database session
            key: Setting key that changed
            old_value: Previous value
            new_value: New value
            admin_id: Admin who made the change
            change_reason: Optional reason for change
            ip_address: Admin's IP address
            
        Returns:
            AuditLog entry
        """
        
        audit_entry = AuditLog(
            admin_id=admin_id,
            action="SYSTEM_SETTING_CHANGED",
            target_type="SYSTEM_SETTINGS",
            target_id=None,
            details={
                'setting_key': key,
                'old_value': str(old_value),
                'new_value': str(new_value),
                'change_reason': change_reason,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
            ip_address=ip_address,
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry
    
    @staticmethod
    def _parse_value(value_str: str, data_type: Optional[str]) -> Any:
        """Parse string value to appropriate Python type"""
        
        if not data_type or data_type == 'string':
            return value_str
        elif data_type == 'int':
            return int(value_str)
        elif data_type == 'float':
            return float(value_str)
        elif data_type == 'bool':
            return value_str.lower() in ('true', '1', 'yes', 'on')
        elif data_type == 'json':
            return json.loads(value_str)
        else:
            return value_str
    
    @staticmethod
    def invalidate_cache(key: Optional[str] = None) -> None:
        """
        Invalidate cache entry or all cache
        
        Args:
            key: Specific key to invalidate, or None for all
        """
        if key:
            if key in SystemSettingsService._cache:
                del SystemSettingsService._cache[key]
        else:
            SystemSettingsService._cache.clear()


# ✅ Helper functions for specific settings

async def get_agent_distribution_mode(session: AsyncSession) -> str:
    """Get current agent distribution mode"""
    return await SystemSettingsService.get_setting(
        session,
        SettingKey.AGENT_DISTRIBUTION_MODE,
        default='MANUAL'  # Safe default
    )


async def get_game_algorithm_mode(session: AsyncSession) -> str:
    """Get current game algorithm mode"""
    return await SystemSettingsService.get_setting(
        session,
        SettingKey.GAME_ALGORITHM_MODE,
        default='FIXED_HOUSE_EDGE'  # Conservative default
    )


async def get_house_edge_percentage(session: AsyncSession) -> float:
    """Get house edge percentage"""
    return float(await SystemSettingsService.get_setting(
        session,
        SettingKey.HOUSE_EDGE_PERCENTAGE,
        default=5.0
    ))


async def is_agent_distribution_enabled(session: AsyncSession) -> bool:
    """Check if agent distribution feature is enabled"""
    return bool(await SystemSettingsService.get_setting(
        session,
        SettingKey.AGENT_DISTRIBUTION_ENABLED,
        default=False  # Disabled by default
    ))


async def is_game_algorithms_enabled(session: AsyncSession) -> bool:
    """Check if game algorithm system is enabled"""
    return bool(await SystemSettingsService.get_setting(
        session,
        SettingKey.GAME_ALGORITHMS_ENABLED,
        default=False  # Disabled by default
    ))
