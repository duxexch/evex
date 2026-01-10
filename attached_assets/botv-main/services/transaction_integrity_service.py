#!/usr/bin/env python3
"""
Transaction integrity and validation
Ensures financial accuracy and consistency
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
from decimal import Decimal
from datetime import datetime, timedelta
import hashlib
import hmac
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class TransactionType(str, Enum):
    """Transaction types"""
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    GAME_BET = "GAME_BET"
    GAME_PAYOUT = "GAME_PAYOUT"
    BONUS = "BONUS"
    REFUND = "REFUND"
    FEE = "FEE"
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"


class TransactionStatus(str, Enum):
    """Transaction status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    DISPUTED = "DISPUTED"


@dataclass
class TransactionRecord:
    """Single transaction record"""
    user_id: int
    transaction_type: TransactionType
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    reference_id: str
    status: TransactionStatus = TransactionStatus.PENDING
    metadata: Dict[str, Any] = None
    created_at: Optional[datetime] = None
    checksum: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'user_id': self.user_id,
            'transaction_type': self.transaction_type.value,
            'amount': str(self.amount),
            'balance_before': str(self.balance_before),
            'balance_after': str(self.balance_after),
            'reference_id': self.reference_id,
            'status': self.status.value,
            'metadata': self.metadata or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'checksum': self.checksum,
        }


class TransactionValidator:
    """Validate transaction integrity"""
    
    def __init__(self):
        """Initialize validator"""
        self.errors: List[str] = []
    
    def validate_transaction(
        self,
        transaction: TransactionRecord,
    ) -> Tuple[bool, List[str]]:
        """
        Validate transaction
        
        Args:
            transaction: Transaction to validate
            
        Returns:
            (valid, errors) tuple
        """
        self.errors = []
        
        # Amount validation
        if transaction.amount <= 0:
            self.errors.append("Amount must be positive")
        
        if transaction.amount > Decimal('1000000'):  # Max transaction
            self.errors.append("Amount exceeds maximum")
        
        # Balance validation
        if transaction.balance_before < 0:
            self.errors.append("Balance before cannot be negative")
        
        if transaction.balance_after < 0:
            self.errors.append("Balance after cannot be negative")
        
        # Math validation (balance consistency)
        expected_balance = self._calculate_expected_balance(transaction)
        if abs(transaction.balance_after - expected_balance) > Decimal('0.01'):
            self.errors.append(
                f"Balance mismatch: expected {expected_balance}, got {transaction.balance_after}"
            )
        
        # Reference ID validation
        if not transaction.reference_id or len(transaction.reference_id) < 10:
            self.errors.append("Invalid reference ID")
        
        return len(self.errors) == 0, self.errors
    
    def _calculate_expected_balance(
        self,
        transaction: TransactionRecord,
    ) -> Decimal:
        """Calculate expected balance after transaction"""
        if transaction.transaction_type in (
            TransactionType.DEPOSIT,
            TransactionType.GAME_PAYOUT,
            TransactionType.BONUS,
        ):
            return transaction.balance_before + transaction.amount
        elif transaction.transaction_type in (
            TransactionType.WITHDRAWAL,
            TransactionType.GAME_BET,
            TransactionType.FEE,
        ):
            return transaction.balance_before - transaction.amount
        else:
            # Adjustment type
            return transaction.balance_before + transaction.amount


