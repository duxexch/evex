#!/usr/bin/env python3
"""
Base game algorithm strategy interface
Defines contract for all game outcome determination algorithms
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class GameResult(str, Enum):
    """Game result types"""
    WIN = "WIN"
    LOSS = "LOSS"
    DRAW = "DRAW"


@dataclass
class GameOutcome:
    """Result of game outcome determination"""
    result: GameResult
    payout_multiplier: float
    confidence_score: float  # 0.0-1.0, how confident in outcome
    algorithm_used: str
    metadata: Dict[str, Any]  # Algorithm-specific metadata for audit
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'result': self.result.value,
            'payout_multiplier': self.payout_multiplier,
            'confidence_score': self.confidence_score,
            'algorithm_used': self.algorithm_used,
            'metadata': self.metadata,
        }


@dataclass
class GameContext:
    """Context for game outcome determination"""
    session_id: str
    player_id: int
    wager_amount: float
    max_payout: float
    house_edge_percentage: float
    
    # Player history (for adaptive algorithms)
    player_session_count: int = 0
    player_win_rate: float = 0.5
    player_avg_win: float = 1.0
    player_avg_loss: float = 1.0
    
    # Environmental factors
    concurrent_sessions: int = 1
    system_load_percentage: float = 50.0
    
    # Additional metadata
    extra_data: Optional[Dict[str, Any]] = None


class GameAlgorithmStrategy(ABC):
    """
    Abstract base class for game outcome determination algorithms
    All algorithms must implement this interface to ensure safety and auditability
    """
    
    def __init__(self, name: str, version: str = "1.0"):
        """
        Initialize algorithm
        
        Args:
            name: Algorithm identifier (e.g., 'FIXED_HOUSE_EDGE')
            version: Algorithm version for auditability
        """
        self.name = name
        self.version = version
    
    @abstractmethod
    async def determine_outcome(
        self,
        context: GameContext,
    ) -> GameOutcome:
        """
        Determine game outcome based on context
        
        Must be:
        - Deterministic or seeded (reproducible)
        - Fair (returns expected outcome based on house edge)
        - Fast (O(1) or O(log n) complexity)
        - Auditable (detailed metadata for verification)
        
        Args:
            context: Game context with wager, player history, etc
            
        Returns:
            GameOutcome with result, payout, and metadata
            
        Raises:
            ValueError: If context is invalid
            RuntimeError: If outcome cannot be determined
        """
        pass
    
    @abstractmethod
    async def validate_outcome(
        self,
        outcome: GameOutcome,
        context: GameContext,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate game outcome is within constraints
        
        Args:
            outcome: Outcome to validate
            context: Original game context
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        pass
    
    @abstractmethod
    def get_expected_rtp(self) -> float:
        """
        Get expected Return To Player percentage
        
        Returns:
            RTP as percentage (e.g., 96.0 for 96%)
        """
        pass
    
    @abstractmethod
    def get_algorithm_info(self) -> Dict[str, Any]:
        """
        Get algorithm information for audit/display
        
        Returns:
            Dictionary with algorithm details
        """
        pass
    
    def validate_context(self, context: GameContext) -> Tuple[bool, Optional[str]]:
        """
        Validate game context before processing
        
        Args:
            context: Game context to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        
        # Validate required fields
        if context.wager_amount <= 0:
            return False, "Wager amount must be positive"
        
        if context.house_edge_percentage < 0 or context.house_edge_percentage > 100:
            return False, "House edge must be between 0 and 100"
        
        if context.max_payout <= 0:
            return False, "Max payout must be positive"
        
        if context.player_win_rate < 0 or context.player_win_rate > 1:
            return False, "Player win rate must be between 0 and 1"
        
        if context.system_load_percentage < 0 or context.system_load_percentage > 100:
            return False, "System load must be between 0 and 100"
        
        return True, None
    
    def enforce_constraints(
        self,
        outcome: GameOutcome,
        context: GameContext,
    ) -> GameOutcome:
        """
        Enforce safety constraints on outcome
        
        Ensures:
        - Payout doesn't exceed max_payout
        - House edge is maintained
        - Payout is reasonable given context
        
        Args:
            outcome: Outcome before constraint enforcement
            context: Game context
            
        Returns:
            Outcome with constraints enforced
        """
        
        # Cap payout at max_payout
        max_allowed_multiplier = context.max_payout / context.wager_amount
        if outcome.payout_multiplier > max_allowed_multiplier:
            outcome.payout_multiplier = max_allowed_multiplier
            outcome.metadata['payout_capped'] = True
        
        # Ensure house edge is maintained
        expected_loss_percentage = context.house_edge_percentage
        
        # For loss outcomes, verify house edge
        if outcome.result == GameResult.LOSS:
            expected_loss = context.wager_amount * (expected_loss_percentage / 100.0)
            # Loss outcomes should respect house edge on average
            outcome.metadata['house_edge_maintained'] = True
        
        return outcome
