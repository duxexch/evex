"""
Tests for Profit/Loss Service
"""
import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models.control_panel import Game, ProfitLossRule, ProfitLossPlayerRule, Base
from services.control_panel import ProfitLossService


@pytest.fixture
async def async_session():
    """Create an async session for testing"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_maker() as session:
        yield session
    
    await engine.dispose()


@pytest.fixture
async def test_game(async_session):
    """Create a test game"""
    game = Game(name="Test Game", status="active")
    async_session.add(game)
    await async_session.commit()
    await async_session.refresh(game)
    return game


@pytest.mark.asyncio
class TestProfitLossService:
    """Test ProfitLossService"""
    
    async def test_create_rule(self, async_session, test_game):
        """Test creating a profit/loss rule"""
        service = ProfitLossService()
        
        rule = await service.create_rule(
            async_session,
            game_id=test_game.id,
            rule_name="Test Rule",
            rule_type="house_edge_adjustment",
            house_edge_adjustment=Decimal('2.00'),
            priority=50,
            user_id=1
        )
        
        assert rule.game_id == test_game.id
        assert rule.rule_name == "Test Rule"
        assert rule.is_active == True
    
    async def test_get_rule(self, async_session, test_game):
        """Test getting a rule"""
        service = ProfitLossService()
        
        created = await service.create_rule(
            async_session,
            game_id=test_game.id,
            rule_name="Test",
            rule_type="payout_multiplier",
            user_id=1
        )
        
        retrieved = await service.get_rule(async_session, created.id)
        
        assert retrieved is not None
        assert retrieved.id == created.id
    
    async def test_list_rules_for_game(self, async_session, test_game):
        """Test listing rules for a game"""
        service = ProfitLossService()
        
        # Create multiple rules
        for i in range(3):
            await service.create_rule(
                async_session,
                game_id=test_game.id,
                rule_name=f"Rule {i}",
                rule_type="house_edge_adjustment",
                user_id=1
            )
        
        rules = await service.list_rules_for_game(async_session, test_game.id)
        
        assert len(rules) == 3
    
    async def test_update_rule(self, async_session, test_game):
        """Test updating a rule"""
        service = ProfitLossService()
        
        rule = await service.create_rule(
            async_session,
            game_id=test_game.id,
            rule_name="Original",
            rule_type="house_edge_adjustment",
            priority=100,
            user_id=1
        )
        
        updated = await service.update_rule(
            async_session,
            rule.id,
            rule_name="Updated",
            priority=50
        )
        
        assert updated.rule_name == "Updated"
        assert updated.priority == 50
    
    async def test_activate_deactivate_rule(self, async_session, test_game):
        """Test activating and deactivating a rule"""
        service = ProfitLossService()
        
        rule = await service.create_rule(
            async_session,
            game_id=test_game.id,
            rule_name="Test",
            rule_type="loss_cap",
            user_id=1
        )
        
        # Deactivate
        deactivated = await service.deactivate_rule(async_session, rule.id)
        assert deactivated.is_active == False
        
        # Activate
        activated = await service.activate_rule(async_session, rule.id)
        assert activated.is_active == True
    
    async def test_create_player_rule(self, async_session, test_game):
        """Test creating a player-specific rule"""
        service = ProfitLossService()
        
        rule = await service.create_player_rule(
            async_session,
            player_id=1,
            game_id=test_game.id,
            custom_house_edge=Decimal('3.00'),
            daily_loss_limit=Decimal('100.00'),
            user_id=1
        )
        
        assert rule.player_id == 1
        assert rule.custom_house_edge == Decimal('3.00')
        assert rule.daily_loss_limit == Decimal('100.00')
    
    async def test_list_player_rules(self, async_session, test_game):
        """Test listing player rules"""
        service = ProfitLossService()
        
        # Create multiple player rules
        for i in range(2):
            await service.create_player_rule(
                async_session,
                player_id=1,
                game_id=test_game.id if i == 0 else None,
                user_id=1
            )
        
        rules = await service.list_player_rules(
            async_session,
            player_id=1
        )
        
        assert len(rules) == 2
    
    async def test_get_effective_settings(self, async_session, test_game):
        """Test getting effective settings"""
        service = ProfitLossService()
        
        # Create game rule
        await service.create_rule(
            async_session,
            game_id=test_game.id,
            rule_name="Game Rule",
            rule_type="house_edge_adjustment",
            house_edge_adjustment=Decimal('2.00'),
            user_id=1
        )
        
        # Create player rule
        await service.create_player_rule(
            async_session,
            player_id=1,
            game_id=test_game.id,
            custom_house_edge=Decimal('1.00'),
            user_id=1
        )
        
        settings = await service.get_effective_settings(
            async_session,
            player_id=1,
            game_id=test_game.id
        )
        
        assert settings['custom_house_edge'] == 1.0
        assert len(settings['game_rules']) > 0
    
    async def test_rule_date_validation(self, async_session):
        """Test rule date range validation"""
        service = ProfitLossService()
        
        today = date.today()
        
        rule = await service.create_player_rule(
            async_session,
            player_id=1,
            start_date=today,
            end_date=today,
            user_id=1
        )
        
        # Should be included in active rules
        rules = await service.list_player_rules(
            async_session,
            player_id=1,
            active_only=True
        )
        
        assert len(rules) == 1
