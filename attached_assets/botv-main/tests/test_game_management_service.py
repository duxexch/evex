"""
Tests for Game Management Service
"""
import pytest
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models.control_panel import Game, GameConfiguration, Base
from services.control_panel import GameManagementService


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


@pytest.mark.asyncio
class TestGameManagementService:
    """Test GameManagementService"""
    
    async def test_create_game(self, async_session):
        """Test creating a game"""
        service = GameManagementService()
        
        game = await service.create_game(
            async_session,
            name="Test Game",
            description="Test Description",
            min_bet=Decimal('1.00'),
            max_bet=Decimal('1000.00'),
            house_edge=Decimal('5.00'),
            user_id=1
        )
        
        assert game.name == "Test Game"
        assert game.status == "active"
        assert game.min_bet == Decimal('1.00')
        assert game.id is not None
    
    async def test_create_duplicate_game_raises_error(self, async_session):
        """Test creating duplicate game raises error"""
        service = GameManagementService()
        
        # Create first game
        await service.create_game(
            async_session,
            name="Test Game",
            user_id=1
        )
        
        # Try to create duplicate
        with pytest.raises(ValueError):
            await service.create_game(
                async_session,
                name="Test Game",
                user_id=1
            )
    
    async def test_get_game(self, async_session):
        """Test getting a game by ID"""
        service = GameManagementService()
        
        created_game = await service.create_game(
            async_session,
            name="Test Game",
            user_id=1
        )
        
        retrieved_game = await service.get_game(async_session, created_game.id)
        
        assert retrieved_game is not None
        assert retrieved_game.id == created_game.id
        assert retrieved_game.name == "Test Game"
    
    async def test_get_nonexistent_game_returns_none(self, async_session):
        """Test getting nonexistent game returns None"""
        service = GameManagementService()
        
        game = await service.get_game(async_session, 999)
        
        assert game is None
    
    async def test_list_games(self, async_session):
        """Test listing games"""
        service = GameManagementService()
        
        # Create multiple games
        for i in range(3):
            await service.create_game(
                async_session,
                name=f"Game {i}",
                user_id=1
            )
        
        games = await service.list_games(async_session, skip=0, limit=10)
        
        assert len(games) == 3
    
    async def test_update_game(self, async_session):
        """Test updating a game"""
        service = GameManagementService()
        
        game = await service.create_game(
            async_session,
            name="Original Name",
            house_edge=Decimal('5.00'),
            user_id=1
        )
        
        updated_game = await service.update_game(
            async_session,
            game.id,
            user_id=1,
            name="Updated Name",
            house_edge=Decimal('3.00')
        )
        
        assert updated_game.name == "Updated Name"
        assert updated_game.house_edge == Decimal('3.00')
    
    async def test_set_game_status(self, async_session):
        """Test setting game status"""
        service = GameManagementService()
        
        game = await service.create_game(
            async_session,
            name="Test Game",
            user_id=1
        )
        
        updated_game = await service.set_game_status(
            async_session,
            game.id,
            'maintenance',
            user_id=1
        )
        
        assert updated_game.status == "maintenance"
    
    async def test_get_game_configuration(self, async_session):
        """Test getting game configuration"""
        service = GameManagementService()
        
        game = await service.create_game(
            async_session,
            name="Test Game",
            user_id=1
        )
        
        config = await service.set_game_configuration(
            async_session,
            game.id,
            "test_key",
            "test_value",
            "string",
            user_id=1
        )
        
        assert config.config_key == "test_key"
        assert config.config_value == "test_value"
    
    async def test_list_game_configurations(self, async_session):
        """Test listing game configurations"""
        service = GameManagementService()
        
        game = await service.create_game(
            async_session,
            name="Test Game",
            user_id=1
        )
        
        # Create multiple configurations
        for i in range(3):
            await service.set_game_configuration(
                async_session,
                game.id,
                f"key_{i}",
                f"value_{i}",
                user_id=1
            )
        
        configs = await service.list_game_configurations(async_session, game.id)
        
        assert len(configs) == 3
    
    async def test_increment_play_count(self, async_session):
        """Test incrementing play count"""
        service = GameManagementService()
        
        game = await service.create_game(
            async_session,
            name="Test Game",
            user_id=1
        )
        
        initial_count = game.play_count
        
        await service.increment_play_count(
            async_session,
            game.id,
            Decimal('100.00')
        )
        
        updated_game = await service.get_game(async_session, game.id)
        
        assert updated_game.play_count == initial_count + 1
        assert updated_game.total_volume == Decimal('100.00')
