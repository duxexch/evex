"""Affiliates API Router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db, get_current_user
from services.control_panel.affiliate_service import AffiliateService
from services.control_panel import RBACService
from api.v1.control_panel.affiliates.schemas import (
    AffiliateCreate,
    AffiliateResponse,
    AffiliateTierUpdate,
    ReferralCreate,
    ReferralResponse,
    AffiliateCommissionCreate,
    AffiliateCommissionResponse,
    CommissionTransitionRequest,
    PayoutRequest,
    PayoutResponse,
    AffiliateStatsResponse,
)

router = APIRouter(prefix="/affiliates", tags=["Affiliates"])


def get_service() -> AffiliateService:
    return AffiliateService()


def get_rbac_service() -> RBACService:
    return RBACService()


def require_permission(permission: str):
    async def checker(
        db: AsyncSession = Depends(get_db),
        current_user=Depends(get_current_user),
        rbac: RBACService = Depends(get_rbac_service),
    ):
        allowed = await rbac.has_permission(db, current_user.id, permission)
        if not allowed:
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user

    return checker


@router.post("/", response_model=AffiliateResponse, status_code=201)
async def create_affiliate(
    request: AffiliateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:create")),
    service: AffiliateService = Depends(get_service),
):
    try:
        affiliate = await service.create_affiliate(
            db,
            user_id=request.user_id,
            name=request.name,
            commission_type=request.commission_type,
            commission_rate=request.commission_rate,
            tier=request.tier,
        )
        return affiliate
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[AffiliateResponse])
async def list_affiliates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:read")),
    service: AffiliateService = Depends(get_service),
):
    affiliates = await service.list_affiliates(db)
    return affiliates


@router.get("/{affiliate_id}", response_model=AffiliateResponse)
async def get_affiliate(
    affiliate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:read")),
    service: AffiliateService = Depends(get_service),
):
    affiliate = await service.get_affiliate(db, affiliate_id)
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    return affiliate


@router.patch("/{affiliate_id}/tier", response_model=AffiliateResponse)
async def update_tier(
    affiliate_id: int,
    request: AffiliateTierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:update")),
    service: AffiliateService = Depends(get_service),
):
    try:
        affiliate = await service.update_tier(db, affiliate_id, request.tier)
        return affiliate
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{affiliate_id}/referrals", response_model=ReferralResponse, status_code=201)
async def create_referral(
    affiliate_id: int,
    request: ReferralCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:referral")),
    service: AffiliateService = Depends(get_service),
):
    try:
        referral = await service.record_referral(db, affiliate_id, request.referred_user_id)
        return referral
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{affiliate_id}/commissions", response_model=AffiliateCommissionResponse, status_code=201)
async def create_commission(
    affiliate_id: int,
    request: AffiliateCommissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:commission")),
    service: AffiliateService = Depends(get_service),
):
    try:
        commission = await service.calculate_commission(
            db,
            affiliate_id=affiliate_id,
            transaction_id=request.transaction_id,
            transaction_amount=request.transaction_amount,
            tx_type=request.tx_type,
            idempotency_key=request.idempotency_key,
        )
        return commission
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/commissions/{commission_id}/transition", response_model=AffiliateCommissionResponse)
async def transition_commission(
    commission_id: int,
    request: CommissionTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:commission")),
    service: AffiliateService = Depends(get_service),
):
    try:
        commission = await service.transition_commission(
            db,
            commission_id=commission_id,
            target=request.target,
            admin_id=request.admin_id,
            payout_id=request.payout_id,
        )
        return commission
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{affiliate_id}/payouts", response_model=PayoutResponse, status_code=201)
async def request_payout(
    affiliate_id: int,
    request: PayoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:payout")),
    service: AffiliateService = Depends(get_service),
):
    try:
        payout = await service.request_payout(
            db,
            affiliate_id=affiliate_id,
            amount=request.amount,
            currency=request.currency,
            payment_method=request.payment_method,
            idempotency_key=request.idempotency_key,
        )
        return payout
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payouts/{payout_id}/approve", response_model=PayoutResponse)
async def approve_payout(
    payout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:payout")),
    service: AffiliateService = Depends(get_service),
):
    try:
        payout = await service.approve_payout(db, payout_id, current_user.id)
        return payout
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payouts/{payout_id}/pay", response_model=PayoutResponse)
async def pay_payout(
    payout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:payout")),
    service: AffiliateService = Depends(get_service),
):
    try:
        payout = await service.mark_payout_paid(db, payout_id, current_user.id)
        return payout
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{affiliate_id}/stats", response_model=AffiliateStatsResponse)
async def affiliate_stats(
    affiliate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("affiliate:stats")),
    service: AffiliateService = Depends(get_service),
):
    try:
        return await service.get_affiliate_stats(db, affiliate_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