class TransactionIntegrityService:
    """Manage transaction integrity"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
        self.validator = TransactionValidator()
        self.secret_key = "transaction_integrity_secret"  # Use config
    
    async def record_transaction(
        self,
        transaction: TransactionRecord,
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Record transaction with integrity checks
        
        Args:
            transaction: Transaction to record
            
        Returns:
            (success, transaction_id, error) tuple
        """
        # Validate transaction
        valid, errors = self.validator.validate_transaction(transaction)
        if not valid:
            return False, None, f"Validation failed: {', '.join(errors)}"
        
        # Generate checksum
        transaction.checksum = self._generate_checksum(transaction)
        transaction.created_at = datetime.utcnow()
        
        try:
            async with self.session_maker() as session:
                # Get current user balance
                current_balance = await self._get_user_balance(session, transaction.user_id)
                
                # Verify balance consistency
                if current_balance != transaction.balance_before:
                    return False, None, f"Balance mismatch: user has {current_balance}, transaction expects {transaction.balance_before}"
                
                # Record transaction
                result = await session.execute(text("""
                    INSERT INTO transactions 
                    (user_id, transaction_type, amount, balance_before, balance_after, 
                     reference_id, status, metadata)
                    VALUES (:user_id, :type, :amount, :before, :after, :ref, :status, :meta)
                    RETURNING id
                """), {
                    'user_id': transaction.user_id,
                    'type': transaction.transaction_type.value,
                    'amount': str(transaction.amount),
                    'before': str(transaction.balance_before),
                    'after': str(transaction.balance_after),
                    'ref': transaction.reference_id,
                    'status': transaction.status.value,
                    'meta': transaction.metadata or {},
                })
                
                transaction_id = result.scalar()
                
                # Update user balance
                await self._update_user_balance(
                    session,
                    transaction.user_id,
                    transaction.balance_after,
                )
                
                await session.commit()
                
                logger.info(f"Transaction {transaction_id} recorded for user {transaction.user_id}")
                return True, str(transaction_id), None
        
        except Exception as e:
            logger.error(f"Failed to record transaction: {e}")
            return False, None, str(e)
    
    async def verify_transaction(
        self,
        transaction_id: int,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify transaction integrity
        
        Args:
            transaction_id: Transaction ID
            
        Returns:
            (valid, error_message) tuple
        """
        try:
            async with self.session_maker() as session:
                # Fetch transaction
                result = await session.execute(text("""
                    SELECT user_id, transaction_type, amount, balance_before, 
                           balance_after, reference_id, metadata, created_at
                    FROM transactions WHERE id = :id
                """), {'id': transaction_id})
                
                row = result.fetchone()
                if not row:
                    return False, "Transaction not found"
                
                # Reconstruct transaction
                transaction = TransactionRecord(
                    user_id=row[0],
                    transaction_type=TransactionType[row[1]],
                    amount=Decimal(row[2]),
                    balance_before=Decimal(row[3]),
                    balance_after=Decimal(row[4]),
                    reference_id=row[5],
                    metadata=row[6],
                    created_at=row[7],
                )
                
                # Verify balance math
                valid, errors = self.validator.validate_transaction(transaction)
                if not valid:
                    return False, f"Validation failed: {', '.join(errors)}"
                
                return True, None
        
        except Exception as e:
            logger.error(f"Verification error: {e}")
            return False, str(e)
    
    async def audit_user_balance(
        self,
        user_id: int,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Audit user account balance
        
        Args:
            user_id: User ID
            
        Returns:
            (is_correct, audit_report) tuple
        """
        try:
            async with self.session_maker() as session:
                # Get current balance
                current_balance = await self._get_user_balance(session, user_id)
                
                # Calculate expected balance from transactions
                result = await session.execute(text("""
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN transaction_type IN ('DEPOSIT', 'GAME_PAYOUT', 'BONUS')
                            THEN amount
                            ELSE -amount
                        END
                    ), 0) as calculated_balance
                    FROM transactions 
                    WHERE user_id = :user_id AND status = 'COMPLETED'
                """), {'user_id': user_id})
                
                calculated_balance = Decimal(result.scalar())
                
                # Get transaction count
                result = await session.execute(text("""
                    SELECT COUNT(*) FROM transactions WHERE user_id = :user_id
                """), {'user_id': user_id})
                
                transaction_count = result.scalar()
                
                # Check for discrepancies
                discrepancy = abs(current_balance - calculated_balance)
                is_correct = discrepancy < Decimal('0.01')
                
                return is_correct, {
                    'user_id': user_id,
                    'current_balance': str(current_balance),
                    'calculated_balance': str(calculated_balance),
                    'discrepancy': str(discrepancy),
                    'is_correct': is_correct,
                    'transaction_count': transaction_count,
                    'audit_timestamp': datetime.utcnow().isoformat(),
                }
        
        except Exception as e:
            logger.error(f"Audit error: {e}")
            return False, {'error': str(e)}
    
    async def reconcile_accounts(
        self,
        hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Reconcile all accounts
        
        Args:
            hours: Reconcile transactions from last N hours
            
        Returns:
            Reconciliation report
        """
        try:
            async with self.session_maker() as session:
                cutoff = datetime.utcnow() - timedelta(hours=hours)
                
                # Find discrepancies
                result = await session.execute(text(f"""
                    WITH balances AS (
                        SELECT user_id,
                               COALESCE(SUM(
                                   CASE 
                                       WHEN transaction_type IN ('DEPOSIT', 'GAME_PAYOUT', 'BONUS')
                                       THEN amount
                                       ELSE -amount
                                   END
                               ), 0) as calculated
                        FROM transactions
                        WHERE created_at > :cutoff AND status = 'COMPLETED'
                        GROUP BY user_id
                    )
                    SELECT user_id, calculated FROM balances
                """), {'cutoff': cutoff})
                
                discrepancies = []
                for user_id, calculated in result.fetchall():
                    is_correct, audit = await self.audit_user_balance(user_id)
                    if not is_correct:
                        discrepancies.append(audit)
                
                return {
                    'total_discrepancies': len(discrepancies),
                    'discrepancies': discrepancies,
                    'reconciliation_time': datetime.utcnow().isoformat(),
                }
        
        except Exception as e:
            logger.error(f"Reconciliation error: {e}")
            return {'error': str(e), 'total_discrepancies': -1}
    
    async def _get_user_balance(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> Decimal:
        """Get user current balance"""
        result = await session.execute(text("""
            SELECT COALESCE(balance, 0) FROM users WHERE id = :id
        """), {'id': user_id})
        
        balance = result.scalar()
        return Decimal(balance) if balance else Decimal('0')
    
    async def _update_user_balance(
        self,
        session: AsyncSession,
        user_id: int,
        new_balance: Decimal,
    ):
        """Update user balance"""
        await session.execute(text("""
            UPDATE users SET balance = :balance, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        """), {'balance': str(new_balance), 'id': user_id})
    
    def _generate_checksum(self, transaction: TransactionRecord) -> str:
        """Generate transaction checksum for integrity"""
        data = f"{transaction.user_id}:{transaction.transaction_type.value}:{transaction.amount}:{transaction.balance_before}:{transaction.balance_after}:{transaction.reference_id}"
        return hmac.new(
            self.secret_key.encode(),
            data.encode(),
            hashlib.sha256,
        ).hexdigest()
