#!/usr/bin/env python3
"""
Real-time monitoring aggregation
Collects metrics from all services for dashboard and alerting
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Metric types"""
    TRANSACTION_COUNT = "transaction_count"
    TRANSACTION_VOLUME = "transaction_volume"
    TRANSACTION_ERROR_RATE = "transaction_error_rate"
    BET_COUNT = "bet_count"
    WIN_RATE = "win_rate"
    PAYOUT_TOTAL = "payout_total"
    USER_ACTIVE = "user_active"
    USER_NEW = "user_new"
    FRAUD_ALERT_COUNT = "fraud_alert_count"
    DEPOSIT_TOTAL = "deposit_total"
    WITHDRAWAL_TOTAL = "withdrawal_total"
    PAYMENT_FAILURE_RATE = "payment_failure_rate"
    API_LATENCY_P50 = "api_latency_p50"
    API_LATENCY_P99 = "api_latency_p99"
    DATABASE_QUERY_TIME = "database_query_time"
    CACHE_HIT_RATE = "cache_hit_rate"


class Severity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Metric:
    """Single metric point"""
    type: MetricType
    value: float
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)
    

@dataclass
class MetricSnapshot:
    """Point-in-time metric snapshot"""
    timestamp: datetime
    metrics: Dict[str, float]
    
    
@dataclass
class SystemHealth:
    """Overall system health status"""
    healthy: bool
    transaction_system: str  # ok, warning, critical
    user_system: str
    fraud_system: str
    payment_system: str
    api_system: str
    database_system: str
    overall_uptime: float  # percentage


