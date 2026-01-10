#!/usr/bin/env python3
"""
Payment processing service
Secure payment handling, provider integration, settlement
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timedelta
from enum import Enum
import logging
import hashlib
import hmac

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class PaymentProvider(Enum):
    """Payment service providers"""
    STRIPE = "stripe"
    PAYPAL = "paypal"
    CRYPTO = "crypto"
    WIRE_TRANSFER = "wire_transfer"
    CARD = "card"


class PaymentStatus(Enum):
    """Payment operation status"""
    INITIATED = "initiated"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PENDING_REVIEW = "pending_review"
    CANCELLED = "cancelled"


class SettlementStatus(Enum):
    """Settlement status"""
    PENDING = "pending"
    BATCHED = "batched"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PaymentRecord:
    """Payment record"""
    user_id: int
    amount: Decimal
    currency: str
    provider: PaymentProvider
    status: PaymentStatus
    transaction_id: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class PaymentProcessingService:
    """Handle payment processing securely"""
    
    def __init__(self, session_maker, provider_keys: Dict[str, str]):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
            provider_keys: Provider API keys
        """
        self.session_maker = session_maker
        self.provider_keys = provider_keys
        # PCI-DSS compliance: never log full card numbers
        self.pci_compliant = True
    
    async def initiate_deposit(
        self,
        user_id: int,
        amount: Decimal,
        provider: PaymentProvider,
        currency: str = 'USD',
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Initiate deposit payment
        
        Args:
            user_id: User ID
            amount: Deposit amount
            provider: Payment provider
            currency: Currency code
            
        Returns:
            (success, message, transaction_id)
        """
        try:
            # Validate amount
            if amount <= 0 or amount > Decimal('50000'):
                return False, "Invalid deposit amount", None
            
            async with self.session_maker() as session:
                # Check user's daily deposit limit
                daily_limit = Decimal('10000')
                
                result = await session.execute(text("""
                    SELECT COALESCE(SUM(amount), 0)
                    FROM transactions
                    WHERE user_id = :user_id
                    AND transaction_type = 'DEPOSIT'
                    AND status = 'COMPLETED'
                    AND created_at >= NOW() - INTERVAL '1 day'
                """), {'user_id': user_id})
                
                daily_total = Decimal(result.scalar())
                
                if daily_total + amount > daily_limit:
                    return False, "Daily deposit limit exceeded", None
                
                # Generate transaction ID
                transaction_id = self._generate_transaction_id(user_id, amount)
                
                # Create payment record
                await session.execute(text("""
                    INSERT INTO payments 
                    (user_id, amount, currency, provider, status, transaction_id, created_at)
                    VALUES (:user_id, :amount, :currency, :provider, :status, :txn_id, :created)
                """), {
                    'user_id': user_id,
                    'amount': amount,
                    'currency': currency,
                    'provider': provider.value,
                    'status': PaymentStatus.INITIATED.value,
                    'txn_id': transaction_id,
                    'created': datetime.utcnow(),
                })
                
                await session.commit()
                
                # In production: call actual payment provider API
                return True, "Deposit initiated", transaction_id
        
        except Exception as e:
            logger.error(f"Deposit initiation error: {e}")
            return False, str(e), None
    
    async def initiate_withdrawal(
        self,
        user_id: int,
        amount: Decimal,
        provider: PaymentProvider,
        currency: str = 'USD',
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Initiate withdrawal payment
        
        Args:
            user_id: User ID
            amount: Withdrawal amount
            provider: Payment provider
            currency: Currency code
            
        Returns:
            (success, message, transaction_id)
        """
        try:
            # Validate amount
            if amount <= 0 or amount > Decimal('50000'):
                return False, "Invalid withdrawal amount", None
            
            async with self.session_maker() as session:
                # Check user balance
                balance_result = await session.execute(text("""
                    SELECT balance FROM users WHERE id = :user_id
                """), {'user_id': user_id})
                
                balance = Decimal(balance_result.scalar() or 0)
                
                if balance < amount:
                    return False, "Insufficient balance", None
                
                # Check withdrawal cooldown (default 24 hours after last withdrawal)
                cooldown_result = await session.execute(text("""
                    SELECT MAX(created_at)
                    FROM transactions
                    WHERE user_id = :user_id
                    AND transaction_type = 'WITHDRAWAL'
                    AND status IN ('COMPLETED', 'PROCESSING')
                """), {'user_id': user_id})
                
                last_withdrawal = cooldown_result.scalar()
                if last_withdrawal:
                    time_since = (datetime.utcnow() - last_withdrawal).total_seconds()
                    if time_since < 86400:  # 24 hours
                        hours_remaining = (86400 - time_since) / 3600
                        return False, f"Withdrawal cooldown. Retry in {hours_remaining:.1f} hours", None
                
                # Generate transaction ID
                transaction_id = self._generate_transaction_id(user_id, amount)
                
                # Create payment record
                await session.execute(text("""
                    INSERT INTO payments 
                    (user_id, amount, currency, provider, status, transaction_id, created_at)
                    VALUES (:user_id, :amount, :currency, :provider, :status, :txn_id, :created)
                """), {
                    'user_id': user_id,
                    'amount': amount,
                    'currency': currency,
                    'provider': provider.value,
                    'status': PaymentStatus.INITIATED.value,
                    'txn_id': transaction_id,
                    'created': datetime.utcnow(),
                })
                
                # Hold funds (deduct from balance temporarily)
                await session.execute(text("""
                    UPDATE users
                    SET balance = balance - :amount
                    WHERE id = :user_id
                """), {
                    'user_id': user_id,
                    'amount': amount,
                })
                
                await session.commit()
                return True, "Withdrawal initiated", transaction_id
        
        except Exception as e:
            logger.error(f"Withdrawal initiation error: {e}")
            return False, str(e), None
    
    async def complete_payment(
        self,
        transaction_id: str,
        provider_confirmation: str,
    ) -> Tuple[bool, str]:
        """
        Mark payment as completed
        
        Args:
            transaction_id: Transaction ID
            provider_confirmation: Provider confirmation ID
            
        Returns:
            (success, message)
        """
        try:
            async with self.session_maker() as session:
                # Verify provider confirmation signature
                verified = await self._verify_provider_signature(
                    transaction_id,
                    provider_confirmation
                )
                
                if not verified:
                    return False, "Provider signature verification failed"
                
                # Get payment record
                result = await session.execute(text("""
                    SELECT user_id, amount, transaction_type
                    FROM transactions
                    WHERE id = :txn_id
                """), {'txn_id': transaction_id})
                
                row = result.fetchone()
                if not row:
                    return False, "Transaction not found"
                
                user_id, amount, txn_type = row
                
                # Update payment status
                await session.execute(text("""
                    UPDATE payments
                    SET status = :status, completed_at = :completed, provider_confirmation = :conf
                    WHERE transaction_id = :txn_id
                """), {
                    'status': PaymentStatus.COMPLETED.value,
                    'completed': datetime.utcnow(),
                    'conf': provider_confirmation,
                    'txn_id': transaction_id,
                })
                
                await session.commit()
                return True, "Payment completed successfully"
        
        except Exception as e:
            logger.error(f"Payment completion error: {e}")
            return False, str(e)
    
    async def get_settlement_batch(
        self,
        provider: PaymentProvider,
        batch_size: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get pending payments for settlement batch
        
        Args:
            provider: Payment provider
            batch_size: Maximum batch size
            
        Returns:
            List of pending payments
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(text("""
                    SELECT id, user_id, amount, currency, transaction_id
                    FROM payments
                    WHERE provider = :provider
                    AND status = :status
                    AND created_at >= NOW() - INTERVAL '24 hours'
                    LIMIT :limit
                """), {
                    'provider': provider.value,
                    'status': PaymentStatus.COMPLETED.value,
                    'limit': batch_size,
                })
                
                return [
                    {
                        'payment_id': row[0],
                        'user_id': row[1],
                        'amount': str(row[2]),
                        'currency': row[3],
                        'transaction_id': row[4],
                    }
                    for row in result.fetchall()
                ]
        
        except Exception as e:
            logger.error(f"Settlement batch error: {e}")
            return []
    
    def _generate_transaction_id(
        self,
        user_id: int,
        amount: Decimal,
    ) -> str:
        """
        Generate unique transaction ID
        
        Args:
            user_id: User ID
            amount: Transaction amount
            
        Returns:
            Transaction ID
        """
        data = f"{user_id}{amount}{datetime.utcnow().isoformat()}".encode()
        return hashlib.sha256(data).hexdigest()[:16]
    
    async def _verify_provider_signature(
        self,
        transaction_id: str,
        provider_confirmation: str,
    ) -> bool:
        """
        Verify payment provider signature
        
        Args:
            transaction_id: Transaction ID
            provider_confirmation: Provider signature
            
        Returns:
            True if valid
        """
        # In production: verify HMAC signature from provider webhook
        # This is a placeholder implementation
        
        try:
            # Get provider secret
            secret = self.provider_keys.get('webhook_secret', '')
            if not secret:
                return False
            
            # Compute expected signature
            message = f"{transaction_id}".encode()
            expected = hmac.new(
                secret.encode(),
                message,
                hashlib.sha256
            ).hexdigest()
            
            # Compare with timing-safe equality
            return hmac.compare_digest(expected, provider_confirmation)
        
        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            return False
