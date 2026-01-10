#!/usr/bin/env python3
"""
Compliance and responsible gaming
KYC/AML, self-exclusion, loss limits enforcement
"""

from typing import Dict, Optional, List, Any, Tuple
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timedelta
from enum import Enum
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ComplianceStatus(Enum):
    """User compliance status"""
    VERIFIED = "verified"
    PENDING = "pending"
    FAILED = "failed"
    SELF_EXCLUDED = "self_excluded"
    SUSPENDED = "suspended"


class ExclusionType(Enum):
    """Self-exclusion types"""
    TEMPORARY = "temporary"  # 30 days default
    EXTENDED = "extended"    # 6 months
    PERMANENT = "permanent"


class AMLRiskLevel(Enum):
    """AML risk assessment"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class KYCData:
    """Know Your Customer data"""
    user_id: int
    full_name: str
    date_of_birth: datetime
    country: str
    verification_status: ComplianceStatus
    verified_at: Optional[datetime]
    documents: List[str]  # Document types verified


@dataclass
class SelfExclusion:
    """Self-exclusion record"""
    user_id: int
    exclusion_type: ExclusionType
    start_date: datetime
    end_date: datetime
    reason: str
    is_active: bool


class ComplianceService:
    """Manage compliance and responsible gaming"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
        # Default loss limits per jurisdiction
        self.default_loss_limits = {
            'daily': Decimal('500'),
            'weekly': Decimal('2000'),
            'monthly': Decimal('5000'),
        }
    
    async def verify_kyc(
        self,
        user_id: int,
        kyc_data: Dict[str, Any],
    ) -> Tuple[bool, str]:
        """
        Verify KYC information
        
        Args:
            user_id: User ID
            kyc_data: KYC data dict {full_name, dob, country, documents}
            
        Returns:
            (success, message)
        """
        try:
            async with self.session_maker() as session:
                # Validate required fields
                required = ['full_name', 'date_of_birth', 'country']
                if not all(k in kyc_data for k in required):
                    return False, "Missing required KYC fields"
                
                # Calculate age
                dob = datetime.fromisoformat(kyc_data['date_of_birth'])
                age = (datetime.utcnow() - dob).days // 365
                
                if age < 18:
                    return False, "User must be 18+ years old"
                
                # Check for blacklist (simplified - would integrate with real AML service)
                blacklist_check = await self._check_blacklist(
                    kyc_data['full_name'],
                    kyc_data['country']
                )
                
                if blacklist_check['is_blacklisted']:
                    return False, f"KYC verification failed: {blacklist_check['reason']}"
                
                # Store KYC data
                await session.execute(text("""
                    UPDATE users
                    SET 
                        kyc_data = :kyc_data,
                        kyc_verified_at = :verified_at,
                        compliance_status = :status,
                        extra_data = jsonb_set(COALESCE(extra_data, '{}'), '{kyc_risk}', :risk)
                    WHERE id = :user_id
                """), {
                    'user_id': user_id,
                    'kyc_data': str(kyc_data),
                    'verified_at': datetime.utcnow(),
                    'status': ComplianceStatus.VERIFIED.value,
                    'risk': f'"{blacklist_check["aml_risk"].value}"',
                })
                
                await session.commit()
                return True, "KYC verified successfully"
        
        except Exception as e:
            logger.error(f"KYC verification error: {e}")
            return False, str(e)
    
    async def self_exclude_user(
        self,
        user_id: int,
        exclusion_type: ExclusionType,
        reason: str = "",
    ) -> Tuple[bool, str]:
        """
        Self-exclude user from platform
        
        Args:
            user_id: User ID
            exclusion_type: TEMPORARY, EXTENDED, PERMANENT
            reason: Exclusion reason
            
        Returns:
            (success, message)
        """
        try:
            # Calculate end date based on exclusion type
            duration_map = {
                ExclusionType.TEMPORARY: timedelta(days=30),
                ExclusionType.EXTENDED: timedelta(days=180),
                ExclusionType.PERMANENT: None,
            }
            
            duration = duration_map[exclusion_type]
            end_date = (datetime.utcnow() + duration) if duration else None
            
            async with self.session_maker() as session:
                # Create exclusion record
                await session.execute(text("""
                    INSERT INTO self_exclusions (user_id, exclusion_type, start_date, end_date, reason, is_active)
                    VALUES (:user_id, :type, :start, :end, :reason, true)
                    ON CONFLICT (user_id) DO UPDATE SET
                        exclusion_type = EXCLUDED.exclusion_type,
                        start_date = EXCLUDED.start_date,
                        end_date = EXCLUDED.end_date,
                        is_active = true
                """), {
                    'user_id': user_id,
                    'type': exclusion_type.value,
                    'start': datetime.utcnow(),
                    'end': end_date,
                    'reason': reason,
                })
                
                # Update user status
                await session.execute(text("""
                    UPDATE users
                    SET 
                        compliance_status = :status,
                        is_active = false
                    WHERE id = :user_id
                """), {
                    'user_id': user_id,
                    'status': ComplianceStatus.SELF_EXCLUDED.value,
                })
                
                await session.commit()
                return True, f"User self-excluded ({exclusion_type.value})"
        
        except Exception as e:
            logger.error(f"Self-exclusion error: {e}")
            return False, str(e)
    
    async def is_user_excluded(self, user_id: int) -> bool:
        """
        Check if user is currently excluded
        
        Args:
            user_id: User ID
            
        Returns:
            True if excluded
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(text("""
                    SELECT is_active, end_date
                    FROM self_exclusions
                    WHERE user_id = :user_id AND is_active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                """), {'user_id': user_id})
                
                row = result.fetchone()
                if not row:
                    return False
                
                is_active, end_date = row
                
                # Check if exclusion has expired
                if end_date and datetime.utcnow() > end_date:
                    # Mark as inactive
                    await session.execute(text("""
                        UPDATE self_exclusions
                        SET is_active = false
                        WHERE user_id = :user_id AND id = (
                            SELECT id FROM self_exclusions
                            WHERE user_id = :user_id
                            ORDER BY created_at DESC
                            LIMIT 1
                        )
                    """), {'user_id': user_id})
                    await session.commit()
                    return False
                
                return is_active
        
        except Exception as e:
            logger.error(f"Exclusion check error: {e}")
            return False
    
    async def check_loss_limit(
        self,
        user_id: int,
        period: str = 'daily',
    ) -> Dict[str, Any]:
        """
        Check user loss limit status
        
        Args:
            user_id: User ID
            period: 'daily', 'weekly', 'monthly'
            
        Returns:
            Loss limit status
        """
        try:
            async with self.session_maker() as session:
                # Calculate period start
                period_map = {
                    'daily': timedelta(days=1),
                    'weekly': timedelta(days=7),
                    'monthly': timedelta(days=30),
                }
                
                period_start = datetime.utcnow() - period_map[period]
                
                # Get user's configured limit
                result = await session.execute(text("""
                    SELECT extra_data -> 'loss_limit_{period}' as limit_amount
                    FROM users
                    WHERE id = :user_id
                """).format(period=period), {'user_id': user_id})
                
                limit_row = result.fetchone()
                limit = Decimal(limit_row[0]) if limit_row and limit_row[0] else self.default_loss_limits[period]
                
                # Calculate current period losses
                loss_result = await session.execute(text("""
                    SELECT SUM(CASE 
                                WHEN transaction_type = 'GAME_BET' AND outcome = 'LOSS' THEN amount
                                ELSE 0 
                            END) as total_loss
                    FROM transactions
                    WHERE user_id = :user_id
                    AND created_at >= :start_time
                    AND status = 'COMPLETED'
                """), {
                    'user_id': user_id,
                    'start_time': period_start,
                })
                
                loss_row = loss_result.fetchone()
                current_loss = Decimal(loss_row[0]) if loss_row and loss_row[0] else Decimal('0')
                
                remaining = limit - current_loss
                exceeded = remaining < 0
                
                return {
                    'period': period,
                    'limit': str(limit),
                    'current_loss': str(current_loss),
                    'remaining': str(remaining),
                    'exceeded': exceeded,
                    'percentage_used': f"{(current_loss / limit * 100):.2f}%" if limit > 0 else "0%",
                }
        
        except Exception as e:
            logger.error(f"Loss limit check error: {e}")
            return {'error': str(e)}
    
    async def check_responsible_gaming_limits(
        self,
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Comprehensive responsible gaming check
        
        Args:
            user_id: User ID
            
        Returns:
            All limit statuses
        """
        is_excluded = await self.is_user_excluded(user_id)
        
        if is_excluded:
            return {
                'is_excluded': True,
                'can_gamble': False,
                'reason': 'User is self-excluded',
            }
        
        daily_loss = await self.check_loss_limit(user_id, 'daily')
        weekly_loss = await self.check_loss_limit(user_id, 'weekly')
        monthly_loss = await self.check_loss_limit(user_id, 'monthly')
        
        can_gamble = not (
            daily_loss.get('exceeded', False) or
            weekly_loss.get('exceeded', False) or
            monthly_loss.get('exceeded', False)
        )
        
        return {
            'is_excluded': False,
            'can_gamble': can_gamble,
            'daily_loss': daily_loss,
            'weekly_loss': weekly_loss,
            'monthly_loss': monthly_loss,
        }
    
    async def _check_blacklist(
        self,
        full_name: str,
        country: str,
    ) -> Dict[str, Any]:
        """
        Check against AML blacklists (OFAC, etc)
        
        Args:
            full_name: User full name
            country: User country
            
        Returns:
            Blacklist check result
        """
        # Simplified check - would integrate with real AML provider
        # This is a placeholder implementation
        
        blacklisted_countries = ['KP', 'IR', 'SY']  # OFAC list (example)
        
        if country.upper() in blacklisted_countries:
            return {
                'is_blacklisted': True,
                'reason': f'Country {country} is restricted',
                'aml_risk': AMLRiskLevel.CRITICAL,
            }
        
        # In production, would check name against OFAC SDN list
        return {
            'is_blacklisted': False,
            'reason': 'Passed AML check',
            'aml_risk': AMLRiskLevel.LOW,
        }
