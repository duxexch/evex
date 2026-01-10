#!/usr/bin/env python3
"""
Initialize SystemSettings with default values
Run once during system setup
"""

from sqlalchemy.ext.asyncio import AsyncSession
from services.system_settings_service import SystemSettingsService, SettingKey


async def init_default_settings(session: AsyncSession) -> None:
    """
    Initialize all system settings with safe defaults
    Idempotent - can be called multiple times safely
    """
    
    default_settings = [
        # ✅ Agent Distribution (Default: MANUAL - safest option)
        (
            SettingKey.AGENT_DISTRIBUTION_MODE,
            'MANUAL',
            'agent_distribution',
            'Current agent distribution mode (MANUAL, AUTO_ROUND_ROBIN, AUTO_LOAD_BASED)',
            'string'
        ),
        (
            SettingKey.AGENT_DISTRIBUTION_ENABLED,
            'false',
            'agent_distribution',
            'Enable/disable agent distribution system',
            'bool'
        ),
        (
            SettingKey.AGENT_RR_POINTER,
            '0',
            'agent_distribution',
            'Current round-robin pointer for agent rotation',
            'int'
        ),
        (
            SettingKey.AGENT_LOAD_METHOD,
            'PENDING_COUNT',
            'agent_distribution',
            'Load calculation method (PENDING_COUNT, TIME_WINDOW, WEIGHTED)',
            'string'
        ),
        (
            SettingKey.AGENT_LOAD_WEIGHT_PENDING,
            '10',
            'agent_distribution',
            'Weight multiplier for pending request count',
            'float'
        ),
        (
            SettingKey.AGENT_LOAD_TIME_WINDOW_MINUTES,
            '120',
            'agent_distribution',
            'Time window in minutes for load calculation',
            'int'
        ),
        
        # ✅ Game Algorithms (Default: FIXED_HOUSE_EDGE - conservative)
        (
            SettingKey.GAME_ALGORITHM_MODE,
            'FIXED_HOUSE_EDGE',
            'game_algorithms',
            'Current game algorithm mode (FIXED_HOUSE_EDGE, DYNAMIC)',
            'string'
        ),
        (
            SettingKey.GAME_ALGORITHMS_ENABLED,
            'false',
            'game_algorithms',
            'Enable/disable game algorithm system',
            'bool'
        ),
        (
            SettingKey.HOUSE_EDGE_PERCENTAGE,
            '5.0',
            'game_algorithms',
            'House edge percentage (0.0-100.0)',
            'float'
        ),
        (
            SettingKey.MAX_PAYOUT_MULTIPLIER,
            '36.0',
            'game_algorithms',
            'Maximum payout multiplier',
            'float'
        ),
        (
            SettingKey.RTP_TARGET,
            '95.0',
            'game_algorithms',
            'Target Return to Player percentage',
            'float'
        ),
        
        # ✅ Feature Flags (All disabled by default)
        (
            SettingKey.FEATURE_AUTO_ROUND_ROBIN_ENABLED,
            'false',
            'feature_flags',
            'Enable auto round-robin agent distribution',
            'bool'
        ),
        (
            SettingKey.FEATURE_AUTO_LOAD_BASED_ENABLED,
            'false',
            'feature_flags',
            'Enable auto load-based agent distribution',
            'bool'
        ),
        (
            SettingKey.FEATURE_DYNAMIC_ALGORITHM_ENABLED,
            'false',
            'feature_flags',
            'Enable dynamic game algorithm',
            'bool'
        ),
    ]
    
    for key, value, category, description, data_type in default_settings:
        await SystemSettingsService.set_setting(
            session,
            key=key,
            value=value,
            category=category,
            description=description,
            data_type=data_type,
            admin_id=None,  # System initialization
        )
    
    await session.commit()


if __name__ == '__main__':
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from config import DATABASE_URL
    
    async def run():
        engine = create_async_engine(DATABASE_URL)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            await init_default_settings(session)
            print("✅ Default settings initialized")
    
    asyncio.run(run())
