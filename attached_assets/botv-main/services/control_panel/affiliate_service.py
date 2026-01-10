"""Affiliate (marketer) service for referrals, commissions, payouts"""
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import (
    Affiliate,
    AffiliateReferral,
    AffiliateCommission,
    AffiliatePayout,
    AffiliateStatus,
    AffiliateTier,
    CommissionType,
    CommissionState,
    Wallet,
    WalletPurpose,
    WalletTransaction,
)


class AffiliateService:
    """Manage affiliates, referrals, commissions, and payouts"""

    def __init__(self):
        pass

    # ----------------- Affiliate CRUD -----------------
    async def create_affiliate(
        self,
        session: AsyncSession,
        user_id: int,
        name: str,
        commission_type: CommissionType,
        commission_rate: Decimal,
        tier: AffiliateTier = AffiliateTier.BRONZE,
    ) -> Affiliate:
        exists = await session.execute(select(Affiliate).where(Affiliate.user_id == user_id))
        if exists.scalar_one_or_none():
            raise ValueError("Affiliate already exists for user")

        affiliate = Affiliate(
            user_id=user_id,
            name=name,
            commission_type=commission_type,
            commission_rate=commission_rate,
            tier=tier,
            affiliate_code=str(uuid.uuid4())[:8].upper(),
            referral_token=str(uuid.uuid4()),
            link_signature=str(uuid.uuid4()),
            status=AffiliateStatus.ACTIVE,
            is_verified=True,
        )
        session.add(affiliate)
        await session.flush()
        return affiliate

    async def list_affiliates(self, session: AsyncSession) -> List[Affiliate]:
        result = await session.execute(select(Affiliate).order_by(Affiliate.created_at.desc()))
        return list(result.scalars().all())

    async def get_affiliate(self, session: AsyncSession, affiliate_id: int) -> Optional[Affiliate]:
        result = await session.execute(select(Affiliate).where(Affiliate.id == affiliate_id))
        return result.scalar_one_or_none()

    async def update_tier(self, session: AsyncSession, affiliate_id: int, tier: AffiliateTier) -> Affiliate:
        affiliate = await self.get_affiliate(session, affiliate_id)
        if not affiliate:
            raise ValueError("Affiliate not found")
        affiliate.tier = tier
        affiliate.tier_set_at = datetime.utcnow()
        await session.flush()
        return affiliate

    # ----------------- Referrals -----------------
    async def record_referral(self, session: AsyncSession, affiliate_id: int, referred_user_id: int) -> AffiliateReferral:
        affiliate = await self.get_affiliate(session, affiliate_id)
        if not affiliate:
            raise ValueError("Affiliate not found")
        existing = await session.execute(
            select(AffiliateReferral).where(
                AffiliateReferral.affiliate_id == affiliate_id,
                AffiliateReferral.referred_user_id == referred_user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("Referral already exists for this user")
        referral = AffiliateReferral(
            affiliate_id=affiliate_id,
            referred_user_id=referred_user_id,
            referral_date=datetime.utcnow(),
            attributed_at=datetime.utcnow(),
            status="active",
        )
        session.add(referral)
        affiliate.total_referrals += 1
        await session.flush()
        return referral

    # ----------------- Commission lifecycle -----------------
    async def calculate_commission(
        self,
        session: AsyncSession,
        affiliate_id: int,
        transaction_id: int,
        transaction_amount: Decimal,
        tx_type: str = "deposit",
        idempotency_key: Optional[str] = None,
    ) -> AffiliateCommission:
        affiliate = await self.get_affiliate(session, affiliate_id)
        if not affiliate:
            raise ValueError("Affiliate not found")
        if affiliate.status != AffiliateStatus.ACTIVE:
            raise ValueError("Affiliate not active")

        # simple tier multiplier example
        tier_multiplier = {
            AffiliateTier.BRONZE: Decimal("1.0"),
            AffiliateTier.SILVER: Decimal("1.1"),
            AffiliateTier.GOLD: Decimal("1.2"),
            AffiliateTier.PLATINUM: Decimal("1.3"),
        }[affiliate.tier]

        base_rate = affiliate.commission_rate
        if tx_type == "withdrawal":
            base_rate = affiliate.commission_rate / Decimal("2")  # example reduced rate

        if affiliate.commission_type == CommissionType.PERCENTAGE:
            commission_amount = (transaction_amount * base_rate / Decimal("100")) * tier_multiplier
        else:
            commission_amount = base_rate * tier_multiplier
        commission_amount = commission_amount.quantize(Decimal("0.01"))

        commission = AffiliateCommission(
            affiliate_id=affiliate_id,
            transaction_id=transaction_id,
            transaction_amount=transaction_amount,
            commission_amount=commission_amount,
            status=CommissionState.CALCULATED,
            idempotency_key=idempotency_key or str(uuid.uuid4()),
            created_at=datetime.utcnow(),
        )
        session.add(commission)
        affiliate.pending_commission += commission_amount
        await session.flush()
        return commission

    async def transition_commission(
        self,
        session: AsyncSession,
        commission_id: int,
        target: CommissionState,
        admin_id: Optional[int] = None,
        payout_id: Optional[int] = None,
    ) -> AffiliateCommission:
        result = await session.execute(select(AffiliateCommission).where(AffiliateCommission.id == commission_id))
        commission = result.scalar_one_or_none()
        if not commission:
            raise ValueError("Affiliate commission not found")

        allowed = {
            CommissionState.CALCULATED: {CommissionState.PENDING, CommissionState.REJECTED},
            CommissionState.PENDING: {CommissionState.APPROVED, CommissionState.REJECTED},
            CommissionState.APPROVED: {CommissionState.PAYABLE, CommissionState.REJECTED},
            CommissionState.PAYABLE: {CommissionState.PAID, CommissionState.REJECTED},
        }
        if commission.status in allowed and target not in allowed[commission.status]:
            raise ValueError(f"Invalid transition {commission.status} -> {target}")

        commission.status = target
        now = datetime.now(timezone.utc)
        if target == CommissionState.APPROVED:
            commission.approved_at = now
            commission.approved_by = admin_id
        if target == CommissionState.PAID:
            commission.paid_at = now
            commission.payout_id = payout_id
            await self._credit_escrow_wallet(session, commission)
        await session.flush()
        return commission

    # ----------------- Payouts -----------------
    async def request_payout(
        self,
        session: AsyncSession,
        affiliate_id: int,
        amount: Decimal,
        currency: str = "SAR",
        payment_method: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> AffiliatePayout:
        payout = AffiliatePayout(
            affiliate_id=affiliate_id,
            amount=amount,
            currency=currency,
            payment_method=payment_method,
            status="pending",
            idempotency_key=idempotency_key or str(uuid.uuid4()),
            created_at=datetime.utcnow(),
        )
        session.add(payout)
        await session.flush()
        return payout

    async def approve_payout(self, session: AsyncSession, payout_id: int, admin_id: int) -> AffiliatePayout:
        result = await session.execute(select(AffiliatePayout).where(AffiliatePayout.id == payout_id))
        payout = result.scalar_one_or_none()
        if not payout:
            raise ValueError("Payout not found")
        payout.status = "approved"
        payout.approved_at = datetime.utcnow()
        payout.approved_by = admin_id
        await session.flush()
        return payout

    async def mark_payout_paid(self, session: AsyncSession, payout_id: int, admin_id: int) -> AffiliatePayout:
        result = await session.execute(select(AffiliatePayout).where(AffiliatePayout.id == payout_id))
        payout = result.scalar_one_or_none()
        if not payout:
            raise ValueError("Payout not found")
        payout.status = "paid"
        payout.paid_at = datetime.utcnow()
        await self._debit_escrow_wallet(session, payout)
        await session.flush()
        return payout

    # ----------------- Wallet helpers -----------------
    async def _get_or_create_wallet(
        self,
        session: AsyncSession,
        user_id: int,
        currency: str = "SAR",
        purpose: WalletPurpose = WalletPurpose.ESCROW,
    ) -> Wallet:
        result = await session.execute(
            select(Wallet).where(
                Wallet.user_id == user_id,
                Wallet.currency == currency,
                Wallet.purpose == purpose,
            )
        )
        wallet = result.scalar_one_or_none()
        if wallet:
            return wallet
        wallet = Wallet(
            user_id=user_id,
            currency=currency,
            purpose=purpose,
            balance=Decimal("0.00"),
            total_commission=Decimal("0.00"),
            total_payouts=Decimal("0.00"),
            is_active=True,
        )
        session.add(wallet)
        await session.flush()
        return wallet

    async def _credit_escrow_wallet(self, session: AsyncSession, commission: AffiliateCommission) -> None:
        # credit affiliate escrow when commission is paid
        affiliate = await self.get_affiliate(session, commission.affiliate_id)
        wallet = await self._get_or_create_wallet(session, affiliate.user_id)
        wallet.balance += commission.commission_amount
        wallet.total_commission += commission.commission_amount
        wallet.updated_at = datetime.utcnow()
        tx = WalletTransaction(
            wallet_id=wallet.id,
            type="commission",
            amount=commission.commission_amount,
            reference_id=str(commission.transaction_id),
            reference_type="affiliate_commission",
            idempotency_key=commission.idempotency_key,
            status="completed",
            created_at=datetime.utcnow(),
        )
        session.add(tx)
        await session.flush()

    async def _debit_escrow_wallet(self, session: AsyncSession, payout: AffiliatePayout) -> None:
        # debit escrow on payout
        affiliate = await self.get_affiliate(session, payout.affiliate_id)
        wallet = await self._get_or_create_wallet(session, affiliate.user_id)
        if wallet.balance < payout.amount:
            raise ValueError("Insufficient escrow balance")
        wallet.balance -= payout.amount
        wallet.total_payouts += payout.amount
        wallet.updated_at = datetime.utcnow()
        tx = WalletTransaction(
            wallet_id=wallet.id,
            type="withdraw",
            amount=-payout.amount,
            reference_id=str(payout.id),
            reference_type="affiliate_payout",
            idempotency_key=payout.idempotency_key,
            status="completed",
            created_at=datetime.utcnow(),
        )
        session.add(tx)
        await session.flush()

    # ----------------- Analytics helpers -----------------
    async def get_affiliate_stats(self, session: AsyncSession, affiliate_id: int) -> dict:
        affiliate = await self.get_affiliate(session, affiliate_id)
        if not affiliate:
            raise ValueError("Affiliate not found")
        return {
            "affiliate_id": affiliate.id,
            "tier": affiliate.tier.value,
            "status": affiliate.status.value,
            "total_referrals": affiliate.total_referrals,
            "active_referrals": affiliate.active_referrals,
            "pending_commission": float(affiliate.pending_commission),
            "total_commission_paid": float(affiliate.total_commission_paid),
            "escrow_balance": float(affiliate.escrow_balance),
        }

