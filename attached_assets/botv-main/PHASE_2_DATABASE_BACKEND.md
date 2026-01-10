# Phase 2: Database & Backend Implementation Starter

This document contains the database migrations and Python models for Phase 2.

## 📁 File Structure

Create the following files in your project:

```
services/
├── game_management_service.py    # NEW
├── player_management_service.py  # NEW
├── profit_loss_service.py        # NEW
├── rbac_service.py               # NEW
├── game_analytics_service.py     # NEW
└── audit_service.py              # EXTEND

models/
├── control_panel.py              # NEW - Control panel models
└── ...                           # Existing models

api/
├── v1/
│   ├── games/                    # NEW
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── dependencies.py
│   ├── players/                  # NEW
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── dependencies.py
│   ├── profit_loss/              # NEW
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── dependencies.py
│   └── ...
└── ...

migrations/
└── versions/
    ├── xxxx_create_games_table.py
    ├── xxxx_create_profit_loss_tables.py
    ├── xxxx_create_rbac_tables.py
    └── xxxx_create_player_balance_tables.py
```

---

## 🗄️ Alembic Migrations

### Migration 1: Create Games Table

**File**: `migrations/versions/001_create_games_table.py`

```python
from alembic import op
import sqlalchemy as sa
from datetime import datetime

def upgrade():
    op.create_table(
        'games',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('min_bet', sa.Numeric(15, 2), nullable=False, server_default='1.00'),
        sa.Column('max_bet', sa.Numeric(15, 2), nullable=False, server_default='10000.00'),
        sa.Column('house_edge', sa.Numeric(5, 2), nullable=False, server_default='5.00'),
        sa.Column('rtp', sa.Numeric(5, 2), nullable=False, server_default='95.00'),
        sa.Column('algorithm_mode', sa.String(50), nullable=False, server_default='FIXED_HOUSE_EDGE'),
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('play_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_volume', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_games_status', 'games', ['status'])
    op.create_index('idx_games_created', 'games', ['created_at'])


def downgrade():
    op.drop_index('idx_games_created', 'games')
    op.drop_index('idx_games_status', 'games')
    op.drop_table('games')
```

### Migration 2: Create Profit/Loss Tables

**File**: `migrations/versions/002_create_profit_loss_tables.py`

```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    # profit_loss_rules table
    op.create_table(
        'profit_loss_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=True),
        sa.Column('rule_name', sa.String(100), nullable=True),
        sa.Column('rule_type', sa.String(50), nullable=False),
        sa.Column('min_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('max_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('win_streak_threshold', sa.Integer(), nullable=True),
        sa.Column('loss_streak_threshold', sa.Integer(), nullable=True),
        sa.Column('house_edge_adjustment', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('payout_multiplier', sa.Numeric(5, 2), nullable=False, server_default='1.0'),
        sa.Column('loss_cap', sa.Numeric(15, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_profit_loss_game', 'profit_loss_rules', ['game_id'])
    op.create_index('idx_profit_loss_player', 'profit_loss_rules', ['player_id'])
    op.create_index('idx_profit_loss_active', 'profit_loss_rules', ['is_active', 'priority'])
    
    # profit_loss_player_rules table
    op.create_table(
        'profit_loss_player_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=True),
        sa.Column('custom_house_edge', sa.Numeric(5, 2), nullable=True),
        sa.Column('daily_loss_limit', sa.Numeric(15, 2), nullable=True),
        sa.Column('weekly_loss_limit', sa.Numeric(15, 2), nullable=True),
        sa.Column('max_payout_multiplier', sa.Numeric(5, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_player_rule_player', 'profit_loss_player_rules', ['player_id'])
    op.create_index('idx_player_rule_game', 'profit_loss_player_rules', ['game_id'])
    op.create_index('idx_player_rule_active', 'profit_loss_player_rules', ['is_active'])


def downgrade():
    op.drop_index('idx_player_rule_active', 'profit_loss_player_rules')
    op.drop_index('idx_player_rule_game', 'profit_loss_player_rules')
    op.drop_index('idx_player_rule_player', 'profit_loss_player_rules')
    op.drop_table('profit_loss_player_rules')
    
    op.drop_index('idx_profit_loss_active', 'profit_loss_rules')
    op.drop_index('idx_profit_loss_player', 'profit_loss_rules')
    op.drop_index('idx_profit_loss_game', 'profit_loss_rules')
    op.drop_table('profit_loss_rules')
```

