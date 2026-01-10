"""
Game Analytics Service
Provides analytics and reporting for games and players
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from decimal import Decimal
from datetime import datetime, timedelta, date

from models.control_panel import (
    Game, PlayerBalance, BalanceTransaction,
    ProfitLossRule, ProfitLossPlayerRule
)
from models.control_panel import (
    Agent,
    Commission,
    AgentStatus,
    Affiliate,
    AffiliateCommission,
    AffiliatePayout,
)
from models import CommissionState


class GameAnalyticsService:
    """Service for game and player analytics"""
    
    def __init__(self):
        pass
    
    async def get_game_performance(
        self,
        session: AsyncSession,
        game_id: int,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """Get performance metrics for a specific game"""
        game = await session.execute(
            select(Game).where(Game.id == game_id)
        )
        game = game.scalar_one_or_none()
        
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        # Build transaction query
        query = select(BalanceTransaction).where(
            BalanceTransaction.game_id == game_id
        )
        
        if start_date:
            query = query.where(BalanceTransaction.created_at >= start_date)
        if end_date:
            query = query.where(BalanceTransaction.created_at <= end_date)
        
        result = await session.execute(query)
        transactions = result.scalars().all()
        
        # Calculate metrics
        total_wagered = sum(
            abs(t.amount) for t in transactions 
            if t.transaction_type in ['game_payout', 'wager']
        )
        
        total_payouts = sum(
            t.amount for t in transactions 
            if t.transaction_type == 'game_payout' and t.amount > 0
        )
        
        transaction_count = len(transactions)
        
        return {
            'game_id': game.id,
            'game_name': game.name,
            'play_count': game.play_count,
            'total_volume': float(game.total_volume),
            'total_wagered': float(total_wagered),
            'total_payouts': float(total_payouts),
            'transaction_count': transaction_count,
            'house_edge': float(game.house_edge),
            'rtp': float(game.rtp),
            'status': game.status
        }
    
    async def get_overall_statistics(
        self,
        session: AsyncSession,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """Get overall platform statistics"""
        # Get all games
        games_result = await session.execute(select(Game))
        games = games_result.scalars().all()
        
        # Get all player balances
        balances_result = await session.execute(select(PlayerBalance))
        balances = balances_result.scalars().all()
        
        # Build transaction query
        trans_query = select(BalanceTransaction)
        
        if start_date:
            trans_query = trans_query.where(BalanceTransaction.created_at >= start_date)
        if end_date:
            trans_query = trans_query.where(BalanceTransaction.created_at <= end_date)
        
        trans_result = await session.execute(trans_query)
        transactions = trans_result.scalars().all()
        
        total_players = len(balances)
        active_players = sum(1 for b in balances if b.total_wagered > 0)
        banned_players = sum(1 for b in balances if b.is_banned)
        
        total_balance = sum(b.current_balance for b in balances)
        total_deposited = sum(b.total_deposited for b in balances)
        total_withdrawn = sum(b.total_withdrawn for b in balances)
        total_wagered = sum(b.total_wagered for b in balances)
        total_winnings = sum(b.total_winnings for b in balances)
        
        return {
            'total_games': len(games),
            'active_games': sum(1 for g in games if g.status == 'active'),
            'total_players': total_players,
            'active_players': active_players,
            'banned_players': banned_players,
            'total_balance': float(total_balance),
            'total_deposited': float(total_deposited),
            'total_withdrawn': float(total_withdrawn),
            'total_wagered': float(total_wagered),
            'total_winnings': float(total_winnings),
            'house_profit': float(total_wagered - total_winnings),
            'transaction_count': len(transactions)
        }
    
    async def get_top_games_by_volume(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top games by wagered volume"""
        result = await session.execute(
            select(Game)
            .where(Game.status == 'active')
            .order_by(desc(Game.total_volume))
            .limit(limit)
        )
        games = result.scalars().all()
        
        return [
            {
                'game_id': g.id,
                'game_name': g.name,
                'total_volume': float(g.total_volume),
                'play_count': g.play_count,
                'house_edge': float(g.house_edge)
            }
            for g in games
        ]
    
    async def get_player_performance(
        self,
        session: AsyncSession,
        player_id: int,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """Get performance metrics for a specific player"""
        balance = await session.execute(
            select(PlayerBalance).where(PlayerBalance.player_id == player_id)
        )
        balance = balance.scalar_one_or_none()
        
        if not balance:
            return {
                'player_id': player_id,
                'error': 'Player balance not found'
            }
        
        # Get transactions
        trans_query = select(BalanceTransaction).where(
            BalanceTransaction.player_id == player_id
        )
        
        if start_date:
            trans_query = trans_query.where(BalanceTransaction.created_at >= start_date)
        if end_date:
            trans_query = trans_query.where(BalanceTransaction.created_at <= end_date)
        
        trans_result = await session.execute(trans_query)
        transactions = trans_result.scalars().all()
        
        # Calculate metrics
        deposits = sum(
            t.amount for t in transactions 
            if t.transaction_type == 'deposit'
        )
        
        withdrawals = sum(
            abs(t.amount) for t in transactions 
            if t.transaction_type == 'withdrawal'
        )
        
        game_payouts = sum(
            t.amount for t in transactions 
            if t.transaction_type == 'game_payout'
        )
        
        return {
            'player_id': player_id,
            'current_balance': float(balance.current_balance),
            'total_deposited': float(balance.total_deposited),
            'total_withdrawn': float(balance.total_withdrawn),
            'total_wagered': float(balance.total_wagered),
            'total_winnings': float(balance.total_winnings),
            'net_profit': float(balance.total_winnings - balance.total_wagered),
            'is_banned': balance.is_banned,
            'period_deposits': float(deposits),
            'period_withdrawals': float(withdrawals),
            'period_payouts': float(game_payouts),
            'transaction_count': len(transactions)
        }
    
    async def get_daily_statistics(
        self,
        session: AsyncSession,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """Get daily statistics for the past N days"""
        results = []
        
        for i in range(days):
            day_start = datetime.now().replace(
                hour=0, minute=0, second=0, microsecond=0
            ) - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            stats = await self.get_overall_statistics(
                session,
                start_date=day_start,
                end_date=day_end
            )
            
            stats['date'] = day_start.date().isoformat()
            results.append(stats)
        
        return results
    
    async def get_profit_loss_summary(
        self,
        session: AsyncSession,
        game_id: int = None
    ) -> Dict[str, Any]:
        """Get profit/loss rule summary"""
        query = select(ProfitLossRule)
        
        if game_id:
            query = query.where(ProfitLossRule.game_id == game_id)
        
        result = await session.execute(query)
        rules = result.scalars().all()
        
        active_rules = [r for r in rules if r.is_active]
        inactive_rules = [r for r in rules if not r.is_active]
        
        return {
            'total_rules': len(rules),
            'active_rules': len(active_rules),
            'inactive_rules': len(inactive_rules),
            'rules_by_type': {
                'house_edge_adjustment': sum(
                    1 for r in active_rules 
                    if r.rule_type == 'house_edge_adjustment'
                ),
                'payout_multiplier': sum(
                    1 for r in active_rules 
                    if r.rule_type == 'payout_multiplier'
                ),
                'loss_cap': sum(
                    1 for r in active_rules 
                    if r.rule_type == 'loss_cap'
                )
            }
        }

        async def get_agent_partner_analytics(self, session: AsyncSession) -> Dict[str, Any]:
            """Aggregate agent and commission metrics for partners dashboard."""
            total_agents = await session.scalar(select(func.count()).select_from(Agent)) or 0
            active_agents = await session.scalar(
                select(func.count()).select_from(Agent).where(Agent.status == AgentStatus.ACTIVE)
            ) or 0
            blocked_agents = await session.scalar(
                select(func.count()).select_from(Agent).where(Agent.status == AgentStatus.BLOCKED)
            ) or 0

            aggregates = await session.execute(
                select(
                    func.coalesce(func.sum(Agent.total_commission_earned), 0),
                    func.coalesce(func.sum(Agent.total_deposits_processed), 0),
                    func.coalesce(func.sum(Agent.total_withdrawals_processed), 0),
                )
            )
            total_commission_earned, total_deposits_processed, total_withdrawals_processed = aggregates.one()

            status_rows = await session.execute(
                select(Commission.status, func.count(), func.coalesce(func.sum(Commission.amount), 0))
                .group_by(Commission.status)
            )
            commission_status = {row[0].value if isinstance(row[0], CommissionState) else row[0]: {'count': row[1], 'amount': float(row[2])} for row in status_rows}

            return {
                'total_agents': total_agents,
                'active_agents': active_agents,
                'blocked_agents': blocked_agents,
                'total_commission_earned': float(total_commission_earned),
                'total_deposits_processed': float(total_deposits_processed),
                'total_withdrawals_processed': float(total_withdrawals_processed),
                'commission_status': commission_status,
            }

        async def get_affiliate_partner_analytics(self, session: AsyncSession) -> Dict[str, Any]:
            """Aggregate affiliate, commission, and payout metrics."""
            total_affiliates = await session.scalar(select(func.count()).select_from(Affiliate)) or 0
            verified_affiliates = await session.scalar(
                select(func.count()).select_from(Affiliate).where(Affiliate.is_verified == True)
            ) or 0

            aggregates = await session.execute(
                select(
                    func.coalesce(func.sum(Affiliate.total_commission_paid), 0),
                    func.coalesce(func.sum(Affiliate.pending_commission), 0),
                    func.coalesce(func.sum(Affiliate.escrow_balance), 0),
                    func.coalesce(func.sum(Affiliate.total_referrals), 0),
                )
            )
            total_paid, pending_commission, escrow_balance, total_referrals = aggregates.one()

            commission_rows = await session.execute(
                select(
                    AffiliateCommission.status,
                    func.count(),
                    func.coalesce(func.sum(AffiliateCommission.commission_amount), 0),
                ).group_by(AffiliateCommission.status)
            )
            commission_status = {
                row[0].value if isinstance(row[0], CommissionState) else row[0]: {'count': row[1], 'amount': float(row[2])}
                for row in commission_rows
            }

            payout_rows = await session.execute(
                select(AffiliatePayout.status, func.count(), func.coalesce(func.sum(AffiliatePayout.amount), 0))
                .group_by(AffiliatePayout.status)
            )
            payout_status = {row[0]: {'count': row[1], 'amount': float(row[2])} for row in payout_rows}

            return {
                'total_affiliates': total_affiliates,
                'verified_affiliates': verified_affiliates,
                'total_referrals': int(total_referrals or 0),
                'pending_commission': float(pending_commission),
                'total_commission_paid': float(total_paid),
                'escrow_balance': float(escrow_balance),
                'commission_status': commission_status,
                'payout_status': payout_status,
            }
    
    async def get_player_activity_trend(
        self,
        session: AsyncSession,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get player activity trend over time"""
        results = []
        
        for i in range(days):
            day_start = datetime.now().replace(
                hour=0, minute=0, second=0, microsecond=0
            ) - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            # Count unique players with transactions
            trans_result = await session.execute(
                select(func.count(func.distinct(BalanceTransaction.player_id)))
                .where(
                    and_(
                        BalanceTransaction.created_at >= day_start,
                        BalanceTransaction.created_at < day_end
                    )
                )
            )
            active_players = trans_result.scalar()
            
            results.append({
                'date': day_start.date().isoformat(),
                'active_players': active_players or 0
            })
        
        return results
