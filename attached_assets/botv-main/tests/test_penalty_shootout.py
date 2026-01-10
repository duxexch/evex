"""
Penalty Shootout Game - Unit & Integration Tests
"""

import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models.penalty_shootout import (
    PenaltyShootoutGame,
    PenaltyShootoutSession,
    PenaltyShootoutRound,
    PenaltyShotDirection,
    PenaltyShotOutcome,
    Base
)
from models import User, Transaction, AuditLog
from services.games.penalty_shootout_service import PenaltyShootoutService


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
async def db():
    """Create test database"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with Session() as session:
        yield session
    
    await engine.dispose()


@pytest.fixture
async def test_user(db):
    """Create test user"""
    user = User(
        id=1,
        telegram_id=123456,
        username="testuser",
        first_name="Test",
        balance=Decimal("1000.00")
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_game(db):
    """Create test game"""
    game = PenaltyShootoutGame(
        name="Test Penalty Game",
        description="Test game description",
        min_bet_amount=Decimal("1.0"),
        max_bet_amount=Decimal("100.0"),
        min_rounds=1,
        max_rounds=5,
        goal_multiplier=Decimal("2.0"),
        keeper_save_probability=Decimal("30.0"),
        is_active=True,
        created_by_admin_id=1
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return game


# ============================================================================
# GAME MANAGEMENT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_create_game(db, test_user):
    """Test game creation"""
    service = PenaltyShootoutService(db)
    
    game = await service.create_game(
        name="New Penalty Game",
        description="A new penalty shootout game",
        min_bet=Decimal("5.0"),
        max_bet=Decimal("500.0"),
        min_rounds=1,
        max_rounds=3,
        admin_id=test_user.id
    )
    
    assert game.name == "New Penalty Game"
    assert game.min_bet_amount == Decimal("5.0")
    assert game.max_bet_amount == Decimal("500.0")
    assert game.is_active is True


@pytest.mark.asyncio
async def test_get_game(db, test_game):
    """Test game retrieval"""
    service = PenaltyShootoutService(db)
    
    game = await service.get_game(test_game.id)
    
    assert game is not None
    assert game.name == test_game.name


@pytest.mark.asyncio
async def test_get_active_games(db, test_game):
    """Test getting active games"""
    service = PenaltyShootoutService(db)
    
    games = await service.get_active_games()
    
    assert len(games) == 1
    assert games[0].name == test_game.name


# ============================================================================
# SESSION MANAGEMENT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_create_session(db, test_user, test_game):
    """Test session creation"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=3
    )
    
    assert session.player_id == test_user.id
    assert session.game_id == test_game.id
    assert session.num_rounds == 3
    assert session.is_active is True
    assert session.initial_balance == Decimal("1000.00")


@pytest.mark.asyncio
async def test_create_session_invalid_rounds(db, test_user, test_game):
    """Test session creation with invalid rounds"""
    service = PenaltyShootoutService(db)
    
    with pytest.raises(ValueError):
        await service.create_session(
            player_id=test_user.id,
            game_id=test_game.id,
            num_rounds=10  # More than max_rounds
        )


@pytest.mark.asyncio
async def test_get_session(db, test_user, test_game):
    """Test session retrieval"""
    service = PenaltyShootoutService(db)
    
    created_session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=2
    )
    
    retrieved_session = await service.get_session(created_session.session_id)
    
    assert retrieved_session is not None
    assert retrieved_session.session_id == created_session.session_id


# ============================================================================
# SHOT MECHANICS TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_take_shot_valid(db, test_user, test_game):
    """Test taking a valid shot"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    # Refresh user to get updated balance
    await db.refresh(test_user)
    
    round_record, result = await service.take_shot(
        session_id=session.session_id,
        bet_amount=Decimal("10.0"),
        shot_direction=PenaltyShotDirection.LEFT
    )
    
    assert round_record is not None
    assert round_record.bet_amount == Decimal("10.0")
    assert round_record.outcome in [PenaltyShotOutcome.GOAL, PenaltyShotOutcome.SAVED, PenaltyShotOutcome.MISS]
    assert result['new_balance']  # Balance should be updated


@pytest.mark.asyncio
async def test_take_shot_insufficient_balance(db, test_user, test_game):
    """Test shot with insufficient balance"""
    service = PenaltyShootoutService(db)
    
    # Create user with low balance
    low_balance_user = User(
        id=2,
        telegram_id=654321,
        username="pooruser",
        first_name="Poor",
        balance=Decimal("0.50")
    )
    db.add(low_balance_user)
    await db.commit()
    
    session = await service.create_session(
        player_id=low_balance_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    with pytest.raises(ValueError, match="Insufficient balance"):
        await service.take_shot(
            session_id=session.session_id,
            bet_amount=Decimal("10.0"),
            shot_direction=PenaltyShotDirection.CENTER
        )


@pytest.mark.asyncio
async def test_take_shot_bet_too_low(db, test_user, test_game):
    """Test shot with bet below minimum"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    with pytest.raises(ValueError, match="below minimum"):
        await service.take_shot(
            session_id=session.session_id,
            bet_amount=Decimal("0.50"),
            shot_direction=PenaltyShotDirection.RIGHT
        )


