#!/usr/bin/env python3
"""
Phase 8 API Routes
Business-critical hardening endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from api.dependencies import get_db, get_current_user
from services.transaction_integrity_service import TransactionIntegrityService
from services.revenue_protection_service import RevenueLimitsService
from services.financial_metrics_service import FinancialMetricsService
from services.compliance_service import ComplianceService, ExclusionType
from services.fraud_detection_service import FraudDetectionService
from services.payment_processing_service import PaymentProcessingService, PaymentProvider

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


# ============================================================================
# TRANSACTION INTEGRITY ENDPOINTS
# ============================================================================

@router.post("/transactions/record")
async def record_transaction(
    user_id: int,
    transaction_data: dict,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Record and validate transaction"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = TransactionIntegrityService(session)
    success, data = await service.record_transaction(
        user_id=user_id,
        transaction_type=transaction_data['type'],
        amount=Decimal(transaction_data['amount']),
        reference_id=transaction_data.get('reference_id', ''),
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=str(data))
    
    return {'status': 'recorded', 'transaction': data}


@router.get("/transactions/verify/{transaction_id}")
async def verify_transaction(
    transaction_id: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Verify transaction integrity"""
    service = TransactionIntegrityService(session)
    success, data = await service.verify_transaction(transaction_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {'transaction': data, 'verified': True}


@router.get("/users/{user_id}/audit")
async def audit_user_balance(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Audit user balance consistency"""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = TransactionIntegrityService(session)
    success, data = await service.audit_user_balance(user_id)
    
    return {
        'user_id': user_id,
        'audit': data,
        'discrepancy_detected': data.get('discrepancy', 0) != 0,
    }


@router.post("/accounts/reconcile")
async def reconcile_accounts(
    start_date: datetime,
    end_date: datetime,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Reconcile all accounts in timeframe"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = TransactionIntegrityService(session)
    success, data = await service.reconcile_accounts(start_date, end_date)
    
    return {
        'period': f"{start_date.date()} to {end_date.date()}",
        'reconciliation': data,
    }


# ============================================================================
# REVENUE PROTECTION ENDPOINTS
# ============================================================================

@router.get("/users/{user_id}/limits")
async def get_user_limits(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get user's configured limits"""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = RevenueLimitsService(session)
    limits = await service.get_user_limits(user_id)
    
    return {'user_id': user_id, 'limits': limits}


@router.post("/users/{user_id}/limits")
async def set_user_limits(
    user_id: int,
    limits: dict,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Set user limits (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = RevenueLimitsService(session)
    success = await service.set_user_limit(user_id, limits)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to set limits")
    
    return {'user_id': user_id, 'limits_updated': True}


@router.get("/users/{user_id}/metrics")
async def get_user_metrics(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get user's 7-day activity metrics"""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = RevenueLimitsService(session)
    metrics = await service.get_user_metrics(user_id)
    
    return {'user_id': user_id, 'metrics': metrics}


@router.get("/users/{user_id}/risk-assessment")
async def assess_user_risk(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Assess user's financial risk level"""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = RevenueLimitsService(session)
    risk = await service._assess_risk(user_id)
    
    return {
        'user_id': user_id,
        'risk_level': risk.value,
        'can_bet': risk.value not in ['HIGH', 'CRITICAL'],
    }


# ============================================================================
# FINANCIAL METRICS ENDPOINTS
# ============================================================================

@router.get("/metrics/daily/{date}")
async def get_daily_metrics(
    date: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get daily financial metrics"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = FinancialMetricsService(session)
    summary = await service.get_daily_summary(datetime.fromisoformat(date))
    
    return summary


@router.get("/metrics/period")
async def get_period_metrics(
    start_date: str,
    end_date: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get period financial metrics"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = FinancialMetricsService(session)
    summary = await service.get_period_summary(
        datetime.fromisoformat(start_date),
        datetime.fromisoformat(end_date),
    )
    
    return summary


@router.get("/metrics/report")
async def export_financial_report(
    start_date: str,
    end_date: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Export comprehensive financial report"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = FinancialMetricsService(session)
    report = await service.export_financial_report(
        datetime.fromisoformat(start_date),
        datetime.fromisoformat(end_date),
    )
    
    return report


# ============================================================================
# COMPLIANCE ENDPOINTS
# ============================================================================

@router.post("/kyc/verify")
async def verify_kyc(
    user_id: int,
    kyc_data: dict,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Submit KYC verification"""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = ComplianceService(session)
    success, message = await service.verify_kyc(user_id, kyc_data)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {'user_id': user_id, 'verified': True, 'message': message}


@router.post("/self-exclude")
async def self_exclude(
    user_id: int,
    exclusion_type: str = "temporary",
    reason: str = "",
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Self-exclude from platform"""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = ComplianceService(session)
    success, message = await service.self_exclude_user(
        user_id,
        ExclusionType[exclusion_type.upper()],
        reason,
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {'user_id': user_id, 'excluded': True, 'message': message}


@router.get("/users/{user_id}/responsible-gaming")
async def get_responsible_gaming_status(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Check responsible gaming status"""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = ComplianceService(session)
    status = await service.check_responsible_gaming_limits(user_id)
    
    return {'user_id': user_id, 'status': status}


# ============================================================================
# FRAUD DETECTION ENDPOINTS
# ============================================================================

@router.get("/fraud/analyze/{user_id}")
async def analyze_fraud_patterns(
    user_id: int,
    days: int = 7,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Analyze user for fraud patterns"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = FraudDetectionService(session)
    patterns = await service.analyze_user_patterns(user_id, days)
    score, level = await service.calculate_fraud_score(user_id)
    
    return {
        'user_id': user_id,
        'patterns': patterns,
        'fraud_score': score,
        'fraud_level': level.value,
    }


@router.post("/fraud/check-velocity")
async def check_velocity(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Check for betting velocity spike"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = FraudDetectionService(session)
    anomaly = await service.detect_velocity_spike(user_id)
    
    if anomaly:
        await service.log_anomaly(user_id, anomaly)
    
    return {
        'user_id': user_id,
        'velocity_detected': anomaly is not None,
        'anomaly': anomaly.__dict__ if anomaly else None,
    }


@router.post("/fraud/check-winning-streak")
async def check_winning_streak(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Check for improbable winning streak"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = FraudDetectionService(session)
    anomaly = await service.detect_winning_streak(user_id)
    
    if anomaly:
        await service.log_anomaly(user_id, anomaly)
    
    return {
        'user_id': user_id,
        'streak_detected': anomaly is not None,
        'anomaly': anomaly.__dict__ if anomaly else None,
    }


# ============================================================================
# PAYMENT PROCESSING ENDPOINTS
# ============================================================================

@router.post("/payments/deposit")
async def initiate_deposit(
    amount: float,
    provider: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Initiate deposit"""
    service = PaymentProcessingService(session, {})
    success, message, txn_id = await service.initiate_deposit(
        current_user.id,
        Decimal(str(amount)),
        PaymentProvider[provider.upper()],
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        'user_id': current_user.id,
        'amount': amount,
        'transaction_id': txn_id,
        'message': message,
    }


@router.post("/payments/withdraw")
async def initiate_withdrawal(
    amount: float,
    provider: str,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Initiate withdrawal"""
    service = PaymentProcessingService(session, {})
    success, message, txn_id = await service.initiate_withdrawal(
        current_user.id,
        Decimal(str(amount)),
        PaymentProvider[provider.upper()],
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        'user_id': current_user.id,
        'amount': amount,
        'transaction_id': txn_id,
        'message': message,
    }
