#!/usr/bin/env python3
"""
Revenue protection and user limits
Responsible gaming and risk management
"""

from typing import Dict, Optional, Tuple, List, Any
from dataclasses import dataclass
from enum import Enum
from decimal import Decimal
from datetime import datetime, timedelta
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class LimitType(str, Enum):
    """Limit types"""
    DAILY_DEPOSIT = "DAILY_DEPOSIT"
    DAILY_LOSS = "DAILY_LOSS"
    DAILY_SPEND = "DAILY_SPEND"
    WEEKLY_LOSS = "WEEKLY_LOSS"
    MONTHLY_LOSS = "MONTHLY_LOSS"
    MAX_BET = "MAX_BET"
    MAX_PAYOUT = "MAX_PAYOUT"
    SESSION_TIME = "SESSION_TIME"
    COOLDOWN_PERIOD = "COOLDOWN_PERIOD"


class RiskLevel(str, Enum):
    """User risk assessment"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class UserLimits:
    """User-specific limits"""
    user_id: int
    daily_deposit_limit: Decimal = Decimal('10000')
    daily_loss_limit: Decimal = Decimal('5000')
    daily_spend_limit: Decimal = Decimal('8000')
    weekly_loss_limit: Decimal = Decimal('20000')
    monthly_loss_limit: Decimal = Decimal('50000')
    max_bet: Decimal = Decimal('1000')
    max_payout: Decimal = Decimal('100000')
    session_time_limit: int = 3600  # seconds
    cooldown_period: int = 3600  # seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'user_id': self.user_id,
            'daily_deposit_limit': str(self.daily_deposit_limit),
            'daily_loss_limit': str(self.daily_loss_limit),
            'daily_spend_limit': str(self.daily_spend_limit),
            'weekly_loss_limit': str(self.weekly_loss_limit),
            'monthly_loss_limit': str(self.monthly_loss_limit),
            'max_bet': str(self.max_bet),
            'max_payout': str(self.max_payout),
            'session_time_limit': self.session_time_limit,
            'cooldown_period': self.cooldown_period,
        }


class RevenueLimitsService:
    """Enforce revenue protection limits"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
        self.limits_cache: Dict[int, UserLimits] = {}
    
    async def check_deposit_allowed(
        self,
        user_id: int,
        amount: Decimal,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if deposit is allowed
        
        Args:
            user_id: User ID
            amount: Deposit amount
            
        Returns:
            (allowed, reason) tuple
        """
        limits = await self._get_user_limits(user_id)
        
        # Get today's deposits
        async with self.session_maker() as session:
            result = await session.execute(text("""
                SELECT COALESCE(SUM(amount), 0) FROM transactions
                WHERE user_id = :user_id 
                AND transaction_type = 'DEPOSIT'
                AND DATE(created_at) = CURRENT_DATE
                AND status = 'COMPLETED'
            """), {'user_id': user_id})
            
            today_deposits = Decimal(result.scalar())
        
        # Check daily deposit limit
        if today_deposits + amount > limits.daily_deposit_limit:
            remaining = limits.daily_deposit_limit - today_deposits
            return False, f"Daily deposit limit exceeded. Remaining: {remaining}"
        
        return True, None
    
    async def check_bet_allowed(
        self,
        user_id: int,
        amount: Decimal,
        user_balance: Decimal,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if bet is allowed
        
        Args:
            user_id: User ID
            amount: Bet amount
            user_balance: User current balance
            
        Returns:
            (allowed, reason) tuple
        """
        limits = await self._get_user_limits(user_id)
        risk = await self._assess_risk(user_id)
        
        # Check max bet
        if amount > limits.max_bet:
            return False, f"Bet exceeds maximum {limits.max_bet}"
        
        # Check balance
        if amount > user_balance:
            return False, "Insufficient balance"
        
        # Check daily loss
        async with self.session_maker() as session:
            result = await session.execute(text("""
                SELECT COALESCE(SUM(amount), 0) FROM transactions
                WHERE user_id = :user_id 
                AND transaction_type = 'GAME_BET'
                AND DATE(created_at) = CURRENT_DATE
                AND status = 'COMPLETED'
            """), {'user_id': user_id})
            
            today_bets = Decimal(result.scalar())
        
        # Estimate potential loss
        potential_loss = today_bets + amount
        if potential_loss > limits.daily_spend_limit:
            return False, f"Daily spend limit would be exceeded"
        
        # Extra restrictions for high-risk users
        if risk == RiskLevel.CRITICAL:
            return False, "Account flagged for responsible gaming check"
        
        return True, None
    
    async def check_withdrawal_allowed(
        self,
        user_id: int,
        amount: Decimal,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if withdrawal is allowed
        
        Args:
            user_id: User ID
            amount: Withdrawal amount
            
        Returns:
            (allowed, reason) tuple
        """
        limits = await self._get_user_limits(user_id)
        
        # Check for cooldown
        async with self.session_maker() as session:
            result = await session.execute(text("""
                SELECT created_at FROM transactions
                WHERE user_id = :user_id
                AND transaction_type = 'WITHDRAWAL'
                AND status = 'COMPLETED'
                ORDER BY created_at DESC
                LIMIT 1
            """), {'user_id': user_id})
            
            last_withdrawal = result.scalar()
        
        if last_withdrawal:
            cooldown_end = last_withdrawal + timedelta(seconds=limits.cooldown_period)
            if datetime.utcnow() < cooldown_end:
                wait_time = (cooldown_end - datetime.utcnow()).seconds
                return False, f"Withdrawal cooldown active. Wait {wait_time} seconds"
        
        return True, None
    
    async def get_user_limits(
        self,
        user_id: int,
    ) -> UserLimits:
        """Get user limits"""
        return await self._get_user_limits(user_id)
    
    async def set_user_limit(
        self,
        user_id: int,
        limit_type: LimitType,
        value: Decimal,
    ) -> bool:
        """
        Set user limit (admin only)
        
        Args:
            user_id: User ID
            limit_type: Type of limit
            value: Limit value
            
        Returns:
            True if set successfully
        """
        try:
            async with self.session_maker() as session:
                await session.execute(text("""
                    INSERT INTO user_limits (user_id, limit_type, limit_value, updated_at)
                    VALUES (:user_id, :type, :value, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, limit_type) DO UPDATE 
                    SET limit_value = :value, updated_at = CURRENT_TIMESTAMP
                """), {
                    'user_id': user_id,
                    'type': limit_type.value,
                    'value': str(value),
                })
                
                await session.commit()
            
            # Invalidate cache
            if user_id in self.limits_cache:
                del self.limits_cache[user_id]
            
            logger.info(f"Set {limit_type.value} to {value} for user {user_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to set limit: {e}")
            return False
    
    async def get_user_metrics(
        self,
        user_id: int,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        Get user activity metrics
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Metrics dictionary
        """
        try:
            async with self.session_maker() as session:
                cutoff = datetime.utcnow() - timedelta(days=days)
                
                # Get deposits
                result = await session.execute(text("""
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = :user_id AND transaction_type = 'DEPOSIT'
                    AND created_at > :cutoff AND status = 'COMPLETED'
                """), {'user_id': user_id, 'cutoff': cutoff})
                total_deposits = Decimal(result.scalar())
                
                # Get bets
                result = await session.execute(text("""
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = :user_id AND transaction_type = 'GAME_BET'
                    AND created_at > :cutoff AND status = 'COMPLETED'
                """), {'user_id': user_id, 'cutoff': cutoff})
                total_bets = Decimal(result.scalar())
                
                # Get payouts
                result = await session.execute(text("""
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = :user_id AND transaction_type = 'GAME_PAYOUT'
                    AND created_at > :cutoff AND status = 'COMPLETED'
                """), {'user_id': user_id, 'cutoff': cutoff})
                total_payouts = Decimal(result.scalar())
                
                # Get withdrawals
                result = await session.execute(text("""
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = :user_id AND transaction_type = 'WITHDRAWAL'
                    AND created_at > :cutoff AND status = 'COMPLETED'
                """), {'user_id': user_id, 'cutoff': cutoff})
                total_withdrawals = Decimal(result.scalar())
                
                # Calculate net
                net_position = total_deposits - total_withdrawals - (total_bets - total_payouts)
                
                return {
                    'user_id': user_id,
                    'period_days': days,
                    'total_deposits': str(total_deposits),
                    'total_bets': str(total_bets),
                    'total_payouts': str(total_payouts),
                    'total_withdrawals': str(total_withdrawals),
                    'net_position': str(net_position),
                    'roi': str((total_payouts - total_bets) / total_bets * 100) if total_bets > 0 else "0",
                }
        
        except Exception as e:
            logger.error(f"Metrics error: {e}")
            return {'error': str(e)}
    
    async def _assess_risk(self, user_id: int) -> RiskLevel:
        """Assess user risk level"""
        metrics = await self.get_user_metrics(user_id, days=7)
        
        if 'error' in metrics:
            return RiskLevel.LOW
        
        try:
            deposits = Decimal(metrics['total_deposits'])
            bets = Decimal(metrics['total_bets'])
            
            # Risk assessment rules
            if deposits > Decimal('50000') or bets > Decimal('100000'):
                return RiskLevel.CRITICAL
            elif deposits > Decimal('20000') or bets > Decimal('50000'):
                return RiskLevel.HIGH
            elif deposits > Decimal('5000') or bets > Decimal('10000'):
                return RiskLevel.MEDIUM
            
            return RiskLevel.LOW
        except:
            return RiskLevel.LOW
    
    async def _get_user_limits(self, user_id: int) -> UserLimits:
        """Get user limits with caching"""
        if user_id in self.limits_cache:
            return self.limits_cache[user_id]
        
        try:
            async with self.session_maker() as session:
                result = await session.execute(text("""
                    SELECT daily_deposit_limit, daily_loss_limit, daily_spend_limit,
                           weekly_loss_limit, monthly_loss_limit, max_bet, max_payout,
                           session_time_limit, cooldown_period
                    FROM user_limits WHERE user_id = :user_id
                """), {'user_id': user_id})
                
                row = result.fetchone()
                
                if row:
                    limits = UserLimits(
                        user_id=user_id,
                        daily_deposit_limit=Decimal(row[0]),
                        daily_loss_limit=Decimal(row[1]),
                        daily_spend_limit=Decimal(row[2]),
                        weekly_loss_limit=Decimal(row[3]),
                        monthly_loss_limit=Decimal(row[4]),
                        max_bet=Decimal(row[5]),
                        max_payout=Decimal(row[6]),
                        session_time_limit=row[7],
                        cooldown_period=row[8],
                    )
                else:
                    limits = UserLimits(user_id=user_id)
                
                self.limits_cache[user_id] = limits
                return limits
        
        except Exception as e:
            logger.warning(f"Error loading limits: {e}")
            return UserLimits(user_id=user_id)