class MonitoringAggregatorService:
    """Aggregate metrics from all services"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
        self.metrics_buffer: List[Metric] = []
        self.last_snapshot: Optional[MetricSnapshot] = None
        # Metric thresholds for alerting
        self.thresholds = {
            'transaction_error_rate': 0.05,  # 5%
            'payment_failure_rate': 0.01,    # 1%
            'api_latency_p99': 1000,         # 1000ms
            'database_query_time': 1000,     # 1000ms
            'cache_hit_rate': 0.80,          # <80% = alert
            'fraud_alert_count': 100,        # >100/hour
        }
    
    async def collect_transaction_metrics(self) -> Dict[str, float]:
        """
        Collect transaction metrics
        
        Returns:
            Transaction metrics
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(minutes=5)
                
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as txn_count,
                        SUM(CASE WHEN status != 'COMPLETED' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as error_rate,
                        SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE 0 END) as deposit_vol,
                        SUM(CASE WHEN transaction_type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawal_vol,
                        SUM(CASE WHEN transaction_type = 'GAME_BET' THEN amount ELSE 0 END) as bet_vol
                    FROM transactions
                    WHERE created_at >= :start
                """), {'start': period_start})
                
                row = result.fetchone()
                
                return {
                    'transaction_count': float(row[0] or 0),
                    'transaction_error_rate': float(row[1] or 0),
                    'deposit_volume': float(row[2] or 0),
                    'withdrawal_volume': float(row[3] or 0),
                    'bet_volume': float(row[4] or 0),
                }
        
        except Exception as e:
            logger.error(f"Transaction metrics error: {e}")
            return {}
    
    async def collect_game_metrics(self) -> Dict[str, float]:
        """
        Collect game metrics
        
        Returns:
            Game metrics
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(minutes=5)
                
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as game_count,
                        COUNT(DISTINCT user_id) as unique_players,
                        SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate,
                        SUM(bet_amount) as total_bets,
                        SUM(payout_amount) as total_payouts,
                        AVG(duration_ms) as avg_duration
                    FROM games
                    WHERE created_at >= :start
                """), {'start': period_start})
                
                row = result.fetchone()
                
                return {
                    'game_count': float(row[0] or 0),
                    'unique_players': float(row[1] or 0),
                    'win_rate': float(row[2] or 0),
                    'total_bets': float(row[3] or 0),
                    'total_payouts': float(row[4] or 0),
                    'avg_game_duration_ms': float(row[5] or 0),
                }
        
        except Exception as e:
            logger.error(f"Game metrics error: {e}")
            return {}
    
    async def collect_user_metrics(self) -> Dict[str, float]:
        """
        Collect user metrics
        
        Returns:
            User metrics
        """
        try:
            async with self.session_maker() as session:
                # Current active users (last 5 min activity)
                active = await session.execute(text("""
                    SELECT COUNT(DISTINCT user_id)
                    FROM transactions
                    WHERE created_at >= NOW() - INTERVAL '5 minutes'
                """))
                active_count = active.scalar() or 0
                
                # New users (last 24h)
                new = await session.execute(text("""
                    SELECT COUNT(*)
                    FROM users
                    WHERE created_at >= NOW() - INTERVAL '1 day'
                """))
                new_count = new.scalar() or 0
                
                # Total users
                total = await session.execute(text("""
                    SELECT COUNT(*) FROM users
                """))
                total_count = total.scalar() or 0
                
                return {
                    'active_users': float(active_count),
                    'new_users_24h': float(new_count),
                    'total_users': float(total_count),
                }
        
        except Exception as e:
            logger.error(f"User metrics error: {e}")
            return {}
    
    async def collect_fraud_metrics(self) -> Dict[str, float]:
        """
        Collect fraud detection metrics
        
        Returns:
            Fraud metrics
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(hours=1)
                
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as flag_count,
                        COUNT(CASE WHEN score >= 75 THEN 1 END) as critical_count,
                        AVG(score) as avg_score,
                        COUNT(DISTINCT user_id) as flagged_users
                    FROM fraud_flags
                    WHERE flagged_at >= :start AND resolved = false
                """), {'start': period_start})
                
                row = result.fetchone()
                
                return {
                    'fraud_alerts_1h': float(row[0] or 0),
                    'critical_fraud_alerts': float(row[1] or 0),
                    'avg_fraud_score': float(row[2] or 0),
                    'fraudulent_users': float(row[3] or 0),
                }
        
        except Exception as e:
            logger.error(f"Fraud metrics error: {e}")
            return {}
    
    async def collect_payment_metrics(self) -> Dict[str, float]:
        """
        Collect payment metrics
        
        Returns:
            Payment metrics
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(hours=1)
                
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as payment_count,
                        COUNT(CASE WHEN status != 'COMPLETED' THEN 1 END)::FLOAT / COUNT(*) as failure_rate,
                        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as completed_volume,
                        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count
                    FROM payments
                    WHERE created_at >= :start
                """), {'start': period_start})
                
                row = result.fetchone()
                
                return {
                    'payment_count_1h': float(row[0] or 0),
                    'payment_failure_rate': float(row[1] or 0),
                    'completed_volume': float(row[2] or 0),
                    'failed_payments': float(row[3] or 0),
                }
        
        except Exception as e:
            logger.error(f"Payment metrics error: {e}")
            return {}
    
    async def get_system_health(self) -> SystemHealth:
        """
        Get overall system health
        
        Returns:
            System health status
        """
        metrics = await self.get_current_metrics()
        
        # Evaluate each subsystem
        transaction_system = 'ok'
        if metrics.get('transaction_error_rate', 0) > self.thresholds['transaction_error_rate']:
            transaction_system = 'warning'
        
        payment_system = 'ok'
        if metrics.get('payment_failure_rate', 0) > self.thresholds['payment_failure_rate']:
            payment_system = 'critical'
        
        fraud_system = 'ok'
        if metrics.get('fraud_alerts_1h', 0) > self.thresholds['fraud_alert_count']:
            fraud_system = 'warning'
        
        api_system = 'ok'
        if metrics.get('api_latency_p99', 0) > self.thresholds['api_latency_p99']:
            api_system = 'warning'
        
        database_system = 'ok'
        if metrics.get('database_query_time', 0) > self.thresholds['database_query_time']:
            database_system = 'warning'
        
        user_system = 'ok'  # Always ok for now
        
        overall_healthy = transaction_system == 'ok' and payment_system == 'ok'
        
        return SystemHealth(
            healthy=overall_healthy,
            transaction_system=transaction_system,
            payment_system=payment_system,
            fraud_system=fraud_system,
            api_system=api_system,
            database_system=database_system,
            user_system=user_system,
            overall_uptime=99.5,
        )
    
    async def get_current_metrics(self) -> Dict[str, float]:
        """
        Get current aggregated metrics
        
        Returns:
            All metrics
        """
        metrics = {}
        
        # Collect from all subsystems
        metrics.update(await self.collect_transaction_metrics())
        metrics.update(await self.collect_game_metrics())
        metrics.update(await self.collect_user_metrics())
        metrics.update(await self.collect_fraud_metrics())
        metrics.update(await self.collect_payment_metrics())
        
        return metrics
    
    async def get_metrics_timeseries(
        self,
        metric_type: str,
        minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Get metric timeseries
        
        Args:
            metric_type: Type of metric
            minutes: Minutes to look back
            
        Returns:
            Timeseries data points
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(minutes=minutes)
                
                # Get from metrics table (would need to be populated)
                result = await session.execute(text("""
                    SELECT timestamp, value
                    FROM metrics_history
                    WHERE metric_type = :type
                    AND timestamp >= :start
                    ORDER BY timestamp
                """), {
                    'type': metric_type,
                    'start': period_start,
                })
                
                return [
                    {'timestamp': row[0].isoformat(), 'value': float(row[1])}
                    for row in result.fetchall()
                ]
        
        except Exception as e:
            logger.error(f"Timeseries error: {e}")
            return []
    
    async def check_thresholds(self) -> List[Dict[str, Any]]:
        """
        Check all metrics against thresholds
        
        Returns:
            List of threshold violations
        """
        violations = []
        metrics = await self.get_current_metrics()
        
        for metric_name, threshold in self.thresholds.items():
            value = metrics.get(metric_name, 0)
            
            # For rates/percentages (0-1), alert if below threshold
            if metric_name in ['cache_hit_rate']:
                if value < threshold:
                    violations.append({
                        'metric': metric_name,
                        'value': value,
                        'threshold': threshold,
                        'status': 'below_threshold',
                    })
            # For counts/rates, alert if above threshold
            else:
                if value > threshold:
                    violations.append({
                        'metric': metric_name,
                        'value': value,
                        'threshold': threshold,
                        'status': 'above_threshold',
                    })
        
        return violations
    
    async def log_metric(self, metric: Metric) -> bool:
        """
        Log metric to history
        
        Args:
            metric: Metric to log
            
        Returns:
            Success
        """
        try:
            async with self.session_maker() as session:
                await session.execute(text("""
                    INSERT INTO metrics_history (metric_type, value, timestamp, tags)
                    VALUES (:type, :value, :timestamp, :tags)
                """), {
                    'type': metric.type.value,
                    'value': metric.value,
                    'timestamp': metric.timestamp,
                    'tags': str(metric.tags),
                })
                
                await session.commit()
                return True
        
        except Exception as e:
            logger.error(f"Metric logging error: {e}")
            return False
