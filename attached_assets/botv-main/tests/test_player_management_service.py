"""
Tests for Player Management Service
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models.control_panel import PlayerBalance, BalanceTransaction, Base
from services.control_panel import PlayerManagementService


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
class TestPlayerManagementService:
    """Test PlayerManagementService"""
    
    async def test_create_player_balance(self, async_session):
        """Test creating player balance"""
        service = PlayerManagementService()
        
        balance = await service.create_player_balance(async_session, player_id=1)
        
        assert balance.player_id == 1
        assert balance.current_balance == Decimal('0.00')
        assert balance.is_banned == False
    
    async def test_get_player_balance(self, async_session):
        """Test getting player balance"""
        service = PlayerManagementService()
        
        created = await service.create_player_balance(async_session, player_id=1)
        retrieved = await service.get_player_balance(async_session, player_id=1)
        
        assert retrieved is not None
        assert retrieved.player_id == 1
    
    async def test_adjust_balance_deposit(self, async_session):
        """Test adjusting balance with deposit"""
        service = PlayerManagementService()
        
        # Create balance
        await service.create_player_balance(async_session, player_id=1)
        
        # Make deposit
        transaction = await service.adjust_balance(
            async_session,
            player_id=1,
            amount=Decimal('100.00'),
            transaction_type='deposit'
        )
        
        assert transaction.amount == Decimal('100.00')
        assert transaction.transaction_type == 'deposit'
        
        # Check balance updated
        balance = await service.get_player_balance(async_session, player_id=1)
        assert balance.current_balance == Decimal('100.00')
        assert balance.total_deposited == Decimal('100.00')
    
    async def test_adjust_balance_withdrawal(self, async_session):
        """Test adjusting balance with withdrawal"""
        service = PlayerManagementService()
        
        # Create balance with funds
        balance = await service.create_player_balance(async_session, player_id=1)
        balance.current_balance = Decimal('100.00')
        await async_session.commit()
        
        # Make withdrawal
        transaction = await service.adjust_balance(
            async_session,
            player_id=1,
            amount=Decimal('-50.00'),
            transaction_type='withdrawal'
        )
        
        # Check balance updated
        updated_balance = await service.get_player_balance(async_session, player_id=1)
        assert updated_balance.current_balance == Decimal('50.00')
        assert updated_balance.total_withdrawn == Decimal('50.00')
    
    async def test_ban_player(self, async_session):
        """Test banning a player"""
        service = PlayerManagementService()
        
        await service.create_player_balance(async_session, player_id=1)
        
        balance = await service.ban_player(
            async_session,
            player_id=1,
            reason="Suspicious activity"
        )
        
        assert balance.is_banned == True
        assert balance.ban_reason == "Suspicious activity"
    
    async def test_unban_player(self, async_session):
        """Test unbanning a player"""
        service = PlayerManagementService()
        
        # Ban player
        await service.ban_player(
            async_session,
            player_id=1,
            reason="Test ban"
        )
        
        # Unban player
        balance = await service.unban_player(async_session, player_id=1)
        
        assert balance.is_banned == False
        assert balance.ban_reason is None
    
    async def test_is_player_banned(self, async_session):
        """Test checking if player is banned"""
        service = PlayerManagementService()
        
        await service.create_player_balance(async_session, player_id=1)
        
        # Check not banned
        is_banned = await service.is_player_banned(async_session, player_id=1)
        assert is_banned == False
        
        # Ban player
        await service.ban_player(
            async_session,
            player_id=1,
            reason="Test"
        )
        
        # Check banned
        is_banned = await service.is_player_banned(async_session, player_id=1)
        assert is_banned == True
    
    async def test_ban_expiration(self, async_session):
        """Test ban expiration"""
        service = PlayerManagementService()
        
        # Ban player with past expiry
        expired_time = datetime.utcnow() - timedelta(hours=1)
        await service.ban_player(
            async_session,
            player_id=1,
            reason="Test",
            ban_until=expired_time
        )
        
        # Check should auto-unban
        is_banned = await service.is_player_banned(async_session, player_id=1)
        assert is_banned == False
    
    async def test_get_player_statistics(self, async_session):
        """Test getting player statistics"""
        service = PlayerManagementService()
        
        # Create balance with some data
        balance = await service.create_player_balance(async_session, player_id=1)
        balance.current_balance = Decimal('500.00')
        balance.total_deposited = Decimal('1000.00')
        balance.total_withdrawn = Decimal('300.00')
        balance.total_wagered = Decimal('200.00')
        balance.total_winnings = Decimal('150.00')
        await async_session.commit()
        
        stats = await service.get_player_statistics(async_session, player_id=1)
        
        assert stats['current_balance'] == 500.0
        assert stats['total_deposited'] == 1000.0
        assert stats['total_withdrawn'] == 300.0
        assert stats['net_profit'] == -50.0  # 150 - 200
    
    async def test_get_transaction_history(self, async_session):
        """Test getting transaction history"""
        service = PlayerManagementService()
        
        # Create balance and make transactions
        await service.create_player_balance(async_session, player_id=1)
        
        for i in range(3):
            await service.adjust_balance(
                async_session,
                player_id=1,
                amount=Decimal(f'{100.00 * (i+1)}'),
                transaction_type='deposit'
            )
        
        transactions = await service.get_balance_transactions(
            async_session,
            player_id=1
        )
        
        assert len(transactions) == 3
    
    async def test_top_players_by_volume(self, async_session):
        """Test getting top players by volume"""
        service = PlayerManagementService()
        
        # Create multiple players with different volumes
        for player_id in range(1, 6):
            balance = await service.create_player_balance(async_session, player_id=player_id)
            balance.total_wagered = Decimal(f'{100.00 * player_id}')
            await async_session.commit()
        
        top_players = await service.get_top_players_by_volume(async_session, limit=3)
        
        assert len(top_players) == 3
        assert top_players[0]['player_id'] == 5  # Highest volume
