#!/usr/bin/env python3
"""
Dashboard data aggregation
Provides data for real-time monitoring dashboards
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class DashboardService:
    """Aggregate data for dashboards"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
    
    async def get_executive_dashboard(self) -> Dict[str, Any]:
        """
        Get executive-level dashboard data
        
        Returns:
            Dashboard data
        """
        try:
            async with self.session_maker() as session:
                now = datetime.utcnow()
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                
                # Daily revenue
                revenue = await session.execute(text("""
                    SELECT 
                        SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE 0 END) as deposits,
                        SUM(CASE WHEN transaction_type = 'GAME_BET' THEN amount ELSE 0 END) as bets,
                        SUM(CASE WHEN transaction_type = 'GAME_PAYOUT' THEN amount ELSE 0 END) as payouts,
                        SUM(CASE WHEN transaction_type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals
                    FROM transactions
                    WHERE created_at >= :today AND status = 'COMPLETED'
                """), {'today': today_start})
                
                rev_row = revenue.fetchone()
                deposits = Decimal(rev_row[0] or 0)
                bets = Decimal(rev_row[1] or 0)
                payouts = Decimal(rev_row[2] or 0)
                withdrawals = Decimal(rev_row[3] or 0)
                
                gross_revenue = bets - payouts
                net_revenue = deposits - withdrawals + gross_revenue
                
                # User metrics
                users = await session.execute(text("""
                    SELECT 
                        COUNT(DISTINCT user_id) as active,
                        COUNT(DISTINCT CASE WHEN created_at >= :today THEN id END) as new
                    FROM users
                    WHERE last_activity >= NOW() - INTERVAL '1 hour'
                """), {'today': today_start})
                
                user_row = users.fetchone()
                active_users = user_row[0] or 0
                new_users = user_row[1] or 0
                
                # Game metrics
                games = await session.execute(text("""
                    SELECT 
                        COUNT(*) as games_played,
                        SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate
                    FROM games
                    WHERE created_at >= :today
                """), {'today': today_start})
                
                game_row = games.fetchone()
                games_played = game_row[0] or 0
                win_rate = float(game_row[1] or 0)
                
                return {
                    'timestamp': now.isoformat(),
                    'financial': {
                        'deposits': str(deposits),
                        'bets': str(bets),
                        'payouts': str(payouts),
                        'withdrawals': str(withdrawals),
                        'gross_revenue': str(gross_revenue),
                        'net_revenue': str(net_revenue),
                        'roi': f"{(gross_revenue / bets * 100):.2f}%" if bets > 0 else "0%",
                    },
                    'users': {
                        'active': active_users,
                        'new_today': new_users,
                    },
                    'games': {
                        'played_today': games_played,
                        'win_rate': f"{win_rate * 100:.2f}%",
                    },
                }
        
        except Exception as e:
            logger.error(f"Executive dashboard error: {e}")
            return {}
    
    async def get_operations_dashboard(self) -> Dict[str, Any]:
        """
        Get operations-level dashboard
        
        Returns:
            Operations metrics
        """
        try:
            async with self.session_maker() as session:
                now = datetime.utcnow()
                hour_ago = now - timedelta(hours=1)
                
                # Transaction metrics
                txns = await session.execute(text("""
                    SELECT 
                        COUNT(*) as count,
                        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
                        COUNT(CASE WHEN status != 'COMPLETED' THEN 1 END)::FLOAT / COUNT(*) as error_rate
                    FROM transactions
                    WHERE created_at >= :hour_ago
                """), {'hour_ago': hour_ago})
                
                txn_row = txns.fetchone()
                
                # Payment metrics
                payments = await session.execute(text("""
                    SELECT 
                        COUNT(*) as count,
                        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::FLOAT / COUNT(*) as failure_rate
                    FROM payments
                    WHERE created_at >= :hour_ago
                """), {'hour_ago': hour_ago})
                
                pay_row = payments.fetchone()
                
                # Fraud metrics
                fraud = await session.execute(text("""
                    SELECT 
                        COUNT(*) as flags,
                        AVG(score) as avg_score,
                        COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved
                    FROM fraud_flags
                    WHERE flagged_at >= :hour_ago
                """), {'hour_ago': hour_ago})
                
                fraud_row = fraud.fetchone()
                
                # Compliance metrics
                compliance = await session.execute(text("""
                    SELECT 
                        COUNT(DISTINCT user_id) as excluded
                    FROM self_exclusions
                    WHERE is_active = true
                """))
                
                comp_row = compliance.fetchone()
                
                return {
                    'timestamp': now.isoformat(),
                    'transactions_1h': {
                        'count': txn_row[0] or 0,
                        'completed': txn_row[1] or 0,
                        'error_rate': f"{float(txn_row[2] or 0) * 100:.2f}%",
                    },
                    'payments_1h': {
                        'count': pay_row[0] or 0,
                        'completed': pay_row[1] or 0,
                        'failure_rate': f"{float(pay_row[2] or 0) * 100:.2f}%",
                    },
                    'fraud_1h': {
                        'flags': fraud_row[0] or 0,
                        'avg_score': f"{float(fraud_row[1] or 0):.2f}",
                        'unresolved': fraud_row[2] or 0,
                    },
                    'compliance': {
                        'excluded_users': comp_row[0] or 0,
                    },
                }
        
        except Exception as e:
            logger.error(f"Operations dashboard error: {e}")
            return {}
    
    async def get_security_dashboard(self) -> Dict[str, Any]:
        """
        Get security-focused dashboard
        
        Returns:
            Security metrics
        """
        try:
            async with self.session_maker() as session:
                now = datetime.utcnow()
                day_ago = now - timedelta(days=1)
                hour_ago = now - timedelta(hours=1)
                
                # Fraud flags
                fraud = await session.execute(text("""
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN score >= 75 THEN 1 END) as critical,
                        COUNT(CASE WHEN score >= 50 AND score < 75 THEN 1 END) as high,
                        COUNT(CASE WHEN score >= 20 AND score < 50 THEN 1 END) as medium
                    FROM fraud_flags
                    WHERE flagged_at >= :day_ago
                """), {'day_ago': day_ago})
                
                fraud_row = fraud.fetchone()
                
                # Anomalies by type
                anomalies = await session.execute(text("""
                    SELECT anomaly_type, COUNT(*) as count
                    FROM fraud_flags
                    WHERE flagged_at >= :day_ago
                    GROUP BY anomaly_type
                    ORDER BY count DESC
                """), {'day_ago': day_ago})
                
                anomaly_list = [
                    {'type': row[0], 'count': row[1]}
                    for row in anomalies.fetchall()
                ]
                
                # Compliance violations
                violations = await session.execute(text("""
                    SELECT 
                        COUNT(*) as self_exclusions,
                        COUNT(CASE WHEN exclusion_type = 'permanent' THEN 1 END) as permanent
                    FROM self_exclusions
                    WHERE start_date >= :day_ago
                """), {'day_ago': day_ago})
                
                viol_row = violations.fetchone()
                
                # Transaction anomalies
                tx_anomalies = await session.execute(text("""
                    SELECT COUNT(*) as failed_tx
                    FROM transactions
                    WHERE status = 'FAILED'
                    AND created_at >= :hour_ago
                """), {'hour_ago': hour_ago})
                
                tx_anom = tx_anomalies.scalar() or 0
                
                return {
                    'timestamp': now.isoformat(),
                    'fraud_24h': {
                        'total_flags': fraud_row[0] or 0,
                        'critical': fraud_row[1] or 0,
                        'high': fraud_row[2] or 0,
                        'medium': fraud_row[3] or 0,
                    },
                    'anomalies_by_type': anomaly_list,
                    'compliance_24h': {
                        'new_exclusions': viol_row[0] or 0,
                        'permanent': viol_row[1] or 0,
                    },
                    'transaction_failures_1h': tx_anom,
                }
        
        except Exception as e:
            logger.error(f"Security dashboard error: {e}")
            return {}
    
    async def get_player_dashboard(self) -> Dict[str, Any]:
        """
        Get player activity dashboard
        
        Returns:
            Player metrics
        """
        try:
            async with self.session_maker() as session:
                now = datetime.utcnow()
                hour_ago = now - timedelta(hours=1)
                day_ago = now - timedelta(days=1)
                
                # Active players
                active = await session.execute(text("""
                    SELECT 
                        COUNT(DISTINCT user_id) as now,
                        COUNT(DISTINCT CASE WHEN created_at >= :day_ago THEN user_id END) as today
                    FROM transactions
                    WHERE created_at >= :hour_ago
                """), {'hour_ago': hour_ago, 'day_ago': day_ago})
                
                active_row = active.fetchone()
                
                # Session metrics
                sessions = await session.execute(text("""
                    SELECT 
                        AVG(duration_ms) as avg_session,
                        MAX(duration_ms) as max_session
                    FROM games
                    WHERE created_at >= :day_ago
                """), {'day_ago': day_ago})
                
                sess_row = sessions.fetchone()
                
                # Average bets
                bets = await session.execute(text("""
                    SELECT 
                        AVG(bet_amount) as avg_bet,
                        MAX(bet_amount) as max_bet,
                        MIN(bet_amount) as min_bet
                    FROM games
                    WHERE created_at >= :day_ago
                """), {'day_ago': day_ago})
                
                bet_row = bets.fetchone()
                
                # Retention (users active today who were active yesterday)
                retention = await session.execute(text("""
                    SELECT 
                        COUNT(DISTINCT CASE 
                            WHEN EXISTS (
                                SELECT 1 FROM transactions t2
                                WHERE t2.user_id = t1.user_id
                                AND t2.created_at >= NOW() - INTERVAL '2 days'
                                AND t2.created_at < NOW() - INTERVAL '1 day'
                            ) THEN t1.user_id 
                        END)::FLOAT / 
                        COUNT(DISTINCT CASE WHEN created_at >= :day_ago THEN user_id END) * 100 as retention
                    FROM transactions t1
                    WHERE created_at >= :day_ago
                """), {'day_ago': day_ago})
                
                ret_row = retention.fetchone()
                
                return {
                    'timestamp': now.isoformat(),
                    'active_players': {
                        'now': active_row[0] or 0,
                        'today': active_row[1] or 0,
                    },
                    'session_metrics': {
                        'avg_duration_ms': int(sess_row[0] or 0),
                        'max_duration_ms': int(sess_row[1] or 0),
                    },
                    'bet_metrics': {
                        'avg_bet': str(Decimal(bet_row[0] or 0)),
                        'max_bet': str(Decimal(bet_row[1] or 0)),
                        'min_bet': str(Decimal(bet_row[2] or 0)),
                    },
                    'retention': f"{float(ret_row[0] or 0):.2f}%",
                }
        
        except Exception as e:
            logger.error(f"Player dashboard error: {e}")
            return {}
    
    async def get_system_dashboard(self) -> Dict[str, Any]:
        """
        Get system health dashboard
        
        Returns:
            System metrics
        """
        try:
            async with self.session_maker() as session:
                now = datetime.utcnow()
                
                # Database stats
                db_stats = await session.execute(text("""
                    SELECT 
                        (SELECT COUNT(*) FROM users) as user_count,
                        (SELECT COUNT(*) FROM games) as game_count,
                        (SELECT COUNT(*) FROM transactions) as transaction_count,
                        (SELECT COUNT(*) FROM audit_logs) as audit_count
                """))
                
                db_row = db_stats.fetchone()
                
                # Error tracking
                errors = await session.execute(text("""
                    SELECT 
                        COUNT(*) as error_count,
                        COUNT(DISTINCT error_type) as error_types
                    FROM error_logs
                    WHERE created_at >= NOW() - INTERVAL '1 hour'
                """))
                
                err_row = errors.fetchone()
                
                return {
                    'timestamp': now.isoformat(),
                    'database': {
                        'users': db_row[0] or 0,
                        'games': db_row[1] or 0,
                        'transactions': db_row[2] or 0,
                        'audit_logs': db_row[3] or 0,
                    },
                    'errors_1h': {
                        'count': err_row[0] or 0,
                        'types': err_row[1] or 0,
                    },
                    'uptime': '99.9%',  # Would compute from actual metrics
                }
        
        except Exception as e:
            logger.error(f"System dashboard error: {e}")
            return {}