### Migration 3: Create RBAC Tables

**File**: `migrations/versions/003_create_rbac_tables.py`

```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    # role_permissions table
    op.create_table(
        'role_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('role_name', sa.String(50), nullable=False),
        sa.Column('permission', sa.String(100), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_name', 'permission', name='uk_role_permission')
    )
    
    op.create_index('idx_role_perm_role', 'role_permissions', ['role_name'])
    op.create_index('idx_role_perm_active', 'role_permissions', ['is_active'])
    
    # user_roles table
    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_name', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('scope_game_ids', sa.String(500), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('assigned_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_name'], ['role_permissions.role_name']),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'role_name', name='uk_user_role')
    )
    
    op.create_index('idx_user_role_user', 'user_roles', ['user_id'])
    op.create_index('idx_user_role_active', 'user_roles', ['is_active'])


def downgrade():
    op.drop_index('idx_user_role_active', 'user_roles')
    op.drop_index('idx_user_role_user', 'user_roles')
    op.drop_table('user_roles')
    
    op.drop_index('idx_role_perm_active', 'role_permissions')
    op.drop_index('idx_role_perm_role', 'role_permissions')
    op.drop_table('role_permissions')
```

### Migration 4: Create Player Balance Tables

**File**: `migrations/versions/004_create_player_balance_tables.py`

```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    # player_balances table
    op.create_table(
        'player_balances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False, unique=True),
        sa.Column('current_balance', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_deposited', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_withdrawn', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_wagered', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_winnings', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('ban_reason', sa.String(255), nullable=True),
        sa.Column('ban_until', sa.DateTime(), nullable=True),
        sa.Column('balance_at_month_start', sa.Numeric(15, 2), nullable=True),
        sa.Column('balance_at_week_start', sa.Numeric(15, 2), nullable=True),
        sa.Column('balance_at_day_start', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_player_balance_player', 'player_balances', ['player_id'])
    op.create_index('idx_player_balance_banned', 'player_balances', ['is_banned'])
    
    # balance_transactions table
    op.create_table(
        'balance_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('game_id', sa.Integer(), nullable=True),
        sa.Column('game_session_id', sa.String(100), nullable=True),
        sa.Column('reference_id', sa.String(100), nullable=True),
        sa.Column('balance_before', sa.Numeric(15, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(15, 2), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('signature', sa.String(255), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['game_id'], ['games.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_balance_trans_player', 'balance_transactions', ['player_id'])
    op.create_index('idx_balance_trans_type', 'balance_transactions', ['transaction_type'])
    op.create_index('idx_balance_trans_created', 'balance_transactions', ['created_at'])
    op.create_index('idx_balance_trans_game', 'balance_transactions', ['game_id'])


def downgrade():
    op.drop_index('idx_balance_trans_game', 'balance_transactions')
    op.drop_index('idx_balance_trans_created', 'balance_transactions')
    op.drop_index('idx_balance_trans_type', 'balance_transactions')
    op.drop_index('idx_balance_trans_player', 'balance_transactions')
    op.drop_table('balance_transactions')
    
    op.drop_index('idx_player_balance_banned', 'player_balances')
    op.drop_index('idx_player_balance_player', 'player_balances')
    op.drop_table('player_balances')
```

---

## 📦 SQLAlchemy Models

### File: `models/control_panel.py`

```python
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
    __tablename__ = 'user_roles'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role_name = Column(String(50), ForeignKey('role_permissions.role_name'), nullable=False)
    
    is_active = Column(Boolean, default=True, nullable=False)
    scope_game_ids = Column(String(500), nullable=True)  # comma-separated
    
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    assigned_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'role_name', name='uk_user_role'),
        Index('idx_user_role_user', 'user_id'),
        Index('idx_user_role_active', 'is_active'),
    )
```

---

