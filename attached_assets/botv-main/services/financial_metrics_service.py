#!/usr/bin/env python3
"""
Financial metrics and reporting
Business intelligence and revenue tracking
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timedelta
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


@dataclass
class FinancialSnapshot:
    """Point-in-time financial snapshot"""
    timestamp: datetime
    total_deposits: Decimal
    total_payouts: Decimal
    total_bets: Decimal
    total_withdrawals: Decimal
    net_revenue: Decimal
    user_count: int
    active_users: int
    total_balance: Decimal
    avg_bet: Decimal


class FinancialMetricsService:
    """Track financial metrics and KPIs"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
    
    async def get_daily_summary(
        self,
        date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get daily financial summary
        
        Args:
            date: Date to summarize (default: today)
            
        Returns:
            Daily summary dictionary
        """
        if not date:
            date = datetime.utcnow().date()
        
        try:
            async with self.session_maker() as session:
                # Get all transactions for the day
                result = await session.execute(text("""
                    SELECT 
                        SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE 0 END) as deposits,
                        SUM(CASE WHEN transaction_type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals,
                        SUM(CASE WHEN transaction_type = 'GAME_BET' THEN amount ELSE 0 END) as bets,
                        SUM(CASE WHEN transaction_type = 'GAME_PAYOUT' THEN amount ELSE 0 END) as payouts,
                        COUNT(DISTINCT CASE WHEN transaction_type IN ('GAME_BET', 'GAME_PAYOUT') THEN user_id END) as active_users,
                        COUNT(*) as transaction_count
                    FROM transactions
                    WHERE DATE(created_at) = :date AND status = 'COMPLETED'
                """), {'date': date})
                
                row = result.fetchone()
                
                deposits = Decimal(row[0]) if row[0] else Decimal('0')
                withdrawals = Decimal(row[1]) if row[1] else Decimal('0')
                bets = Decimal(row[2]) if row[2] else Decimal('0')
                payouts = Decimal(row[3]) if row[3] else Decimal('0')
                active_users = row[4] or 0
                transaction_count = row[5] or 0
                
                # Calculate metrics
                gross_revenue = bets - payouts
                net_revenue = deposits - withdrawals + gross_revenue
                player_return_rate = (payouts / bets * 100) if bets > 0 else 0
                
                return {
                    'date': date.isoformat(),
                    'deposits': str(deposits),
                    'withdrawals': str(withdrawals),
                    'bets': str(bets),
                    'payouts': str(payouts),
                    'gross_revenue': str(gross_revenue),
                    'net_revenue': str(net_revenue),
                    'active_players': active_users,
                    'transaction_count': transaction_count,
                    'player_return_rate': f"{player_return_rate:.2f}%",
                    'house_edge': f"{(100 - player_return_rate):.2f}%",
                }
        
        except Exception as e:
            logger.error(f"Daily summary error: {e}")
            return {'error': str(e)}
    
    async def get_period_summary(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        """
        Get period financial summary
        
        Args:
            start_date: Period start
            end_date: Period end
            
        Returns:
            Period summary dictionary
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(text("""
                    SELECT 
                        SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE 0 END) as deposits,
                        SUM(CASE WHEN transaction_type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals,
                        SUM(CASE WHEN transaction_type = 'GAME_BET' THEN amount ELSE 0 END) as bets,
                        SUM(CASE WHEN transaction_type = 'GAME_PAYOUT' THEN amount ELSE 0 END) as payouts,
                        COUNT(DISTINCT user_id) as unique_users,
                        COUNT(DISTINCT CASE WHEN transaction_type IN ('GAME_BET', 'GAME_PAYOUT') THEN user_id END) as active_users
                    FROM transactions
                    WHERE created_at >= :start AND created_at <= :end AND status = 'COMPLETED'
                """), {'start': start_date, 'end': end_date})
                
                row = result.fetchone()
                
                deposits = Decimal(row[0]) if row[0] else Decimal('0')
                withdrawals = Decimal(row[1]) if row[1] else Decimal('0')
                bets = Decimal(row[2]) if row[2] else Decimal('0')
                payouts = Decimal(row[3]) if row[3] else Decimal('0')
                unique_users = row[4] or 0
                active_users = row[5] or 0
                
                gross_revenue = bets - payouts
                net_revenue = deposits - withdrawals + gross_revenue
                days = (end_date - start_date).days + 1
                
                return {
                    'period': f"{start_date.date()} to {end_date.date()}",
                    'days': days,
                    'deposits': str(deposits),
                    'withdrawals': str(withdrawals),
                    'bets': str(bets),
                    'payouts': str(payouts),
                    'gross_revenue': str(gross_revenue),
                    'net_revenue': str(net_revenue),
                    'avg_daily_revenue': str(net_revenue / days) if days > 0 else "0",
                    'unique_users': unique_users,
                    'active_users': active_users,
                    'user_engagement_rate': f"{(active_users / unique_users * 100):.2f}%" if unique_users > 0 else "0%",
                }
        
        except Exception as e:
            logger.error(f"Period summary error: {e}")
            return {'error': str(e)}
    
    async def get_user_value_analysis(self) -> Dict[str, Any]:
        """
        Analyze user lifetime value distribution
        
        Returns:
            User value analysis
        """
        try:
            async with self.session_maker() as session:
                # Get user value distribution
                result = await session.execute(text("""
                    WITH user_values AS (
                        SELECT user_id,
                               SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE 0 END) as total_deposits,
                               SUM(CASE WHEN transaction_type = 'GAME_BET' THEN amount ELSE 0 END) as total_bets,
                               SUM(CASE WHEN transaction_type = 'GAME_PAYOUT' THEN amount ELSE 0 END) as total_payouts
                        FROM transactions
                        WHERE status = 'COMPLETED'
                        GROUP BY user_id
                    )
                    SELECT 
                        COUNT(*) as user_count,
                        MIN(total_deposits) as min_deposit,
                        MAX(total_deposits) as max_deposit,
                        AVG(total_deposits) as avg_deposit,
                        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_deposits) as median_deposit
                    FROM user_values
                """))
                
                row = result.fetchone()
                
                return {
                    'total_users': row[0],
                    'min_deposit': str(row[1]) if row[1] else "0",
                    'max_deposit': str(row[2]) if row[2] else "0",
                    'avg_deposit': str(row[3]) if row[3] else "0",
                    'median_deposit': str(row[4]) if row[4] else "0",
                }
        
        except Exception as e:
            logger.error(f"User value analysis error: {e}")
            return {'error': str(e)}
    
    async def get_revenue_by_algorithm(self) -> Dict[str, Any]:
        """
        Get revenue breakdown by algorithm
        
        Returns:
            Revenue by algorithm
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(text("""
                    SELECT 
                        algorithm_type,
                        COUNT(*) as game_count,
                        SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
                        SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
                        AVG(payout_amount) as avg_payout,
                        SUM(bet_amount) as total_bets,
                        SUM(payout_amount) as total_payouts
                    FROM games
                    WHERE created_at >= NOW() - INTERVAL '7 days'
                    GROUP BY algorithm_type
                """))
                
                results = []
                for row in result.fetchall():
                    algo, count, wins, losses, avg_payout, total_bets, total_payouts = row
                    gross_revenue = Decimal(total_bets) - Decimal(total_payouts) if total_bets and total_payouts else Decimal('0')
                    
                    results.append({
                        'algorithm': algo,
                        'games': count,
                        'wins': wins,
                        'losses': losses,
                        'win_rate': f"{(wins / count * 100):.2f}%" if count > 0 else "0%",
                        'avg_payout': str(avg_payout) if avg_payout else "0",
                        'total_bets': str(total_bets) if total_bets else "0",
                        'gross_revenue': str(gross_revenue),
                    })
                
                return {'by_algorithm': results}
        
        except Exception as e:
            logger.error(f"Algorithm revenue error: {e}")
            return {'error': str(e)}
    
    async def export_financial_report(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        """
        Export comprehensive financial report
        
        Args:
            start_date: Report start
            end_date: Report end
            
        Returns:
            Complete financial report
        """
        period_summary = await self.get_period_summary(start_date, end_date)
        user_value = await self.get_user_value_analysis()
        revenue_by_algo = await self.get_revenue_by_algorithm()
        
        # Get daily breakdown
        daily_summaries = []
        current = start_date
        while current <= end_date:
            daily = await self.get_daily_summary(current)
            daily_summaries.append(daily)
            current += timedelta(days=1)
        
        return {
            'report_period': f"{start_date.date()} to {end_date.date()}",
            'generated_at': datetime.utcnow().isoformat(),
            'period_summary': period_summary,
            'user_analysis': user_value,
            'revenue_by_algorithm': revenue_by_algo,
            'daily_summaries': daily_summaries,
        }
