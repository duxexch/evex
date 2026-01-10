# Game Control Panel - Quick Start Implementation Guide

## 🚀 Get Started in 5 Minutes

This guide helps you begin Phase 2 implementation immediately.

---

## ⚡ Quick Start Checklist

```
Before you start, ensure you have:
- [ ] Python 3.10+ installed
- [ ] PostgreSQL 15+ running
- [ ] Git configured
- [ ] Project cloned and dependencies installed
- [ ] Environment variables configured
- [ ] Database connection working
```

---

## 📋 Step 1: Setup Development Environment

### 1.1 Clone/Update Repository

```bash
cd /workspaces/botv

# Update all documentation
git add .
git commit -m "Add Game Control Panel Phase 1 documentation"

# Create feature branch for Phase 2
git checkout -b feature/control-panel-phase-2
```

### 1.2 Verify Python Environment

```bash
# Check Python version
python --version  # Should be 3.10+

# Check virtual environment
which python  # Should show venv path

# Install/update dependencies
pip install -r requirements.txt
```

### 1.3 Verify Database Connection

```bash
# Test database connection
python -c "
from sqlalchemy import create_engine
from config import settings
engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    result = conn.execute('SELECT 1')
    print('✅ Database connected successfully')
"
```

---

## 📁 Step 2: Create Directory Structure

### 2.1 Create Services Directory

```bash
# Create new service files
mkdir -p services/control_panel

# Copy the template services
touch services/control_panel/__init__.py
touch services/control_panel/game_management_service.py
touch services/control_panel/player_management_service.py
touch services/control_panel/profit_loss_service.py
touch services/control_panel/rbac_service.py
touch services/control_panel/game_analytics_service.py
```

### 2.2 Create API Directory

```bash
# Create API routing structure
mkdir -p api/v1/control_panel/{games,players,profit_loss,analytics,audit,roles}

# Create __init__.py files
for dir in api/v1/control_panel/{games,players,profit_loss,analytics,audit,roles}; do
  touch "$dir/__init__.py"
  touch "$dir/router.py"
  touch "$dir/schemas.py"
  touch "$dir/dependencies.py"
done
```

### 2.3 Create Models Directory

```bash
# Create control panel models
touch models/control_panel.py

# Update models/__init__.py to include new models
```

### 2.4 Create Migrations Directory

```bash
# Create migration files (if using Alembic)
touch migrations/versions/001_create_games_table.py
touch migrations/versions/002_create_profit_loss_tables.py
touch migrations/versions/003_create_rbac_tables.py
touch migrations/versions/004_create_player_balance_tables.py
touch migrations/versions/005_init_rbac_data.py
```

---

## 🗄️ Step 3: Database Setup

### 3.1 Create Models

Copy the SQLAlchemy models from `PHASE_2_DATABASE_BACKEND.md` into `models/control_panel.py`:

```bash
# Add imports to models/__init__.py
cat >> models/__init__.py << 'EOF'

from models.control_panel import (
    Game,
    GameConfiguration,
    ProfitLossRule,
    ProfitLossPlayerRule,
    PlayerBalance,
    BalanceTransaction,
    RolePermission,
    UserRole
)

__all__ = [
    "Game",
    "GameConfiguration",
    "ProfitLossRule",
    "ProfitLossPlayerRule",
    "PlayerBalance",
    "BalanceTransaction",
    "RolePermission",
    "UserRole",
]
EOF
```

### 3.2 Create Migrations (if using Alembic)

```bash
# Initialize Alembic if not already done
# alembic init migrations

# Create migration
alembic revision --autogenerate -m "Add control panel tables"

# OR manually copy migration files from PHASE_2_DATABASE_BACKEND.md
# into migrations/versions/

# Review migration before running
cat migrations/versions/$(ls -t migrations/versions/ | head -1)

# Apply migrations
alembic upgrade head

# Verify migration
alembic current
```

### 3.3 Verify Database Schema