## 🧠 Service Classes (Template)

### File: `services/game_management_service.py`

```python
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.control_panel import Game, GameConfiguration
from schemas.games import GameCreate, GameUpdate, GameResponse
from services.audit_service import AuditService

class GameManagementService:
    def __init__(self, audit_service: AuditService):
        self.audit_service = audit_service
    
    async def create_game(self, session: AsyncSession, game_data: GameCreate, user_id: int) -> Game:
        """Create a new game"""
        # Check for duplicates
        existing = await session.execute(
            select(Game).where(Game.name == game_data.name)
        )
        if existing.scalar():
            raise ValueError(f"Game '{game_data.name}' already exists")
        
        # Create game
        game = Game(
            name=game_data.name,
            description=game_data.description,
            type=game_data.type,
            min_bet=game_data.min_bet,
            max_bet=game_data.max_bet,
            house_edge=game_data.house_edge,
            rtp=game_data.rtp,
            algorithm_mode=game_data.algorithm_mode,
            created_by=user_id,
            updated_by=user_id
        )
        
        session.add(game)
        await session.flush()
        
        # Audit log
        await self.audit_service.log_action(
            session=session,
            user_id=user_id,
            action_type='GAME_CREATED',
            resource_type='GAME',
            resource_id=game.id,
            changes={'created': game_data.dict()}
        )
        
        await session.commit()
        return game
    
    async def get_game(self, session: AsyncSession, game_id: int) -> Optional[Game]:
        """Get game by ID"""
        result = await session.execute(
            select(Game).where(Game.id == game_id)
        )
        return result.scalar()
    
    async def list_games(self, session: AsyncSession, skip: int = 0, limit: int = 100) -> List[Game]:
        """List all games with pagination"""
        result = await session.execute(
            select(Game)
            .order_by(Game.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def update_game(self, session: AsyncSession, game_id: int, updates: GameUpdate, user_id: int) -> Optional[Game]:
        """Update game settings"""
        game = await self.get_game(session, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        # Track changes
        changes = {}
        for field, value in updates.dict(exclude_unset=True).items():
            old_value = getattr(game, field)
            if old_value != value:
                changes[field] = {'old': str(old_value), 'new': str(value)}
                setattr(game, field, value)
        
        game.updated_by = user_id
        game.updated_at = datetime.utcnow()
        
        if changes:
            await self.audit_service.log_action(
                session=session,
                user_id=user_id,
                action_type='GAME_UPDATED',
                resource_type='GAME',
                resource_id=game_id,
                changes=changes
            )
        
        await session.commit()
        return game
    
    async def delete_game(self, session: AsyncSession, game_id: int, user_id: int) -> bool:
        """Delete game (soft delete via status)"""
        game = await self.get_game(session, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        game.status = 'archived'
        game.updated_by = user_id
        game.updated_at = datetime.utcnow()
        
        await self.audit_service.log_action(
            session=session,
            user_id=user_id,
            action_type='GAME_ARCHIVED',
            resource_type='GAME',
            resource_id=game_id,
            changes={}
        )
        
        await session.commit()
        return True
```

---

## 🚀 Next Steps for Phase 2

1. **Create Alembic migrations** - Run each migration to create tables
2. **Add models to SQLAlchemy** - Import in models/__init__.py
3. **Implement services** - Create game_management_service.py, player_management_service.py, etc.
4. **Create Pydantic schemas** - Request/response models
5. **Build API routers** - FastAPI endpoints
6. **Write unit tests** - Service and API tests
7. **Document API** - OpenAPI/Swagger specs

---

## 📝 Running Migrations

```bash
# In project root

# Create new migration
alembic revision --autogenerate -m "Create control panel tables"

# Apply migrations
alembic upgrade head

# Check status
alembic current

# View migration history
alembic history
```

---

## ✅ Phase 2 Checklist

- [ ] Run Alembic migrations
- [ ] Verify tables created in database
- [ ] Create SQLAlchemy models
- [ ] Create service classes
- [ ] Create Pydantic schemas
- [ ] Create API routers
- [ ] Write unit tests
- [ ] Integration tests
- [ ] API documentation

