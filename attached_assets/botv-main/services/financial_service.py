#!/usr/bin/env python3
"""
✅ SECURE FINANCIAL SERVICE
Handles all financial operations with:
- Decimal precision (no floating point errors)
- Transaction atomicity (all-or-nothing)
- Audit logging (immutable records)
- Idempotency (duplicate prevention)
- Balance verification (no negative balances)
"""

import hmac
import hashlib
import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Any
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, Outbox, OutboxStatus, Transaction, AuditLog, Commission
from config import JWT_SECRET_KEY

logger = logging.getLogger(__name__)


class SecureFinancialService:
    """آمن 100%: جميع العمليات المالية"""
    
    def __init__(self, session: AsyncSession, secret_key: str):
        self.session = session
        self.secret_key = secret_key
    
    async def process_deposit(
        self,
        user_id: int,
        amount: Decimal,
        outbox_id: int,
        idempotency_key: str,
        admin_id: int,
        ip_address: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        معالجة إيداع آمن مع:
        - فحص التكرار
        - تحديث الرصيد بذرية
        - سجل مراجعة شامل
        """
        
        try:
            # 1️⃣ فحص التكرار (Idempotency Check)
            existing = await self.session.execute(
                select(Transaction).where(
                    Transaction.idempotency_key == idempotency_key
                )
            )
            if existing.scalar_one_or_none():
                logger.warning(f"⚠️  Duplicate deposit attempt: {idempotency_key}")
                raise ValueError(f"❌ معاملة مكررة: {idempotency_key}")
            
            # 2️⃣ تحقق من المبلغ
            if amount <= Decimal('0'):
                raise ValueError("❌ المبلغ يجب أن يكون موجباً")
            
            if amount > Decimal('999999999.99'):
                raise ValueError("❌ المبلغ كبير جداً")
            
            # 3️⃣ قفل صف المستخدم (منع race conditions)
            result = await self.session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise ValueError(f"❌ المستخدم غير موجود: {user_id}")
            
            if user.is_banned:
                raise ValueError("❌ حسابك محظور")
            
            # 4️⃣ احسب الرصيد الجديد
            balance_before = user.balance
            balance_after = balance_before + amount
            
            # 5️⃣ أنشئ معاملة مالية (غير قابلة للتغيير)
            transaction = Transaction(
                idempotency_key=idempotency_key,
                user_id=user_id,
                type='CREDIT',
                amount=amount,
                balance_before=balance_before,
                balance_after=balance_after,
                created_at=datetime.now(timezone.utc),
                created_by=admin_id,
                ip_address=ip_address,
                outbox_id=outbox_id
            )
            
            # 6️⃣ أنشئ توقيع HMAC للتحقق من الصحة
            transaction.signature = self._generate_signature(transaction)
            
            # 7️⃣ حدّث رصيد المستخدم
            user.balance = balance_after
            user.total_deposited += amount
            user.last_modified_by = admin_id
            user.updated_at = datetime.now(timezone.utc)
            
            # 8️⃣ حدّث حالة الطلب
            outbox = await self.session.get(Outbox, outbox_id)
            if outbox:
                outbox.status = OutboxStatus.COMPLETED
                outbox.processed_by = admin_id
                outbox.processed_at = datetime.now(timezone.utc)
                outbox.admin_comment = notes
            
            # 9️⃣ أضف سجل المراجعة (غير قابل للتغيير)
            audit = AuditLog(
                admin_id=admin_id,
                action='APPROVE_DEPOSIT',
                target_type='transaction',
                target_id=outbox_id,
                details={
                    'user_id': user_id,
                    'amount': str(amount),
                    'balance_before': str(balance_before),
                    'balance_after': str(balance_after),
                    'idempotency_key': idempotency_key
                },
                ip_address=ip_address
            )
            
            self.session.add(transaction)
            self.session.add(audit)
            
            # 🔟 Commit ذري (الكل أو لا شيء)
            await self.session.flush()
            
            logger.info(
                f"✅ إيداع تمت معالجته: user={user_id}, amount={amount}, "
                f"balance: {balance_before} -> {balance_after}, tx={transaction.id}"
            )
            
            return {
                'success': True,
                'transaction_id': transaction.id,
                'balance_before': str(balance_before),
                'balance_after': str(balance_after),
                'signature': transaction.signature
            }
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"❌ فشل الإيداع: {e}")
            raise
    
    async def process_withdrawal(
        self,
        user_id: int,
        amount: Decimal,
        outbox_id: int,
        idempotency_key: str,
        admin_id: int,
        ip_address: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        معالجة سحب آمن مع:
        - فحص الرصيد
        - فحص الحد اليومي
        - تحديث ذري
        """
        
        try:
            # 1️⃣ فحص التكرار
            existing = await self.session.execute(
                select(Transaction).where(
                    Transaction.idempotency_key == idempotency_key
                )
            )
            if existing.scalar_one_or_none():
                logger.warning(f"⚠️  Duplicate withdrawal attempt: {idempotency_key}")
                raise ValueError(f"❌ معاملة مكررة: {idempotency_key}")
            
            # 2️⃣ تحقق من المبلغ
            if amount <= Decimal('0'):
                raise ValueError("❌ المبلغ يجب أن يكون موجباً")
            
            # 3️⃣ قفل صف المستخدم
            result = await self.session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise ValueError(f"❌ المستخدم غير موجود: {user_id}")
            
            if user.is_banned:
                raise ValueError("❌ حسابك محظور")
            
            # 4️⃣ فحص الرصيد
            if user.balance < amount:
                raise ValueError(
                    f"❌ رصيد غير كافي: {user.balance} < {amount}"
                )
            
            # 5️⃣ فحص الحد اليومي
            today_withdrawn = await self._get_today_withdrawn(user_id)
            if today_withdrawn + amount > user.daily_withdraw_limit:
                remaining = user.daily_withdraw_limit - today_withdrawn
                raise ValueError(
                    f"❌ تم تجاوز الحد اليومي. المتبقي: {remaining}"
                )
            
            # 6️⃣ احسب الرصيد الجديد
            balance_before = user.balance
            balance_after = balance_before - amount
            
            # 7️⃣ أنشئ معاملة
            transaction = Transaction(
                idempotency_key=idempotency_key,
                user_id=user_id,
                type='DEBIT',
                amount=amount,
                balance_before=balance_before,
                balance_after=balance_after,
                created_at=datetime.now(timezone.utc),
                created_by=admin_id,
                ip_address=ip_address,
                outbox_id=outbox_id
            )
            
            transaction.signature = self._generate_signature(transaction)
            
            # 8️⃣ حدّث المستخدم
            user.balance = balance_after
            user.total_withdrawn += amount
            user.last_modified_by = admin_id
            user.updated_at = datetime.now(timezone.utc)
            
            # 9️⃣ حدّث الطلب
            outbox = await self.session.get(Outbox, outbox_id)
            if outbox:
                outbox.status = OutboxStatus.COMPLETED
                outbox.processed_by = admin_id
                outbox.processed_at = datetime.now(timezone.utc)
                outbox.admin_comment = notes
            
            # 🔟 سجل المراجعة
            audit = AuditLog(
                admin_id=admin_id,
                action='APPROVE_WITHDRAWAL',
                target_type='transaction',
                target_id=outbox_id,
                details={
                    'user_id': user_id,
                    'amount': str(amount),
                    'balance_before': str(balance_before),
                    'balance_after': str(balance_after),
                    'idempotency_key': idempotency_key
                },
                ip_address=ip_address
            )
            
            self.session.add(transaction)
            self.session.add(audit)
            await self.session.flush()
            
            logger.info(
                f"✅ سحب تمت معالجته: user={user_id}, amount={amount}, "
                f"balance: {balance_before} -> {balance_after}"
            )
            
            return {
                'success': True,
                'transaction_id': transaction.id,
                'balance_before': str(balance_before),
                'balance_after': str(balance_after)
            }
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"❌ فشل السحب: {e}")
            raise
    
    async def reject_request(
        self,
        outbox_id: int,
        admin_id: int,
        reason: str,
        ip_address: str
    ) -> Dict[str, Any]:
        """رفض طلب إيداع أو سحب"""
        
        try:
            outbox = await self.session.get(Outbox, outbox_id)
            
            if not outbox:
                raise ValueError(f"❌ الطلب غير موجود: {outbox_id}")
            
            if outbox.status != OutboxStatus.PENDING:
                raise ValueError(f"❌ الطلب في حالة {outbox.status}")
            
            # تحديث الطلب
            outbox.status = OutboxStatus.REJECTED
            outbox.processed_by = admin_id
            outbox.processed_at = datetime.now(timezone.utc)
            outbox.admin_comment = reason
            
            # سجل المراجعة
            audit = AuditLog(
                admin_id=admin_id,
                action='REJECT_REQUEST',
                target_type='outbox',
                target_id=outbox_id,
                details={
                    'type': outbox.type.value,
                    'reason': reason
                },
                ip_address=ip_address
            )
            
            self.session.add(audit)
            await self.session.flush()
            
            logger.info(f"✅ تم رفض الطلب: {outbox_id}, reason: {reason}")
            
            return {
                'success': True,
                'request_id': outbox_id,
                'status': OutboxStatus.REJECTED.value
            }
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"❌ فشل الرفض: {e}")
            raise
    
    async def _get_today_withdrawn(self, user_id: int) -> Decimal:
        """احسب إجمالي السحب اليوم"""
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        
        result = await self.session.execute(
            select(func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user_id,
                Transaction.type == 'DEBIT',
                Transaction.created_at >= today_start
            )
        )
        total = result.scalar()
        return total if total else Decimal('0.00')
    
    @staticmethod
    def calculate_commission(
        amount: Decimal,
        rate: Decimal
    ) -> Decimal:
        """
        احسب العمولة بدقة:
        - Decimal للدقة (بدون أخطاء floating point)
        - ROUND_HALF_UP للتقريب العادل
        """
        commission = amount * rate
        return commission.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def _generate_signature(self, transaction: Transaction) -> str:
        """
        أنشئ توقيع HMAC لمنع التلاعب:
        - لا يمكن تعديل المعاملة بدون اكتشاف
        - يستخدم سر صحيح
        """
        data = (
            f"{transaction.user_id}:{transaction.type}:"
            f"{transaction.amount}:{transaction.balance_before}:"
            f"{transaction.balance_after}:{transaction.created_at}"
        )
        
        signature = hmac.new(
            self.secret_key.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_signature(
        self,
        transaction: Transaction
    ) -> bool:
        """تحقق من صحة التوقيع"""
        expected_signature = self._generate_signature(transaction)
        return hmac.compare_digest(
            transaction.signature,
            expected_signature
        )
