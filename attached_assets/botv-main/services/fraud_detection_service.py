#!/usr/bin/env python3
"""
Fraud detection and prevention
Pattern recognition, velocity checks, anomaly scoring
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timedelta
from enum import Enum
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class AnomalyType(Enum):
    """Fraud anomaly types"""
    IMPOSSIBLE_OUTCOME = "impossible_outcome"      # Win rate > 95%
    VELOCITY_SPIKE = "velocity_spike"              # Rapid bets/deposits
    PATTERN_ABUSE = "pattern_abuse"                # Betting pattern manipulation
    ACCOUNT_LINK = "account_link"                  # Multiple accounts same person
    WINNING_STREAK = "winning_streak"              # Statistically improbable wins
    LARGE_WIN = "large_win"                        # Single win > daily avg
    RAPID_WITHDRAWAL = "rapid_withdrawal"          # Win immediately withdrawn


class FraudScore(Enum):
    """Fraud risk scores"""
    CLEAN = "clean"           # 0-20
    SUSPICIOUS = "suspicious" # 21-50
    RISKY = "risky"          # 51-75
    FRAUDULENT = "fraudulent" # 76-100


@dataclass
class AnomalyFlag:
    """Fraud anomaly flag"""
    user_id: int
    anomaly_type: AnomalyType
    score: int  # 0-100
    details: Dict[str, Any]
    flagged_at: datetime
    resolved: bool = False


class FraudDetectionService:
    """Detect fraudulent activity patterns"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
        # Thresholds for anomaly detection
        self.win_rate_threshold = 0.95  # > 95% = suspicious
        self.velocity_threshold = 10    # 10+ bets in 5 minutes
        self.winning_streak_threshold = 20  # 20+ consecutive wins
    
    async def analyze_user_patterns(
        self,
        user_id: int,
        lookback_days: int = 7,
    ) -> Dict[str, Any]:
        """
        Analyze user betting patterns
        
        Args:
            user_id: User ID
            lookback_days: Days to analyze
            
        Returns:
            Pattern analysis
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(days=lookback_days)
                
                # Get betting statistics
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as total_bets,
                        SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
                        SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
                        MIN(bet_amount) as min_bet,
                        MAX(bet_amount) as max_bet,
                        AVG(bet_amount) as avg_bet,
                        AVG(payout_amount) as avg_payout,
                        STDDEV(payout_amount) as payout_variance
                    FROM games
                    WHERE user_id = :user_id AND created_at >= :start
                """), {
                    'user_id': user_id,
                    'start': period_start,
                })
                
                row = result.fetchone()
                
                if not row or row[0] == 0:
                    return {'message': 'No betting activity'}
                
                total_bets = row[0]
                wins = row[1] or 0
                losses = row[2] or 0
                
                win_rate = wins / total_bets if total_bets > 0 else 0
                house_edge_expected = 0.03  # Expected 3% house edge
                house_edge_actual = 1 - (wins / total_bets) if total_bets > 0 else 0
                
                return {
                    'period_days': lookback_days,
                    'total_bets': total_bets,
                    'wins': wins,
                    'losses': losses,
                    'win_rate': f"{win_rate * 100:.2f}%",
                    'expected_house_edge': f"{house_edge_expected * 100:.2f}%",
                    'actual_house_edge': f"{house_edge_actual * 100:.2f}%",
                    'min_bet': str(row[4]) if row[4] else "0",
                    'max_bet': str(row[5]) if row[5] else "0",
                    'avg_bet': str(row[6]) if row[6] else "0",
                    'avg_payout': str(row[7]) if row[7] else "0",
                    'payout_variance': str(row[8]) if row[8] else "0",
                }
        
        except Exception as e:
            logger.error(f"Pattern analysis error: {e}")
            return {'error': str(e)}
    
    async def detect_velocity_spike(
        self,
        user_id: int,
        time_window_minutes: int = 5,
    ) -> Optional[AnomalyFlag]:
        """
        Detect rapid betting velocity
        
        Args:
            user_id: User ID
            time_window_minutes: Time window for spike detection
            
        Returns:
            AnomalyFlag if detected, else None
        """
        try:
            async with self.session_maker() as session:
                window_start = datetime.utcnow() - timedelta(minutes=time_window_minutes)
                
                result = await session.execute(text("""
                    SELECT COUNT(*) as bet_count
                    FROM games
                    WHERE user_id = :user_id AND created_at >= :start
                """), {
                    'user_id': user_id,
                    'start': window_start,
                })
                
                bet_count = result.scalar()
                
                if bet_count and bet_count >= self.velocity_threshold:
                    score = min(100, (bet_count / self.velocity_threshold) * 50)
                    
                    return AnomalyFlag(
                        user_id=user_id,
                        anomaly_type=AnomalyType.VELOCITY_SPIKE,
                        score=int(score),
                        details={
                            'bets_in_window': bet_count,
                            'window_minutes': time_window_minutes,
                            'threshold': self.velocity_threshold,
                        },
                        flagged_at=datetime.utcnow(),
                    )
        
        except Exception as e:
            logger.error(f"Velocity spike detection error: {e}")
        
        return None
    
    async def detect_winning_streak(
        self,
        user_id: int,
    ) -> Optional[AnomalyFlag]:
        """
        Detect improbable winning streaks
        
        Args:
            user_id: User ID
            
        Returns:
            AnomalyFlag if detected, else None
        """
        try:
            async with self.session_maker() as session:
                # Get last N games in order
                result = await session.execute(text("""
                    SELECT outcome
                    FROM games
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT 50
                """), {'user_id': user_id})
                
                outcomes = [row[0] for row in result.fetchall()]
                
                # Check for consecutive wins
                max_streak = 0
                current_streak = 0
                
                for outcome in outcomes:
                    if outcome == 'WIN':
                        current_streak += 1
                        max_streak = max(max_streak, current_streak)
                    else:
                        current_streak = 0
                
                if max_streak >= self.winning_streak_threshold:
                    # Probability of N consecutive wins with 48% win rate
                    # P = 0.48^N
                    probability = 0.48 ** max_streak
                    
                    # Score: lower probability = higher score
                    score = min(100, int((1 - probability) * 100))
                    
                    return AnomalyFlag(
                        user_id=user_id,
                        anomaly_type=AnomalyType.WINNING_STREAK,
                        score=score,
                        details={
                            'streak_length': max_streak,
                            'probability': f"{probability:.10f}",
                        },
                        flagged_at=datetime.utcnow(),
                    )
        
        except Exception as e:
            logger.error(f"Winning streak detection error: {e}")
        
        return None
    
    async def detect_rapid_withdrawal(
        self,
        user_id: int,
        minutes_after_win: int = 5,
    ) -> Optional[AnomalyFlag]:
        """
        Detect withdrawal immediately after big win
        
        Args:
            user_id: User ID
            minutes_after_win: Minutes after win to trigger flag
            
        Returns:
            AnomalyFlag if detected, else None
        """
        try:
            async with self.session_maker() as session:
                # Find large wins and subsequent withdrawals
                result = await session.execute(text("""
                    WITH large_wins AS (
                        SELECT created_at as win_time, payout_amount
                        FROM games
                        WHERE user_id = :user_id
                        AND outcome = 'WIN'
                        AND payout_amount > (
                            SELECT AVG(payout_amount) * 3
                            FROM games WHERE user_id = :user_id
                        )
                        ORDER BY created_at DESC
                        LIMIT 1
                    ),
                    recent_withdrawal AS (
                        SELECT created_at as withdrawal_time, amount
                        FROM transactions
                        WHERE user_id = :user_id
                        AND transaction_type = 'WITHDRAWAL'
                        AND created_at >= (SELECT win_time FROM large_wins) - INTERVAL '5 minutes'
                        AND created_at >= (SELECT win_time FROM large_wins)
                        ORDER BY created_at
                        LIMIT 1
                    )
                    SELECT 
                        (SELECT win_time FROM large_wins) as win_time,
                        (SELECT withdrawal_time FROM recent_withdrawal) as withdrawal_time,
                        (SELECT payout_amount FROM large_wins) as payout_amount,
                        (SELECT amount FROM recent_withdrawal) as withdrawal_amount
                """), {'user_id': user_id})
                
                row = result.fetchone()
                
                if row and row[0] and row[1]:  # Both win and withdrawal found
                    time_diff = (row[1] - row[0]).total_seconds() / 60
                    
                    if time_diff <= minutes_after_win:
                        return AnomalyFlag(
                            user_id=user_id,
                            anomaly_type=AnomalyType.RAPID_WITHDRAWAL,
                            score=60,
                            details={
                                'minutes_between': int(time_diff),
                                'payout_amount': str(row[2]),
                                'withdrawal_amount': str(row[3]),
                            },
                            flagged_at=datetime.utcnow(),
                        )
        
        except Exception as e:
            logger.error(f"Rapid withdrawal detection error: {e}")
        
        return None
    
    async def calculate_fraud_score(
        self,
        user_id: int,
    ) -> Tuple[int, FraudScore]:
        """
        Calculate overall fraud risk score
        
        Args:
            user_id: User ID
            
        Returns:
            (score: 0-100, fraud_score_level)
        """
        score = 0
        
        # Check anomalies
        velocity = await self.detect_velocity_spike(user_id)
        if velocity:
            score += velocity.score
        
        winning_streak = await self.detect_winning_streak(user_id)
        if winning_streak:
            score += winning_streak.score
        
        rapid_withdrawal = await self.detect_rapid_withdrawal(user_id)
        if rapid_withdrawal:
            score += rapid_withdrawal.score
        
        # Normalize to 0-100
        score = min(100, score)
        
        # Determine level
        if score <= 20:
            level = FraudScore.CLEAN
        elif score <= 50:
            level = FraudScore.SUSPICIOUS
        elif score <= 75:
            level = FraudScore.RISKY
        else:
            level = FraudScore.FRAUDULENT
        
        return score, level
    
    async def log_anomaly(
        self,
        user_id: int,
        anomaly: AnomalyFlag,
    ) -> bool:
        """
        Log fraud anomaly flag
        
        Args:
            user_id: User ID
            anomaly: AnomalyFlag
            
        Returns:
            Success
        """
        try:
            async with self.session_maker() as session:
                await session.execute(text("""
                    INSERT INTO fraud_flags (user_id, anomaly_type, score, details, flagged_at)
                    VALUES (:user_id, :type, :score, :details, :flagged_at)
                """), {
                    'user_id': user_id,
                    'type': anomaly.anomaly_type.value,
                    'score': anomaly.score,
                    'details': str(anomaly.details),
                    'flagged_at': anomaly.flagged_at,
                })
                
                await session.commit()
                return True
        
        except Exception as e:
            logger.error(f"Anomaly logging error: {e}")
            return False
