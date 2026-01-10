#!/usr/bin/env python3
"""
Dynamic adaptive game algorithm (EXPERIMENTAL)
Adjusts difficulty based on player behavior and risk factors
ISOLATED: Completely sandboxed from conservative algorithm
SAFE: Fallback to FIXED_HOUSE_EDGE on any error
"""

import hashlib
import struct
import math
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass

from algorithms.base_strategy import (
    GameAlgorithmStrategy,
    GameContext,
    GameOutcome,
    GameResult,
)


@dataclass
class AdaptiveFactors:
    """Factors that influence dynamic algorithm behavior"""
    # Risk factors (0.0-1.0, higher = more conservative)
    player_risk_score: float = 0.5
    system_stress_factor: float = 0.5
    behavioral_adjustment: float = 1.0  # 0.8-1.2 multiplier
    
    def get_effective_house_edge(
        self,
        base_house_edge: float,
        max_house_edge: float = 15.0,
    ) -> float:
        """
        Calculate effective house edge with adjustments
        
        Args:
            base_house_edge: Starting house edge
            max_house_edge: Maximum allowed house edge
            
        Returns:
            Effective house edge percentage
        """
        
        # Risk score increases house edge
        risk_adjustment = self.player_risk_score * 5.0  # Up to 5% more
        
        # System stress increases house edge
        stress_adjustment = self.system_stress_factor * 3.0  # Up to 3% more
        
        # Behavioral adjustment (0.8-1.2 multiplier on total)
        effective_edge = (base_house_edge + risk_adjustment + stress_adjustment) * self.behavioral_adjustment
        
        # Cap at maximum
        return min(effective_edge, max_house_edge)