```bash
# Connect to database and verify tables
psql $DATABASE_URL << 'EOF'
\dt games*
\dt profit_loss*
\dt role_permissions*
\dt user_roles*
\dt player_balances*
\dt balance_transactions*
\q
EOF
```

---

## 🧠 Step 4: Implement Services

### 4.1 Implement GameManagementService

Create `services/control_panel/game_management_service.py`:

```python
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.control_panel import Game, GameConfiguration
from schemas.control_panel import GameCreate, GameUpdate, GameResponse
from services.audit_service import AuditService

class GameManagementService:
    def __init__(self, audit_service: AuditService):
        self.audit_service = audit_service
    
    async def create_game(self, session: AsyncSession, game_data: GameCreate, user_id: int) -> Game:
        """Create a new game"""
        # Validate no duplicate
        existing = await session.execute(
            select(Game).where(Game.name == game_data.name)
        )
        if existing.scalar():
            raise ValueError(f"Game '{game_data.name}' already exists")
        
        # Create
        game = Game(
            name=game_data.name,
            description=game_data.description,
            type=game_data.type,
            min_bet=game_data.min_bet,
            max_bet=game_data.max_bet,
            house_edge=game_data.house_edge,
            rtp=game_data.rtp,
            created_by=user_id,
            updated_by=user_id
        )
        
        session.add(game)
        await session.flush()
        
        # Audit
        await self.audit_service.log_action(
            session=session,
            user_id=user_id,
            action_type='GAME_CREATED',
            resource_type='GAME',
            resource_id=game.id,
            details={'name': game.name}
        )
        
        await session.commit()
        return game
    
    async def get_game(self, session: AsyncSession, game_id: int) -> Optional[Game]:
        """Get game by ID"""
        return await session.get(Game, game_id)
    
    async def list_games(self, session: AsyncSession, skip: int = 0, limit: int = 100) -> List[Game]:
        """List games with pagination"""
        result = await session.execute(
            select(Game)
            .order_by(Game.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def update_game(self, session: AsyncSession, game_id: int, updates: GameUpdate, user_id: int) -> Optional[Game]:
        """Update game"""
        game = await self.get_game(session, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
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
                details=changes
            )
        
        await session.commit()
        return game
```

### 4.2 Implement PlayerManagementService

Create `services/control_panel/player_management_service.py`:

```python
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from models.control_panel import PlayerBalance, BalanceTransaction
from models import User
from schemas.control_panel import BalanceTransactionCreate
from services.audit_service import AuditService

class PlayerManagementService:
    def __init__(self, audit_service: AuditService):
        self.audit_service = audit_service
    
    async def get_player_balance(self, session: AsyncSession, player_id: int) -> Optional[PlayerBalance]:
        """Get player balance info"""
        return await session.get(PlayerBalance, {'player_id': player_id})
    
    async def deposit(self, session: AsyncSession, player_id: int, amount: Decimal, reason: str, admin_id: int) -> BalanceTransaction:
        """Deposit money for player"""
        if amount <= 0:
            raise ValueError("Amount must be positive")
        
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            raise ValueError(f"Player {player_id} balance not found")
        
        # Create transaction
        transaction = BalanceTransaction(
            player_id=player_id,
            transaction_type='DEPOSIT',
            amount=amount,
            description=reason,
            balance_before=balance.current_balance,
            balance_after=balance.current_balance + amount,
            created_by=admin_id
        )
        
        # Update balance
        balance.current_balance += amount
        balance.total_deposited += amount
        balance.updated_at = datetime.utcnow()
        
        session.add(transaction)
        await session.flush()
        
        # Audit
        await self.audit_service.log_action(
            session=session,
            user_id=admin_id,
            action_type='PLAYER_DEPOSIT',
            resource_type='PLAYER',
            resource_id=player_id,
            details={'amount': str(amount), 'reason': reason}
        )
        
        await session.commit()
        return transaction
    
    async def withdraw(self, session: AsyncSession, player_id: int, amount: Decimal, reason: str, admin_id: int) -> BalanceTransaction:
        """Withdraw money from player"""
        if amount <= 0:
            raise ValueError("Amount must be positive")
        
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            raise ValueError(f"Player {player_id} balance not found")
        
        if balance.current_balance < amount:
            raise ValueError("Insufficient balance")
        
        # Create transaction
        transaction = BalanceTransaction(
            player_id=player_id,
            transaction_type='WITHDRAWAL',
            amount=amount,
            description=reason,
            balance_before=balance.current_balance,
            balance_after=balance.current_balance - amount,
            created_by=admin_id
        )
        
        # Update balance
        balance.current_balance -= amount
        balance.total_withdrawn += amount
        balance.updated_at = datetime.utcnow()
        
        session.add(transaction)
        await session.flush()
        
        # Audit
        await self.audit_service.log_action(
            session=session,
            user_id=admin_id,
            action_type='PLAYER_WITHDRAWAL',
            resource_type='PLAYER',
            resource_id=player_id,
            details={'amount': str(amount), 'reason': reason}
        )
        
        await session.commit()
        return transaction
```

