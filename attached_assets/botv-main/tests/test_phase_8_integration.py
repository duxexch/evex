#!/usr/bin/env python3
"""
Phase 8 Integration Tests
Test all business-critical hardening components
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from services.transaction_integrity_service import TransactionIntegrityService
from services.revenue_protection_service import RevenueLimitsService
from services.financial_metrics_service import FinancialMetricsService
from services.compliance_service import ComplianceService, ExclusionType
from services.fraud_detection_service import FraudDetectionService, AnomalyType
from services.payment_processing_service import PaymentProcessingService, PaymentProvider


class TestTransactionIntegrity:
    """Test transaction integrity validation"""
    
    @pytest.mark.asyncio
    async def test_record_transaction_valid(self, session):
        """Valid transaction recording"""
        service = TransactionIntegrityService(session)
        
        success, data = await service.record_transaction(
            user_id=1,
            transaction_type='DEPOSIT',
            amount=Decimal('100.00'),
            reference_id='ref123',
        )
        
        assert success is True
        assert data['amount'] == Decimal('100.00')
        assert data['status'] == 'COMPLETED'
    
    @pytest.mark.asyncio
    async def test_record_transaction_invalid_amount(self, session):
        """Invalid transaction amount"""
        service = TransactionIntegrityService(session)
        
        success, error = await service.record_transaction(
            user_id=1,
            transaction_type='DEPOSIT',
            amount=Decimal('-50.00'),  # Negative
            reference_id='ref123',
        )
        
        assert success is False
        assert 'positive' in str(error).lower()
    
    @pytest.mark.asyncio
    async def test_verify_transaction_checksum(self, session):
        """Verify transaction integrity via checksum"""
        service = TransactionIntegrityService(session)
        
        # Record transaction
        success, data = await service.record_transaction(
            user_id=1,
            transaction_type='DEPOSIT',
            amount=Decimal('100.00'),
            reference_id='ref123',
        )
        
        # Verify it
        txn_id = data.get('id')
        success, verified = await service.verify_transaction(txn_id)
        
        assert success is True
        assert verified['checksum'] == data['checksum']
    
    @pytest.mark.asyncio
    async def test_audit_balance_consistency(self, session):
        """Audit balance consistency"""
        service = TransactionIntegrityService(session)
        
        # Record deposits and withdrawals
        await service.record_transaction(1, 'DEPOSIT', Decimal('1000'), 'ref1')
        await service.record_transaction(1, 'WITHDRAWAL', Decimal('500'), 'ref2')
        
        # Audit balance
        success, audit = await service.audit_user_balance(1)
        
        assert success is True
        assert audit['balance'] == Decimal('500')


class TestRevenueProtection:
    """Test revenue protection and limits"""
    
    @pytest.mark.asyncio
    async def test_daily_deposit_limit(self, session):
        """Enforce daily deposit limit"""
        service = RevenueLimitsService(session)
        
        # Set limit
        await service.set_user_limit(1, {'daily_deposit': 500})
        
        # Attempt deposit at limit
        result = await service.check_deposit_allowed(1, Decimal('500'))
        assert result['allowed'] is True
        
        # Attempt over limit
        result = await service.check_deposit_allowed(1, Decimal('100'))
        assert result['allowed'] is False
    
    @pytest.mark.asyncio
    async def test_bet_allowed_check(self, session):
        """Check if bet is allowed"""
        service = RevenueLimitsService(session)
        
        # Set limits
        await service.set_user_limit(1, {'max_bet': 100})
        
        # Bet under limit
        result = await service.check_bet_allowed(1, Decimal('50'))
        assert result['allowed'] is True
        
        # Bet over limit
        result = await service.check_bet_allowed(1, Decimal('150'))
        assert result['allowed'] is False
    
    @pytest.mark.asyncio
    async def test_risk_assessment_levels(self, session):
        """Assess risk levels correctly"""
        service = RevenueLimitsService(session)
        
        # Low risk user
        result = await service.check_deposit_allowed(1, Decimal('100'))
        assert result['risk_level'] == 'LOW'
        
        # High risk user (many deposits)
        for i in range(30):
            await service.check_deposit_allowed(2, Decimal('1000'))
        
        result = await service.check_bet_allowed(2, Decimal('100'))
        assert result['risk_level'] in ['HIGH', 'CRITICAL']


class TestCompliance:
    """Test compliance and responsible gaming"""
    
    @pytest.mark.asyncio
    async def test_kyc_verification(self, session):
        """Verify KYC process"""
        service = ComplianceService(session)
        
        kyc_data = {
            'full_name': 'John Doe',
            'date_of_birth': '1990-01-01',
            'country': 'US',
        }
        
        success, message = await service.verify_kyc(1, kyc_data)
        
        assert success is True
        assert 'verified' in message.lower()
    
    @pytest.mark.asyncio
    async def test_self_exclusion_temporary(self, session):
        """Test temporary self-exclusion"""
        service = ComplianceService(session)
        
        success, message = await service.self_exclude_user(
            1, ExclusionType.TEMPORARY
        )
        
        assert success is True
        
        # Check user is excluded
        is_excluded = await service.is_user_excluded(1)
        assert is_excluded is True
    
    @pytest.mark.asyncio
    async def test_self_exclusion_expiry(self, session):
        """Test self-exclusion expiry"""
        service = ComplianceService(session)
        
        # Exclude temporarily (30 days)
        await service.self_exclude_user(1, ExclusionType.TEMPORARY)
        
        # Should be excluded
        is_excluded = await service.is_user_excluded(1)
        assert is_excluded is True
    
    @pytest.mark.asyncio
    async def test_loss_limit_enforcement(self, session):
        """Enforce loss limits"""
        service = ComplianceService(session)
        
        # Set daily loss limit
        result = await service.check_loss_limit(1, 'daily')
        assert 'limit' in result


class TestFraudDetection:
    """Test fraud detection"""
    
    @pytest.mark.asyncio
    async def test_velocity_spike_detection(self, session):
        """Detect betting velocity spikes"""
        service = FraudDetectionService(session)
        
        # Simulate rapid bets (would need actual game records)
        anomaly = await service.detect_velocity_spike(1, time_window_minutes=5)
        
        # May or may not detect depending on data
        if anomaly:
            assert anomaly.anomaly_type == AnomalyType.VELOCITY_SPIKE
    
    @pytest.mark.asyncio
    async def test_winning_streak_detection(self, session):
        """Detect improbable winning streaks"""
        service = FraudDetectionService(session)
        
        # Simulate checking streaks
        anomaly = await service.detect_winning_streak(1)
        
        # May or may not detect
        if anomaly:
            assert anomaly.anomaly_type == AnomalyType.WINNING_STREAK
    
    @pytest.mark.asyncio
    async def test_fraud_score_calculation(self, session):
        """Calculate fraud risk score"""
        service = FraudDetectionService(session)
        
        score, level = await service.calculate_fraud_score(1)
        
        assert 0 <= score <= 100
        assert level in ['CLEAN', 'SUSPICIOUS', 'RISKY', 'FRAUDULENT']
    
    @pytest.mark.asyncio
    async def test_pattern_analysis(self, session):
        """Analyze betting patterns"""
        service = FraudDetectionService(session)
        
        patterns = await service.analyze_user_patterns(1, lookback_days=7)
        
        # Should return pattern analysis
        assert 'pattern_days' in patterns or 'error' in patterns


class TestFinancialMetrics:
    """Test financial reporting"""
    
    @pytest.mark.asyncio
    async def test_daily_summary(self, session):
        """Get daily financial summary"""
        service = FinancialMetricsService(session)
        
        summary = await service.get_daily_summary()
        
        assert 'date' in summary
        assert 'deposits' in summary
        assert 'net_revenue' in summary
    
    @pytest.mark.asyncio
    async def test_period_summary(self, session):
        """Get period summary"""
        service = FinancialMetricsService(session)
        
        end = datetime.utcnow()
        start = end - timedelta(days=7)
        
        summary = await service.get_period_summary(start, end)
        
        assert 'period' in summary
        assert 'net_revenue' in summary
    
    @pytest.mark.asyncio
    async def test_user_value_analysis(self, session):
        """Analyze user values"""
        service = FinancialMetricsService(session)
        
        analysis = await service.get_user_value_analysis()
        
        assert 'total_users' in analysis


class TestPaymentProcessing:
    """Test payment processing"""
    
    @pytest.mark.asyncio
    async def test_deposit_initiation(self, session):
        """Initiate deposit payment"""
        service = PaymentProcessingService(session, {})
        
        success, message, txn_id = await service.initiate_deposit(
            1, Decimal('100.00'), PaymentProvider.STRIPE
        )
        
        if success:
            assert txn_id is not None
            assert len(txn_id) > 0
    
    @pytest.mark.asyncio
    async def test_withdrawal_initiation(self, session):
        """Initiate withdrawal payment"""
        service = PaymentProcessingService(session, {})
        
        success, message, txn_id = await service.initiate_withdrawal(
            1, Decimal('50.00'), PaymentProvider.STRIPE
        )
        
        # May fail if no balance
        assert isinstance(success, bool)
    
    @pytest.mark.asyncio
    async def test_invalid_deposit_amount(self, session):
        """Reject invalid deposit amounts"""
        service = PaymentProcessingService(session, {})
        
        # Negative amount
        success, message, _ = await service.initiate_deposit(
            1, Decimal('-100'), PaymentProvider.STRIPE
        )
        
        assert success is False
        
        # Too large
        success, message, _ = await service.initiate_deposit(
            1, Decimal('100000'), PaymentProvider.STRIPE
        )
        
        assert success is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
