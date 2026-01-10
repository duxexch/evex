#!/usr/bin/env python3
"""
Game algorithm manager with safe switching logic
Central point for algorithm selection and validation
"""

from typing import Optional, Tuple, Dict, Any
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import GameSession, SystemSetting
from algorithms.base_strategy import GameAlgorithmStrategy, GameContext
from algorithms.conservative_algorithm import ConservativeAlgorithmFactory, FixedHouseEdgeAlgorithm
from algorithms.dynamic_algorithm import DynamicAdaptiveAlgorithm
from services.system_settings_service import (
    SystemSettingsService,
    SettingKey,
    get_game_algorithm_mode,
    get_house_edge_percentage,
    is_game_algorithms_enabled,
)


class AlgorithmMode(str, Enum):
    """Available algorithm modes"""
    FIXED_HOUSE_EDGE = "FIXED_HOUSE_EDGE"
    DYNAMIC = "DYNAMIC"


class GameAlgorithmManager:
    """
    Manages game algorithms with safe switching
    
    Responsibilities:
    - Load correct algorithm based on settings
    - Fall back to safe default on error
    - Validate algorithm before use
    - Track algorithm in game session
    """
    
    # Cache algorithms
    _conservative_cache: Optional[FixedHouseEdgeAlgorithm] = None
    _dynamic_cache: Optional[DynamicAdaptiveAlgorithm] = None
    _current_mode: AlgorithmMode = AlgorithmMode.FIXED_HOUSE_EDGE
    
    @classmethod
    async def get_algorithm(
        cls,
        session: AsyncSession,
        fallback_to_conservative: bool = True,
    ) -> Tuple[GameAlgorithmStrategy, bool]:
        """
        Get current algorithm based on system settings
        
        SAFE: Falls back to conservative algorithm on any error
        
        Args:
            session: Database session
            fallback_to_conservative: If True, fallback on error
            
        Returns:
            Tuple of (algorithm, is_fallback)
        """
        
        try:
            # Check if algorithms feature is enabled
            is_enabled = await is_game_algorithms_enabled(session)
            if not is_enabled:
                return await cls._get_conservative_algorithm(session), False
            
            # Get current mode
            mode = await get_game_algorithm_mode(session)
            
            if mode == AlgorithmMode.DYNAMIC.value:
                # Try to get dynamic algorithm
                try:
                    return await cls._get_dynamic_algorithm(session), False
                except Exception as e:
                    print(f"Error loading DYNAMIC algorithm: {e}")
                    if fallback_to_conservative:
                        print("Falling back to FIXED_HOUSE_EDGE")
                        return await cls._get_conservative_algorithm(session), True
                    raise
            
            else:
                # Default to conservative
                return await cls._get_conservative_algorithm(session), False
                
        except Exception as e:
            print(f"Error getting algorithm: {e}")
            if fallback_to_conservative:
                return ConservativeAlgorithmFactory.get_default(), True
            raise
    
    @classmethod
    async def _get_conservative_algorithm(
        cls,
        session: AsyncSession,
    ) -> FixedHouseEdgeAlgorithm:
        """
        Get conservative algorithm with current settings
        
        Args:
            session: Database session
            
        Returns:
            FixedHouseEdgeAlgorithm instance
        """
        
        if cls._conservative_cache is None:
            house_edge = await get_house_edge_percentage(session)
            cls._conservative_cache = ConservativeAlgorithmFactory.create(
                house_edge_percentage=house_edge
            )
        
        return cls._conservative_cache
    
    @classmethod
    async def _get_dynamic_algorithm(
        cls,
        session: AsyncSession,
    ) -> DynamicAdaptiveAlgorithm:
        """
        Get dynamic algorithm with current settings
        
        Args:
            session: Database session
            
        Returns:
            DynamicAdaptiveAlgorithm instance
        """
        
        if cls._dynamic_cache is None:
            base_edge = await get_house_edge_percentage(session)
            cls._dynamic_cache = DynamicAdaptiveAlgorithm(
                base_house_edge=base_edge,
                max_house_edge=15.0,
                min_house_edge=2.5,
            )
        
        return cls._dynamic_cache
    
    @classmethod
    async def determine_game_outcome(
        cls,
        session: AsyncSession,
        context: GameContext,
        track_in_session: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Determine game outcome with current algorithm
        
        SAFE: Validates outcome and logs all details
        
        Args:
            session: Database session
            context: Game context
            track_in_session: If provided, track algorithm in this session
            
        Returns:
            Tuple of (outcome_dict, is_fallback_used)
        """
        
        is_fallback = False
        
        try:
            # Get algorithm
            algorithm, is_fallback = await cls.get_algorithm(session)
            
            # Determine outcome
            outcome = await algorithm.determine_outcome(context)
            
            # Validate outcome
            is_valid, error = await algorithm.validate_outcome(outcome, context)
            if not is_valid:
                raise ValueError(f"Invalid outcome: {error}")
            
            # Track algorithm used if session provided
            if track_in_session:
                game_session = await session.get(GameSession, track_in_session)
                if game_session:
                    game_session.algorithm_used = algorithm.name
            
            return outcome.to_dict(), is_fallback
            
        except Exception as e:
            print(f"Error determining outcome: {e}")
            # FALLBACK: Use conservative algorithm
            try:
                conservative = ConservativeAlgorithmFactory.get_default()
                outcome = await conservative.determine_outcome(context)
                
                if track_in_session:
                    game_session = await session.get(GameSession, track_in_session)
                    if game_session:
                        game_session.algorithm_used = conservative.name
                
                return outcome.to_dict(), True
                
            except Exception as fallback_error:
                print(f"CRITICAL: Even fallback algorithm failed: {fallback_error}")
                raise
    
    @classmethod
    async def switch_algorithm(
        cls,
        session: AsyncSession,
        new_mode: AlgorithmMode,
    ) -> Tuple[bool, Optional[str]]:
        """
        Switch to new algorithm mode
        
        SAFE: Validates before switching, logs change
        
        Args:
            session: Database session
            new_mode: New algorithm mode
            
        Returns:
            Tuple of (success, error_message)
        """
        
        try:
            # Validate new mode
            current_mode = await get_game_algorithm_mode(session)
            if current_mode == new_mode.value:
                return True, None  # Already on requested mode
            
            # Get new algorithm to validate it works
            if new_mode == AlgorithmMode.DYNAMIC:
                algorithm = await cls._get_dynamic_algorithm(session)
            else:
                algorithm = await cls._get_conservative_algorithm(session)
            
            # Test algorithm with dummy context
            test_context = GameContext(
                session_id="TEST",
                player_id=0,
                wager_amount=1.0,
                max_payout=100.0,
                house_edge_percentage=5.0,
            )
            
            try:
                test_outcome = await algorithm.determine_outcome(test_context)
                is_valid, error = await algorithm.validate_outcome(test_outcome, test_context)
                if not is_valid:
                    return False, f"Algorithm validation failed: {error}"
            except Exception as e:
                return False, f"Algorithm test failed: {e}"
            
            # Update setting
            await SystemSettingsService.set_setting(
                session,
                key=SettingKey.GAME_ALGORITHM_MODE,
                value=new_mode.value,
            )
            
            # Clear cache to reload
            cls._conservative_cache = None
            cls._dynamic_cache = None
            cls._current_mode = new_mode
            
            return True, None
            
        except Exception as e:
            return False, str(e)
    
    @classmethod
    def clear_cache(cls):
        """Clear algorithm cache (e.g., after settings change)"""
        cls._conservative_cache = None
        cls._dynamic_cache = None


class GameAlgorithmValidator:
    """
    Validates game algorithms for safety
    Ensures all algorithms meet minimum safety standards
    """
    
    REQUIRED_RTP_MINIMUM = 90.0  # Must be at least 90%
    MAXIMUM_HOUSE_EDGE = 20.0    # House edge can't exceed 20%
    
    @staticmethod
    async def validate_algorithm(
        algorithm: GameAlgorithmStrategy,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate algorithm meets safety standards
        
        Args:
            algorithm: Algorithm to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        
        try:
            # Check RTP
            rtp = algorithm.get_expected_rtp()
            if rtp < GameAlgorithmValidator.REQUIRED_RTP_MINIMUM:
                return False, f"RTP {rtp}% is below minimum {GameAlgorithmValidator.REQUIRED_RTP_MINIMUM}%"
            
            # Get algorithm info
            info = algorithm.get_algorithm_info()
            
            # Check if algorithm is auditable
            if not info.get('auditable', False):
                return False, "Algorithm must be auditable"
            
            return True, None
            
        except Exception as e:
            return False, f"Validation error: {e}"