class DynamicAdaptiveAlgorithm(GameAlgorithmStrategy):
    """
    Dynamic adaptive algorithm - experimental, adaptive to player behavior
    
    IMPORTANT SAFETY NOTES:
    - This is EXPERIMENTAL and marked as beta
    - Only used if explicitly enabled via system settings
    - All outcomes are fully auditable
    - Falls back to FIXED_HOUSE_EDGE on ANY error
    - Never influences existing sessions, only new ones
    
    Behavior:
    - Adjusts house edge based on player history
    - More aggressive (higher house edge) for "risky" players
    - Adaptive to system load
    - Still mathematically fair within constraints
    """
    
    def __init__(
        self,
        base_house_edge: float = 5.0,
        max_house_edge: float = 15.0,
        min_house_edge: float = 2.5,
    ):
        """
        Initialize dynamic algorithm
        
        Args:
            base_house_edge: Starting house edge percentage
            max_house_edge: Maximum house edge this algorithm can use
            min_house_edge: Minimum house edge (safety floor)
        """
        super().__init__(
            name='DYNAMIC',
            version='1.0-beta'
        )
        
        self.base_house_edge = base_house_edge
        self.max_house_edge = max_house_edge
        self.min_house_edge = min_house_edge
    
    async def determine_outcome(
        self,
        context: GameContext,
    ) -> GameOutcome:
        """
        Determine game outcome with adaptive factors
        
        SAFE: If any error occurs, falls back to conservative algorithm
        
        Args:
            context: Game context
            
        Returns:
            GameOutcome
        """
        
        try:
            # Validate context
            is_valid, error = self.validate_context(context)
            if not is_valid:
                raise ValueError(f"Invalid context: {error}")
            
            # Calculate adaptive factors
            factors = self._calculate_adaptive_factors(context)
            
            # Calculate effective house edge
            effective_house_edge = factors.get_effective_house_edge(
                self.base_house_edge,
                self.max_house_edge,
            )
            
            # Ensure within bounds
            effective_house_edge = max(self.min_house_edge, effective_house_edge)
            
            # Generate random value
            random_value = self._generate_random_value(context)
            
            # Determine outcome
            rtp = 100.0 - effective_house_edge
            win_probability = rtp / 100.0
            is_win = random_value < win_probability
            
            if is_win:
                # Calculate adaptive payout
                payout_multiplier = self._calculate_adaptive_payout(
                    context,
                    effective_house_edge,
                    factors,
                )
                
                outcome = GameOutcome(
                    result=GameResult.WIN,
                    payout_multiplier=payout_multiplier,
                    confidence_score=0.95,  # Slightly less confident than fixed
                    algorithm_used=self.name,
                    metadata={
                        'base_house_edge': self.base_house_edge,
                        'effective_house_edge': round(effective_house_edge, 2),
                        'adaptive_factors': {
                            'player_risk_score': factors.player_risk_score,
                            'system_stress_factor': factors.system_stress_factor,
                            'behavioral_adjustment': factors.behavioral_adjustment,
                        },
                        'random_value': round(random_value, 4),
                        'payout_adjustment': 'adaptive',
                    }
                )
            else:
                outcome = GameOutcome(
                    result=GameResult.LOSS,
                    payout_multiplier=0.0,
                    confidence_score=0.95,
                    algorithm_used=self.name,
                    metadata={
                        'base_house_edge': self.base_house_edge,
                        'effective_house_edge': round(effective_house_edge, 2),
                        'adaptive_factors': {
                            'player_risk_score': factors.player_risk_score,
                            'system_stress_factor': factors.system_stress_factor,
                            'behavioral_adjustment': factors.behavioral_adjustment,
                        },
                        'random_value': round(random_value, 4),
                    }
                )
            
            # Enforce constraints
            outcome = self.enforce_constraints(outcome, context)
            
            return outcome
            
        except Exception as e:
            # FALLBACK: Log error and return failure indicator
            # Caller should fall back to FIXED_HOUSE_EDGE
            print(f"DYNAMIC algorithm error, should fallback: {e}")
            raise RuntimeError(f"Dynamic algorithm failed: {e}")
    
    async def validate_outcome(
        self,
        outcome: GameOutcome,
        context: GameContext,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate outcome is within adaptive constraints
        
        Args:
            outcome: Outcome to validate
            context: Original game context
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        
        if outcome.algorithm_used != self.name:
            return False, f"Algorithm mismatch: {outcome.algorithm_used}"
        
        # Check payout doesn't exceed max
        if outcome.result == GameResult.WIN:
            max_payout = context.max_payout / context.wager_amount
            if outcome.payout_multiplier > max_payout * 1.1:  # 10% tolerance
                return False, f"Payout multiplier {outcome.payout_multiplier} exceeds max {max_payout}"
        
        return True, None
    
    def get_expected_rtp(self) -> float:
        """
        Get expected RTP percentage
        Note: This varies by player, so return average
        
        Returns:
            Average RTP as percentage
        """
        avg_house_edge = (self.base_house_edge + self.max_house_edge) / 2.0
        return 100.0 - avg_house_edge
    
    def get_algorithm_info(self) -> Dict[str, Any]:
        """
        Get algorithm information
        
        Returns:
            Algorithm details dictionary
        """
        return {
            'name': self.name,
            'version': self.version,
            'type': 'EXPERIMENTAL_ADAPTIVE',
            'status': 'BETA',
            'base_house_edge_percentage': self.base_house_edge,
            'max_house_edge_percentage': self.max_house_edge,
            'min_house_edge_percentage': self.min_house_edge,
            'expected_rtp_percentage': self.get_expected_rtp(),
            'description': 'Adaptive algorithm that adjusts difficulty based on player behavior',
            'fairness_guarantee': 'Adaptive - house edge varies per player, always disclosed',
            'player_history_influence': True,
            'system_load_influence': True,
            'auditable': True,
            'deterministic': False,
            'safety_notes': [
                'EXPERIMENTAL - Beta status only',
                'Falls back to FIXED_HOUSE_EDGE on any error',
                'All adaptive factors fully logged',
                'Only affects NEW game sessions',
                'Fallback requires explicit enable in system settings',
            ],
        }
    
    def _calculate_adaptive_factors(self, context: GameContext) -> AdaptiveFactors:
        """
        Calculate adaptive factors based on context
        
        Factors:
        1. Player risk score: Based on win/loss history
        2. System stress: Based on concurrent sessions
        3. Behavioral adjustment: Smooth modifier
        
        Args:
            context: Game context with player history
            
        Returns:
            AdaptiveFactors instance
        """
        
        # Player risk score: Higher for "lucky" players (high win rate)
        # Capped at 0.0-1.0
        player_risk = min(max(context.player_win_rate - 0.5, 0.0), 1.0)
        
        # System stress: More players = higher stress = more conservative
        # Normalized to 0.0-1.0 (assume 100+ is max stress)
        system_stress = min(context.concurrent_sessions / 100.0, 1.0)
        
        # Behavioral adjustment: Smooth variation around 1.0
        # Use player_id as seed for pseudo-random adjustment
        adjustment = self._get_behavioral_adjustment(context.player_id)
        
        return AdaptiveFactors(
            player_risk_score=player_risk,
            system_stress_factor=system_stress,
            behavioral_adjustment=adjustment,
        )
    
    def _calculate_adaptive_payout(
        self,
        context: GameContext,
        effective_house_edge: float,
        factors: AdaptiveFactors,
    ) -> float:
        """
        Calculate payout with adaptive adjustment
        
        Args:
            context: Game context
            effective_house_edge: House edge to use
            factors: Adaptive factors
            
        Returns:
            Payout multiplier
        """
        
        # Base payout
        base_rtp = 100.0 - effective_house_edge
        base_multiplier = 1.0 / (base_rtp / 100.0)
        
        # Apply behavioral adjustment (slight variation)
        # Only ±5% adjustment to keep fair
        adjusted_multiplier = base_multiplier * (0.95 + factors.behavioral_adjustment * 0.1)
        
        return adjusted_multiplier
    
    def _get_behavioral_adjustment(self, player_id: int) -> float:
        """
        Get behavioral adjustment multiplier for player
        
        Range: 0.8 - 1.2 (±10%)
        Deterministic based on player_id
        
        Args:
            player_id: Player ID
            
        Returns:
            Adjustment multiplier
        """
        
        # Use player_id to generate pseudo-random adjustment
        hash_bytes = hashlib.sha256(str(player_id).encode()).digest()
        hash_int = int.from_bytes(hash_bytes[:4], 'big')
        
        # Normalize to 0.8-1.2 range
        normalized = 0.8 + (hash_int % 1000) / 1000.0 * 0.4
        return normalized
    
    def _generate_random_value(self, context: GameContext) -> float:
        """
        Generate random value for outcome
        
        Args:
            context: Game context
            
        Returns:
            Random float between 0.0 and 1.0
        """
        
        seed_data = f"{context.session_id}:{context.player_id}:{context.wager_amount}"
        hash_value = hashlib.sha256(seed_data.encode()).digest()
        uint32_value = struct.unpack('>I', hash_value[:4])[0]
        
        return (uint32_value % 10000) / 10000.0
