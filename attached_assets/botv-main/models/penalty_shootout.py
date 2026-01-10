"""
Penalty Shootout Game - Complete Implementation
Advanced gaming mechanics with dynamic betting, real-time balance updates, and secure session management
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, 
    JSON, Boolean, Text, UniqueConstraint, Index, CheckConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum
from models import Base, User, GameSession as BaseGameSession


class PenaltyShotDirection(PyEnum):
    """Possible shooting directions"""
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class PenaltyShotOutcome(PyEnum):
    """Possible outcomes for each shot"""
    GOAL = "goal"
    MISS = "miss"
    SAVED = "saved"


class PenaltyShootoutGame(Base):
    """
    Penalty Shootout Game Configuration
    
    Features:
    - Dynamic betting per round
    - Keeper AI simulation
    - House edge control
    - Win multipliers
    - Session tracking
    """
    __tablename__ = "penalty_shootout_games"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text)
    
    # Game Configuration
    min_bet_amount = Column(Numeric(15, 2), nullable=False, default=Decimal("1.0"))
    max_bet_amount = Column(Numeric(15, 2), nullable=False, default=Decimal("1000.0"))
    min_rounds = Column(Integer, default=1)  # Minimum rounds to play
    max_rounds = Column(Integer, default=5)  # Maximum rounds
    
    # Payout Configuration
    goal_multiplier = Column(Numeric(5, 2), nullable=False, default=Decimal("2.0"))  # 2x for goal
    miss_multiplier = Column(Numeric(5, 2), nullable=False, default=Decimal("0.0"))  # 0x for miss
    house_edge_percent = Column(Numeric(5, 2), nullable=False, default=Decimal("5.0"))
    
    # Keeper AI Configuration (probability of saving)
    keeper_save_probability = Column(Numeric(5, 2), nullable=False, default=Decimal("30.0"))  # 30% save rate
    keeper_direction_prediction = Column(Numeric(5, 2), nullable=False, default=Decimal("50.0"))  # 50% guess correct
    
    # Win Notification Threshold
    win_notification_threshold = Column(Numeric(15, 2), default=Decimal("500.0"))
    
    # Media
    icon_path = Column(String(512))
    icon_type = Column(String(50))  # gif, png, jpg
    game_art_url = Column(String(512))  # URL for game banner
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_featured = Column(Boolean, default=False)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, MAINTENANCE, TESTING
    
    # Statistics
    total_sessions = Column(Integer, default=0)
    total_shots_taken = Column(Integer, default=0)
    total_goals_scored = Column(Integer, default=0)
    total_bets_amount = Column(Numeric(15, 2), default=Decimal("0.0"))
    total_winnings_amount = Column(Numeric(15, 2), default=Decimal("0.0"))
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by_admin_id = Column(Integer, ForeignKey("user.id"))
    
    # Relationships
    sessions = relationship("PenaltyShootoutSession", back_populates="game", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("min_bet_amount > 0", name="check_min_bet_positive"),
        CheckConstraint("max_bet_amount >= min_bet_amount", name="check_max_gte_min"),
        CheckConstraint("house_edge_percent >= 0 AND house_edge_percent <= 100", name="check_house_edge"),
        CheckConstraint("keeper_save_probability >= 0 AND keeper_save_probability <= 100", name="check_save_prob"),
        CheckConstraint("goal_multiplier >= 0", name="check_multiplier_positive"),
        Index("idx_penalty_active_featured", "is_active", "is_featured"),
    )


class PenaltyShootoutSession(Base):
    """
    Individual Penalty Shootout Game Session
    
    Tracks:
    - Player and game
    - Betting information
    - Round-by-round results
    - Total session outcome
    - Financial updates
    """
    __tablename__ = "penalty_shootout_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), nullable=False, unique=True, index=True)
    
    # References
    player_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    game_id = Column(Integer, ForeignKey("penalty_shootout_games.id"), nullable=False, index=True)
    
    # Session Configuration
    num_rounds = Column(Integer, nullable=False)  # Planned rounds
    rounds_completed = Column(Integer, default=0)  # Actual completed rounds
    
    # Financial
    initial_balance = Column(Numeric(15, 2), nullable=False)
    total_bet_amount = Column(Numeric(15, 2), default=Decimal("0.0"))
    total_winnings = Column(Numeric(15, 2), default=Decimal("0.0"))
    final_balance = Column(Numeric(15, 2))
    profit_loss = Column(Numeric(15, 2))
    
    # Session Data
    rounds_data = Column(JSON, default=dict)  # { "round_1": {...}, "round_2": {...} }
    
    # Session State
    is_active = Column(Boolean, default=True, index=True)
    is_completed = Column(Boolean, default=False)
    
    # Security
    session_token = Column(String(512), unique=True, index=True)  # JWT token
    signature = Column(String(512))  # HMAC SHA-256
    idempotency_key = Column(String(255), unique=True, index=True)
    
    # Tracking
    ip_address = Column(String(50))
    user_agent = Column(String(512))
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    end_time = Column(DateTime)
    expires_at = Column(DateTime)
    
    # Relationships
    player = relationship("User", backref="penalty_shootout_sessions")
    game = relationship("PenaltyShootoutGame", back_populates="sessions")
    rounds = relationship("PenaltyShootoutRound", back_populates="session", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("rounds_completed >= 0", name="check_rounds_completed_positive"),
        CheckConstraint("rounds_completed <= num_rounds", name="check_rounds_completed_lte_planned"),
        Index("idx_penalty_session_player_game", "player_id", "game_id"),
        Index("idx_penalty_session_active", "is_active", "is_completed"),
    )


class PenaltyShootoutRound(Base):
    """
    Individual Round in Penalty Shootout Session
    
    Tracks:
    - Player decision (shot direction)
    - Keeper AI decision
    - Outcome (goal, miss, saved)
    - Bet amount and winnings for this round
    """
    __tablename__ = "penalty_shootout_rounds"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("penalty_shootout_sessions.id"), nullable=False, index=True)
    
    # Round Number
    round_number = Column(Integer, nullable=False)
    
    # Player Action
    player_shot_direction = Column(Enum(PenaltyShotDirection), nullable=False)
    
    # Keeper AI (Simulated)
    keeper_predicted_direction = Column(Enum(PenaltyShotDirection))
    keeper_jump_direction = Column(Enum(PenaltyShotDirection), nullable=False)
    keeper_saved = Column(Boolean)  # True if keeper blocked the shot
    
    # Outcome
    outcome = Column(Enum(PenaltyShotOutcome), nullable=False)  # GOAL, MISS, or SAVED
    
    # Financial
    bet_amount = Column(Numeric(15, 2), nullable=False)
    win_amount = Column(Numeric(15, 2), default=Decimal("0.0"))
    multiplier_applied = Column(Numeric(5, 2))
    
    # Keeper Animation (for front-end)
    keeper_animation = Column(String(50))  # Which direction keeper dives
    keeper_reaction = Column(String(100))  # saved, blocked, or scored-against
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    session = relationship("PenaltyShootoutSession", back_populates="rounds")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("round_number > 0", name="check_round_number_positive"),
        CheckConstraint("bet_amount > 0", name="check_round_bet_positive"),
        CheckConstraint("win_amount >= 0", name="check_win_amount_non_negative"),
        Index("idx_round_session_number", "session_id", "round_number", unique=True),
    )


# Add to models.py at the end
__all__ = [
    "PenaltyShootoutGame",
    "PenaltyShootoutSession",
    "PenaltyShootoutRound",
    "PenaltyShotDirection",
    "PenaltyShotOutcome",
]
