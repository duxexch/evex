"""
Player Management Service
Handles player account management, balances, and ban controls
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from decimal import Decimal
from datetime import datetime

from models.control_panel import PlayerBalance, BalanceTransaction


class PlayerManagementService:
    """Service for managing player accounts and balances"""
    
    def __init__(self):
        pass
    
    async def get_player_balance(
        self, 
        session: AsyncSession, 
        player_id: int
    ) -> Optional[PlayerBalance]:
        """Get player balance record"""
        result = await session.execute(
            select(PlayerBalance).where(PlayerBalance.player_id == player_id)
        )
        return result.scalar_one_or_none()
    
    async def create_player_balance(
        self,
        session: AsyncSession,
        player_id: int
    ) -> PlayerBalance:
        """Create initial player balance record"""
        # Check if already exists
        existing = await self.get_player_balance(session, player_id)
        if existing:
            return existing
        
        balance = PlayerBalance(
            player_id=player_id,
            current_balance=Decimal('0.00'),
            total_deposited=Decimal('0.00'),
            total_withdrawn=Decimal('0.00'),
            total_wagered=Decimal('0.00'),
            total_winnings=Decimal('0.00')
        )
        
        session.add(balance)
        await session.commit()
        await session.refresh(balance)
        
        return balance
    
    async def adjust_balance(
        self,
        session: AsyncSession,
        player_id: int,
        amount: Decimal,
        transaction_type: str,
        description: str = None,
        game_id: int = None,
        game_session_id: str = None,
        reference_id: str = None,
        created_by: int = None
    ) -> BalanceTransaction:
        """Adjust player balance and record transaction"""
        # Get or create balance record
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            balance = await self.create_player_balance(session, player_id)
        
        # Record balance before
        balance_before = balance.current_balance
        
        # Apply adjustment
        balance.current_balance += amount
        
        # Update totals based on transaction type
        if transaction_type == 'deposit':
            balance.total_deposited += amount
        elif transaction_type == 'withdrawal':
            balance.total_withdrawn += abs(amount)
        elif transaction_type == 'game_payout':
            balance.total_winnings += amount if amount > 0 else Decimal('0')
        
        balance.updated_at = datetime.utcnow()
        
        # Create transaction record
        transaction = BalanceTransaction(
            player_id=player_id,
            transaction_type=transaction_type,
            amount=amount,
            description=description,
            game_id=game_id,
            game_session_id=game_session_id,
            reference_id=reference_id,
            balance_before=balance_before,
            balance_after=balance.current_balance,
            created_by=created_by
        )
        
        session.add(transaction)
        await session.commit()
        await session.refresh(transaction)
        
        return transaction
    
    async def get_balance_transactions(
        self,
        session: AsyncSession,
        player_id: int,
        skip: int = 0,
        limit: int = 100,
        transaction_type: str = None
    ) -> List[BalanceTransaction]:
        """Get player balance transaction history"""
        query = select(BalanceTransaction).where(
            BalanceTransaction.player_id == player_id
        ).order_by(BalanceTransaction.created_at.desc())
        
        if transaction_type:
            query = query.where(BalanceTransaction.transaction_type == transaction_type)
        
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def ban_player(
        self,
        session: AsyncSession,
        player_id: int,
        reason: str,
        ban_until: datetime = None
    ) -> PlayerBalance:
        """Ban a player"""
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            balance = await self.create_player_balance(session, player_id)
        
        balance.is_banned = True
        balance.ban_reason = reason
        balance.ban_until = ban_until
        balance.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(balance)
        
        return balance
    
    async def unban_player(
        self,
        session: AsyncSession,
        player_id: int
    ) -> PlayerBalance:
        """Unban a player"""
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            raise ValueError(f"Player {player_id} balance not found")
        
        balance.is_banned = False
        balance.ban_reason = None
        balance.ban_until = None
        balance.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(balance)
        
        return balance
    
    async def is_player_banned(
        self,
        session: AsyncSession,
        player_id: int
    ) -> bool:
        """Check if player is currently banned"""
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            return False
        
        # Check if banned
        if not balance.is_banned:
            return False
        
        # Check if ban expired
        if balance.ban_until and balance.ban_until < datetime.utcnow():
            # Auto-unban expired bans
            await self.unban_player(session, player_id)
            return False
        
        return True
    
    async def get_player_statistics(
        self,
        session: AsyncSession,
        player_id: int
    ) -> Dict[str, Any]:
        """Get comprehensive player statistics"""
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            return {
                'player_id': player_id,
                'current_balance': 0.0,
                'total_deposited': 0.0,
                'total_withdrawn': 0.0,
                'total_wagered': 0.0,
                'total_winnings': 0.0,
                'is_banned': False,
                'net_profit': 0.0
            }
        
        net_profit = float(balance.total_winnings - balance.total_wagered)
        
        return {
            'player_id': player_id,
            'current_balance': float(balance.current_balance),
            'total_deposited': float(balance.total_deposited),
            'total_withdrawn': float(balance.total_withdrawn),
            'total_wagered': float(balance.total_wagered),
            'total_winnings': float(balance.total_winnings),
            'is_banned': balance.is_banned,
            'ban_reason': balance.ban_reason,
            'ban_until': balance.ban_until.isoformat() if balance.ban_until else None,
            'net_profit': net_profit,
            'created_at': balance.created_at.isoformat() if balance.created_at else None
        }
    
    async def record_wager(
        self,
        session: AsyncSession,
        player_id: int,
        wager_amount: Decimal,
        game_id: int = None,
        game_session_id: str = None
    ) -> None:
        """Record a player wager"""
        balance = await self.get_player_balance(session, player_id)
        if not balance:
            balance = await self.create_player_balance(session, player_id)
        
        balance.total_wagered += wager_amount
        balance.updated_at = datetime.utcnow()
        
        await session.commit()
    
    async def list_all_players(
        self,
        session: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        banned_only: bool = False
    ) -> List[PlayerBalance]:
        """List all players with balances"""
        query = select(PlayerBalance).order_by(PlayerBalance.created_at.desc())
        
        if banned_only:
            query = query.where(PlayerBalance.is_banned == True)
        
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def get_top_players_by_volume(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top players by wagered volume"""
        result = await session.execute(
            select(PlayerBalance)
            .order_by(PlayerBalance.total_wagered.desc())
            .limit(limit)
        )
        players = result.scalars().all()
        
        return [
            {
                'player_id': p.player_id,
                'total_wagered': float(p.total_wagered),
                'total_winnings': float(p.total_winnings),
                'current_balance': float(p.current_balance)
            }
            for p in players
        ]
