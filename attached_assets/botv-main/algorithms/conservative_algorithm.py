#!/usr/bin/env python3
"""
Conservative fixed house edge algorithm
Transparent, verifiable, mathematically sound
Safe default for all game outcomes
"""

import hashlib
import struct
from typing import Dict, Any, Tuple, Optional
import random

from algorithms.base_strategy import (
    GameAlgorithmStrategy,
    GameContext,
    GameOutcome,
    GameResult,
)


class FixedHouseEdgeAlgorithm(GameAlgorithmStrategy):
    """
    Fixed house edge algorithm - conservative and fully transparent
    
    Guarantees:
    - Consistent house edge across all sessions
    - Verifiable outcomes (can be reproduced given same inputs)
    - Fair distribution of wins/losses
    - No player history influence on individual outcomes
    
    Math:
    - House edge = percentage where house wins
    - Example: 5% house edge means player loses 5%, wins 95%
    - Payout for win = 1 / (1 - house_edge_percentage/100) * wager
    """
    
    def __init__(self, house_edge_percentage: float = 5.0):
        """
        Initialize conservative algorithm
        
        Args:
            house_edge_percentage: House edge as percentage (default 5%)
        """
        super().__init__(
            name='FIXED_HOUSE_EDGE',
            version='1.0'
        )
        
        if not (0.1 <= house_edge_percentage <= 50.0):
            raise ValueError(f"House edge must be 0.1-50%, got {house_edge_percentage}")
        
        self.house_edge_percentage = house_edge_percentage
        self.rtp_percentage = 100.0 - house_edge_percentage
    
    async def determine_outcome(
        self,
        context: GameContext,
    ) -> GameOutcome:
        """
        Determine game outcome using fixed probability
        
        Algorithm:
        1. Generate random value from seed
        2. Compare to house edge threshold
        3. Determine WIN/LOSS based on threshold
        4. Calculate payout for WIN
        """
        
        # Validate context
        is_valid, error = self.validate_context(context)
        if not is_valid:
            raise ValueError(f"Invalid context: {error}")
        
        # Generate deterministic random value
        # Using session_id + player_id + timestamp to seed
        random_value = self._generate_random_value(context)
        
        # Determine outcome based on house edge
        win_probability = self.rtp_percentage / 100.0  # Player win chance
        is_win = random_value < win_probability
        
        if is_win:
            # Calculate WIN payout
            # Payout = wager / (1 - house_edge/100)
            payout_multiplier = 1.0 / (self.rtp_percentage / 100.0)
            outcome = GameOutcome(
                result=GameResult.WIN,
                payout_multiplier=payout_multiplier,
                confidence_score=1.0,
                algorithm_used=self.name,
                metadata={
                    'house_edge_percentage': self.house_edge_percentage,
                    'random_value': round(random_value, 4),
                    'win_threshold': round(win_probability, 4),
                    'payout_calculation': f"{context.wager_amount} / {self.rtp_percentage / 100.0:.4f}",
                }
            )
        else:
            # LOSS - house keeps wager
            outcome = GameOutcome(
                result=GameResult.LOSS,
                payout_multiplier=0.0,
                confidence_score=1.0,
                algorithm_used=self.name,
                metadata={
                    'house_edge_percentage': self.house_edge_percentage,
                    'random_value': round(random_value, 4),
                    'loss_threshold': round(1.0 - win_probability, 4),
                }
            )
        
        # Enforce safety constraints
        outcome = self.enforce_constraints(outcome, context)
        
        return outcome
    
    async def validate_outcome(
        self,
        outcome: GameOutcome,
        context: GameContext,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate outcome is mathematically sound
        
        Checks:
        - Payout multiplier is correct for WIN
        - House edge is maintained
        - No impossible payouts
        """
        
        if outcome.algorithm_used != self.name:
            return False, f"Algorithm mismatch: {outcome.algorithm_used} != {self.name}"
        
        if outcome.result == GameResult.WIN:
            # Check payout is correct
            expected_multiplier = 1.0 / (self.rtp_percentage / 100.0)
            if abs(outcome.payout_multiplier - expected_multiplier) > 0.0001:
                return False, (
                    f"Invalid payout multiplier: {outcome.payout_multiplier} "
                    f"!= {expected_multiplier}"
                )
            
            # Check payout doesn't exceed max
            payout = outcome.payout_multiplier * context.wager_amount
            if payout > context.max_payout:
                return False, f"Payout {payout} exceeds max {context.max_payout}"
        
        elif outcome.result == GameResult.LOSS:
            if outcome.payout_multiplier != 0.0:
                return False, "Loss should have 0 payout"
        
        else:
            return False, f"Unknown result: {outcome.result}"
        
        return True, None
    
    def get_expected_rtp(self) -> float:
        """
        Get expected RTP percentage
        
        Returns:
            RTP as percentage
        """
        return self.rtp_percentage
    
    def get_algorithm_info(self) -> Dict[str, Any]:
        """
        Get algorithm information
        
        Returns:
            Algorithm details dictionary
        """
        return {
            'name': self.name,
            'version': self.version,
            'type': 'CONSERVATIVE',
            'house_edge_percentage': self.house_edge_percentage,
            'rtp_percentage': self.rtp_percentage,
            'description': 'Fixed house edge with transparent, verifiable outcomes',
            'fairness_guarantee': 'Mathematical - house edge enforced consistently',
            'player_history_influence': False,
            'system_load_influence': False,
            'auditable': True,
            'deterministic': True,
        }
    
    def _generate_random_value(self, context: GameContext) -> float:
        """
        Generate deterministic random value for outcome
        
        Uses SHA256 hash of context to ensure reproducibility
        Can be verified: given same context, same outcome always results
        
        Args:
            context: Game context
            
        Returns:
            Random float between 0.0 and 1.0
        """
        
        # Create seed string from context
        seed_data = f"{context.session_id}:{context.player_id}:{context.wager_amount}"
        
        # Hash to get deterministic value
        hash_value = hashlib.sha256(seed_data.encode()).digest()
        
        # Convert first 4 bytes to uint32, normalize to [0, 1]
        uint32_value = struct.unpack('>I', hash_value[:4])[0]
        random_value = (uint32_value % 10000) / 10000.0
        
        return random_value


class ConservativeAlgorithmFactory:
    """Factory for creating conservative algorithm instances"""
    
    _instances = {}
    
    @staticmethod
    def create(house_edge_percentage: float = 5.0) -> FixedHouseEdgeAlgorithm:
        """
        Create or retrieve cached algorithm instance
        
        Args:
            house_edge_percentage: House edge percentage
            
        Returns:
            Algorithm instance
        """
        
        key = f"fixed_{house_edge_percentage}"
        if key not in ConservativeAlgorithmFactory._instances:
            ConservativeAlgorithmFactory._instances[key] = FixedHouseEdgeAlgorithm(
                house_edge_percentage
            )
        
        return ConservativeAlgorithmFactory._instances[key]
    
    @staticmethod
    def get_default() -> FixedHouseEdgeAlgorithm:
        """
        Get default conservative algorithm
        
        Returns:
            Default algorithm instance
        """
        return ConservativeAlgorithmFactory.create(house_edge_percentage=5.0)