### 4.3 Implement RBACService

Create `services/control_panel/rbac_service.py`:

```python
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.control_panel import UserRole, RolePermission
from services.audit_service import AuditService

class RBACService:
    def __init__(self, audit_service: AuditService):
        self.audit_service = audit_service
    
    async def check_permission(
        self, 
        session: AsyncSession, 
        user_id: int, 
        permission: str
    ) -> bool:
        """Check if user has permission"""
        # Get user's active roles
        user_roles = await session.execute(
            select(UserRole).where(
                (UserRole.user_id == user_id) &
                (UserRole.is_active == True)
            )
        )
        
        roles = [ur.role_name for ur in user_roles.scalars().all()]
        
        if not roles:
            return False
        
        # Check if any role has the permission
        role_perms = await session.execute(
            select(RolePermission).where(
                (RolePermission.role_name.in_(roles)) &
                (RolePermission.permission == permission) &
                (RolePermission.is_active == True)
            )
        )
        
        return role_perms.scalar() is not None
    
    async def assign_role(
        self,
        session: AsyncSession,
        user_id: int,
        role_name: str,
        assigned_by: int
    ) -> UserRole:
        """Assign role to user"""
        # Check role exists
        role_check = await session.execute(
            select(RolePermission).where(
                (RolePermission.role_name == role_name) &
                (RolePermission.is_active == True)
            )
        )
        
        if not role_check.scalar():
            raise ValueError(f"Role '{role_name}' not found")
        
        # Create user role
        user_role = UserRole(
            user_id=user_id,
            role_name=role_name,
            assigned_by=assigned_by
        )
        
        session.add(user_role)
        await session.flush()
        
        # Audit
        await self.audit_service.log_action(
            session=session,
            user_id=assigned_by,
            action_type='ROLE_ASSIGNED',
            resource_type='USER',
            resource_id=user_id,
            details={'role': role_name}
        )
        
        await session.commit()
        return user_role
```

---

## 📡 Step 5: Create Pydantic Schemas

Create `schemas/control_panel.py`:

```python
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Optional

# Game Schemas
class GameCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    type: Optional[str] = None
    min_bet: Decimal = Decimal('1.00')
    max_bet: Decimal = Decimal('10000.00')
    house_edge: Decimal = Field(default=Decimal('5.00'), ge=0, le=100)
    rtp: Decimal = Field(default=Decimal('95.00'), ge=0, le=100)
    algorithm_mode: str = 'FIXED_HOUSE_EDGE'

class GameUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    min_bet: Optional[Decimal] = None
    max_bet: Optional[Decimal] = None
    house_edge: Optional[Decimal] = None
    rtp: Optional[Decimal] = None
    status: Optional[str] = None

class GameResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: Optional[str]
    status: str
    min_bet: Decimal
    max_bet: Decimal
    house_edge: Decimal
    rtp: Decimal
    play_count: int
    total_volume: Decimal
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Balance Schemas
class DepositRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., min_length=1)

class WithdrawRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., min_length=1)

class BalanceTransactionResponse(BaseModel):
    id: int
    player_id: int
    transaction_type: str
    amount: Decimal
    description: Optional[str]
    balance_before: Decimal
    balance_after: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True

# RBAC Schemas
class RoleAssignRequest(BaseModel):
    role_name: str = Field(..., min_length=1)
    scope_game_ids: Optional[str] = None
```