@pytest.mark.asyncio
async def test_take_shot_bet_too_high(db, test_user, test_game):
    """Test shot with bet above maximum"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    with pytest.raises(ValueError, match="exceeds maximum"):
        await service.take_shot(
            session_id=session.session_id,
            bet_amount=Decimal("500.0"),
            shot_direction=PenaltyShotDirection.CENTER
        )


# ============================================================================
# BALANCE TRACKING TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_balance_deducted_on_shot(db, test_user, test_game):
    """Test that bet is deducted from balance"""
    service = PenaltyShootoutService(db)
    
    initial_balance = test_user.balance
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    await service.take_shot(
        session_id=session.session_id,
        bet_amount=Decimal("10.0"),
        shot_direction=PenaltyShotDirection.LEFT
    )
    
    # Refresh user
    await db.refresh(test_user)
    
    # Balance should be reduced by at least the bet amount
    assert test_user.balance <= initial_balance - Decimal("10.0")


@pytest.mark.asyncio
async def test_balance_credited_on_goal(db, test_user, test_game):
    """Test that winnings are credited on goal"""
    service = PenaltyShootoutService(db)
    
    # Run multiple shots to increase chance of goal
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    initial_balance = Decimal("1000.00")
    
    # Take multiple shots to potentially get a goal
    for _ in range(10):
        try:
            round_record, result = await service.take_shot(
                session_id=session.session_id,
                bet_amount=Decimal("50.0"),
                shot_direction=PenaltyShotDirection.CENTER
            )
            
            if result['outcome'] == PenaltyShotOutcome.GOAL.value:
                # Found a goal, verify balance increased
                await db.refresh(test_user)
                assert test_user.balance > initial_balance - Decimal("50.0")
                break
        except ValueError:
            break


# ============================================================================
# MULTIPLE ROUNDS TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_multiple_rounds_session(db, test_user, test_game):
    """Test playing multiple rounds in one session"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=3
    )
    
    # Play 3 rounds
    for i in range(3):
        _, result = await service.take_shot(
            session_id=session.session_id,
            bet_amount=Decimal("10.0"),
            shot_direction=PenaltyShotDirection.CENTER
        )
        
        assert result['round'] == i + 1
        assert result['total_rounds'] == 3
    
    # Session should be completed
    await db.refresh(session)
    assert session.is_completed is True
    assert session.rounds_completed == 3


# ============================================================================
# TRANSACTION LOGGING TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_transaction_created_for_bet(db, test_user, test_game):
    """Test that transaction is created for bet"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    await service.take_shot(
        session_id=session.session_id,
        bet_amount=Decimal("10.0"),
        shot_direction=PenaltyShotDirection.LEFT
    )
    
    # Verify transaction exists
    from sqlalchemy import select
    result = await db.execute(
        select(Transaction).where(Transaction.user_id == test_user.id)
    )
    transactions = list(result.scalars().all())
    
    assert len(transactions) >= 1  # At least bet transaction


@pytest.mark.asyncio
async def test_audit_log_created(db, test_user, test_game):
    """Test that audit log is created"""
    service = PenaltyShootoutService(db)
    
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=1
    )
    
    await service.take_shot(
        session_id=session.session_id,
        bet_amount=Decimal("10.0"),
        shot_direction=PenaltyShotDirection.CENTER
    )
    
    # Verify audit log exists
    from sqlalchemy import select
    result = await db.execute(
        select(AuditLog)
    )
    logs = list(result.scalars().all())
    
    # Should have logs for game session and round
    assert any("penalty_shootout" in log.action for log in logs)


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_full_game_flow(db, test_user, test_game):
    """Test complete game flow"""
    service = PenaltyShootoutService(db)
    
    # 1. Create session
    session = await service.create_session(
        player_id=test_user.id,
        game_id=test_game.id,
        num_rounds=2
    )
    
    assert session.is_active is True
    
    initial_balance = test_user.balance
    
    # 2. Play 2 rounds
    for i in range(2):
        bet_amount = Decimal("20.0")
        direction = [
            PenaltyShotDirection.LEFT,
            PenaltyShotDirection.RIGHT
        ][i]
        
        round_record, result = await service.take_shot(
            session_id=session.session_id,
            bet_amount=bet_amount,
            shot_direction=direction
        )
        
        # Verify round data
        assert round_record.round_number == i + 1
        assert round_record.bet_amount == bet_amount
        assert round_record.outcome is not None
    
    # 3. Verify session is completed
    await db.refresh(session)
    assert session.is_completed is True
    
    # 4. Verify balance was updated
    await db.refresh(test_user)
    assert test_user.balance != initial_balance


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
