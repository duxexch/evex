from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from models import AffiliateStatus, AffiliateTier, CommissionState, CommissionType


class AffiliateCreate(BaseModel):
    user_id: int
    name: str
    commission_type: CommissionType
    commission_rate: Decimal = Field(..., gt=Decimal("0"))
    tier: AffiliateTier = AffiliateTier.BRONZE


class AffiliateResponse(BaseModel):
    id: int
    user_id: int
    affiliate_code: str
    name: str
    commission_type: CommissionType
    commission_rate: Decimal
    tier: AffiliateTier
    status: AffiliateStatus
    pending_commission: Decimal
    total_commission_paid: Decimal
    escrow_balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class AffiliateTierUpdate(BaseModel):
    tier: AffiliateTier


class ReferralCreate(BaseModel):
    referred_user_id: int


class ReferralResponse(BaseModel):
    id: int
    affiliate_id: int
    referred_user_id: int
    status: str
    referral_date: datetime
    attributed_at: datetime

    class Config:
        from_attributes = True


class AffiliateCommissionCreate(BaseModel):
    transaction_amount: Decimal
    transaction_id: int
    tx_type: str = "deposit"
    idempotency_key: Optional[str] = None


class AffiliateCommissionResponse(BaseModel):
    id: int
    affiliate_id: int
    transaction_id: int
    transaction_amount: Decimal
    commission_amount: Decimal
    status: CommissionState
    idempotency_key: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CommissionTransitionRequest(BaseModel):
    target: CommissionState
    admin_id: Optional[int] = None
    payout_id: Optional[int] = None


class PayoutRequest(BaseModel):
    amount: Decimal
    currency: str = "SAR"
    payment_method: Optional[str] = None
    idempotency_key: Optional[str] = None


class PayoutResponse(BaseModel):
    id: int
    affiliate_id: int
    amount: Decimal
    currency: str
    payment_method: Optional[str] = None
    status: str
    idempotency_key: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AffiliateStatsResponse(BaseModel):
    affiliate_id: int
    tier: str
    status: str
    total_referrals: int
    active_referrals: int
    pending_commission: float
    total_commission_paid: float
    escrow_balance: float