---

## 🔌 Step 6: Create API Routers

Create `api/v1/control_panel/games/router.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from models.control_panel import Game
from schemas.control_panel import GameCreate, GameUpdate, GameResponse
from services.control_panel.game_management_service import GameManagementService
from api.dependencies import get_db, get_current_user

router = APIRouter(prefix="/games", tags=["games"])

@router.post("/", response_model=GameResponse)
async def create_game(
    game_data: GameCreate,
    session: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new game"""
    try:
        service = GameManagementService()
        game = await service.create_game(session, game_data, current_user.id)
        return game
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: int,
    session: AsyncSession = Depends(get_db)
):
    """Get game by ID"""
    service = GameManagementService()
    game = await service.get_game(session, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@router.get("/", response_model=List[GameResponse])
async def list_games(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_db)
):
    """List all games"""
    service = GameManagementService()
    games = await service.list_games(session, skip, limit)
    return games

@router.put("/{game_id}", response_model=GameResponse)
async def update_game(
    game_id: int,
    updates: GameUpdate,
    session: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update game"""
    try:
        service = GameManagementService()
        game = await service.update_game(session, game_id, updates, current_user.id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        return game
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

---

## 🧪 Step 7: Register Routes in Main App

Update `api/v1/__init__.py` or `main.py`:

```python
from api.v1.control_panel.games.router import router as games_router
from api.v1.control_panel.players.router import router as players_router

# In your app initialization
app.include_router(games_router, prefix="/api/v1/games")
app.include_router(players_router, prefix="/api/v1/players")
# ... other routers
```

---

## ✅ Step 8: Test It Out

### 8.1 Create Test File

Create `tests/test_games_api.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient

from main import app
from models.control_panel import Game
from schemas.control_panel import GameCreate

@pytest.mark.asyncio
async def test_create_game():
    async with AsyncClient(app=app, base_url="http://test") as client:
        game_data = {
            "name": "Test Game",
            "description": "Test Description",
            "type": "casino",
            "min_bet": 1.00,
            "max_bet": 1000.00,
            "house_edge": 5.0,
            "rtp": 95.0
        }
        
        response = await client.post("/api/v1/games", json=game_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Game"
        assert data["id"] is not None

@pytest.mark.asyncio
async def test_list_games():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
```

### 8.2 Run Tests

```bash
# Run all tests
pytest tests/test_games_api.py -v

# Run with coverage
pytest tests/test_games_api.py --cov=services --cov=api
```

---

## 📋 Next Phase Checklist

- [ ] Database migrations applied
- [ ] Models created and tested
- [ ] Services implemented
- [ ] Pydantic schemas defined
- [ ] API routers created and registered
- [ ] Tests written and passing
- [ ] API documentation generated
- [ ] Security review completed

---

## 🚀 Deploy Phase 2

Once complete:

```bash
# Commit changes
git add .
git commit -m "Implement Phase 2: Database & Backend"

# Create pull request
git push origin feature/control-panel-phase-2

# Create PR for review before merging to main
```

---

## 📞 Get Help

If you encounter issues:

1. Check `PHASE_2_DATABASE_BACKEND.md` for detailed guidance
2. Review `PHASE_1_CONTROL_PANEL_ANALYSIS.md` for architecture
3. Check error logs and debug output
4. Ask team lead for support

---

## 🎯 Success Indicators

Phase 2 is complete when:

- ✅ All database tables created
- ✅ All migrations passing
- ✅ All service methods working
- ✅ All API endpoints responding
- ✅ Test suite passing (80%+ coverage)
- ✅ Code review approved
- ✅ Documentation complete

**Estimated Time**: 2 weeks with 1 backend engineer

Ready to start? Let's go! 🚀

