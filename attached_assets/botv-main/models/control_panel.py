"""
Control Panel Models
Database models for game management and player control.
"""
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Boolean, DateTime,
    Date, ForeignKey, UniqueConstraint, Index, DECIMAL
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from decimal import Decimal

Base = declarative_base()


class Game(Base):
    """Game model for managing games in the control panel"""
    __tablename__ = 'games'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=True)
    status = Column(String(20), default='active', nullable=False)
    
    min_bet = Column(DECIMAL(15, 2), default=Decimal('1.00'), nullable=False)
    max_bet = Column(DECIMAL(15, 2), default=Decimal('10000.00'), nullable=False)
    house_edge = Column(DECIMAL(5, 2), default=Decimal('5.00'), nullable=False)
    rtp = Column(DECIMAL(5, 2), default=Decimal('95.00'), nullable=False)
    
    algorithm_mode = Column(String(50), default='FIXED_HOUSE_EDGE', nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    play_count = Column(Integer, default=0, nullable=False)
    total_volume = Column(DECIMAL(15, 2), default=Decimal('0'), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    updated_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    profit_loss_rules = relationship('ProfitLossRule', back_populates='game', cascade='all, delete-orphan')
    game_configurations = relationship('GameConfiguration', back_populates='game', cascade='all, delete-orphan')
    
    __table_args__ = (
        Index('idx_games_status', 'status'),
        Index('idx_games_created', 'created_at'),
    )


class GameConfiguration(Base):
    """Game configuration key-value storage"""
    __tablename__ = 'game_configurations'
    
    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey('games.id', ondelete='CASCADE'), nullable=False)
    config_key = Column(String(100), nullable=False)
    config_value = Column(Text, nullable=True)
    data_type = Column(String(20), nullable=True)  # string, int, float, boolean, json
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    game = relationship('Game', back_populates='game_configurations')
    
    __table_args__ = (
        UniqueConstraint('game_id', 'config_key', name='uk_game_config'),
        Index('idx_game_config_game', 'game_id'),
    )


class ProfitLossRule(Base):
    """Profit/Loss rules for games and players"""
    __tablename__ = 'profit_loss_rules'
    
    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey('games.id', ondelete='CASCADE'), nullable=False)
    player_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    rule_name = Column(String(100), nullable=True)
    rule_type = Column(String(50), nullable=False)  # house_edge_adjustment, payout_multiplier, loss_cap
    
    min_amount = Column(DECIMAL(15, 2), nullable=True)
    max_amount = Column(DECIMAL(15, 2), nullable=True)
    win_streak_threshold = Column(Integer, nullable=True)
    loss_streak_threshold = Column(Integer, nullable=True)
    
    house_edge_adjustment = Column(DECIMAL(5, 2), default=Decimal('0'), nullable=False)
    payout_multiplier = Column(DECIMAL(5, 2), default=Decimal('1.0'), nullable=False)
    loss_cap = Column(DECIMAL(15, 2), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=100, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    game = relationship('Game', back_populates='profit_loss_rules')
    
    __table_args__ = (
        Index('idx_profit_loss_game', 'game_id'),
        Index('idx_profit_loss_player', 'player_id'),
        Index('idx_profit_loss_active', 'is_active', 'priority'),
    )


class ProfitLossPlayerRule(Base):
    """Player-specific profit/loss rules"""
    __tablename__ = 'profit_loss_player_rules'
    
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    game_id = Column(Integer, ForeignKey('games.id', ondelete='CASCADE'), nullable=True)
    
    custom_house_edge = Column(DECIMAL(5, 2), nullable=True)
    daily_loss_limit = Column(DECIMAL(15, 2), nullable=True)
    weekly_loss_limit = Column(DECIMAL(15, 2), nullable=True)
    max_payout_multiplier = Column(DECIMAL(5, 2), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    __table_args__ = (
        Index('idx_player_rule_player', 'player_id'),
        Index('idx_player_rule_game', 'game_id'),
        Index('idx_player_rule_active', 'is_active'),
    )


class PlayerBalance(Base):
    """Player balance tracking"""
    __tablename__ = 'player_balances'
    
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    
    current_balance = Column(DECIMAL(15, 2), default=Decimal('0.00'), nullable=False)
    total_deposited = Column(DECIMAL(15, 2), default=Decimal('0.00'), nullable=False)
    total_withdrawn = Column(DECIMAL(15, 2), default=Decimal('0.00'), nullable=False)
    total_wagered = Column(DECIMAL(15, 2), default=Decimal('0.00'), nullable=False)
    total_winnings = Column(DECIMAL(15, 2), default=Decimal('0.00'), nullable=False)
    
    is_banned = Column(Boolean, default=False, nullable=False)
    ban_reason = Column(String(255), nullable=True)
    ban_until = Column(DateTime, nullable=True)
    
    balance_at_month_start = Column(DECIMAL(15, 2), nullable=True)
    balance_at_week_start = Column(DECIMAL(15, 2), nullable=True)
    balance_at_day_start = Column(DECIMAL(15, 2), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_player_balance_player', 'player_id'),
        Index('idx_player_balance_banned', 'is_banned'),
    )


class BalanceTransaction(Base):
    """Balance transaction ledger"""
    __tablename__ = 'balance_transactions'
    
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    transaction_type = Column(String(50), nullable=False)  # deposit, withdrawal, game_payout, adjustment, refund
    amount = Column(DECIMAL(15, 2), nullable=False)
    description = Column(String(255), nullable=True)
    
    game_id = Column(Integer, ForeignKey('games.id'), nullable=True)
    game_session_id = Column(String(100), nullable=True)
    reference_id = Column(String(100), nullable=True)
    
    balance_before = Column(DECIMAL(15, 2), nullable=False)
    balance_after = Column(DECIMAL(15, 2), nullable=False)
    
    is_verified = Column(Boolean, default=False, nullable=False)
    signature = Column(String(255), nullable=True)
    
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_balance_trans_player', 'player_id'),
        Index('idx_balance_trans_type', 'transaction_type'),
        Index('idx_balance_trans_created', 'created_at'),
        Index('idx_balance_trans_game', 'game_id'),
    )


class RolePermission(Base):
    """RBAC role permissions"""
    __tablename__ = 'role_permissions'
    
    id = Column(Integer, primary_key=True)
    role_name = Column(String(50), nullable=False)
    permission = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    __table_args__ = (
        UniqueConstraint('role_name', 'permission', name='uk_role_permission'),
        Index('idx_role_perm_role', 'role_name'),
        Index('idx_role_perm_active', 'is_active'),
    )


class UserRole(Base):
    """User role assignments"""
    __tablename__ = 'user_roles'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role_name = Column(String(50), ForeignKey('role_permissions.role_name'), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    scope_game_ids = Column(String(500), nullable=True)  # Comma-separated game IDs for scoped roles
    
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    assigned_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'role_name', name='uk_user_role'),
        Index('idx_user_role_user', 'user_id'),
        Index('idx_user_role_active', 'is_active'),
    )
