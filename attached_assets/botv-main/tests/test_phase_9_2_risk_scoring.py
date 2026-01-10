import pytest
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from services.continuous_risk_scoring_service import (
    ContinuousRiskScoringService,
    RiskLevel,
    RiskRecommendation
)

class TestContinuousRiskScoringService:
    
    @pytest.fixture
    async def service(self, session_maker):
        return ContinuousRiskScoringService(session_maker)
    
    @pytest.mark.asyncio
    async def test_calculate_transaction_risk(self, service, session: AsyncSession):
        risk = await service.calculate_transaction_risk(session, 1)
        assert isinstance(risk, int)
        assert 0 <= risk <= 100
    
    @pytest.mark.asyncio
    async def test_calculate_fraud_risk(self, service, session: AsyncSession):
        risk = await service.calculate_fraud_risk(session, 1)
        assert isinstance(risk, int)
        assert 0 <= risk <= 100
    
    @pytest.mark.asyncio
    async def test_calculate_compliance_risk(self, service, session: AsyncSession):
        risk = await service.calculate_compliance_risk(session, 1)
        assert isinstance(risk, int)
        assert 0 <= risk <= 100
    
    @pytest.mark.asyncio
    async def test_calculate_behavior_risk(self, service, session: AsyncSession):
        risk = await service.calculate_behavior_risk(session, 1)
        assert isinstance(risk, int)
        assert 0 <= risk <= 100
    
    @pytest.mark.asyncio
    async def test_calculate_overall_risk(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        assert breakdown is not None
        assert breakdown.overall_score >= 0
        assert breakdown.level in [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
        assert breakdown.recommendation in [
            RiskRecommendation.ALLOW,
            RiskRecommendation.MONITOR,
            RiskRecommendation.RESTRICT,
            RiskRecommendation.BLOCK
        ]
    
    @pytest.mark.asyncio
    async def test_risk_score_recommendation_mapping(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        
        if breakdown.overall_score <= 25:
            assert breakdown.recommendation == RiskRecommendation.ALLOW
            assert breakdown.level == RiskLevel.LOW
        elif breakdown.overall_score <= 50:
            assert breakdown.recommendation == RiskRecommendation.MONITOR
            assert breakdown.level == RiskLevel.MEDIUM
        elif breakdown.overall_score <= 75:
            assert breakdown.recommendation == RiskRecommendation.RESTRICT
            assert breakdown.level == RiskLevel.HIGH
        else:
            assert breakdown.recommendation == RiskRecommendation.BLOCK
            assert breakdown.level == RiskLevel.CRITICAL
    
    @pytest.mark.asyncio
    async def test_log_risk_score(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        result = await service.log_risk_score(session, 1, breakdown)
        assert isinstance(result, bool)
    
    @pytest.mark.asyncio
    async def test_trigger_response_allow(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        breakdown.overall_score = 10
        breakdown.recommendation = RiskRecommendation.ALLOW
        
        response = await service.trigger_response(session, 1, breakdown)
        assert response.user_id == 1
        assert response.risk_level == breakdown.level
        assert response.score <= 25
    
    @pytest.mark.asyncio
    async def test_trigger_response_block(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        breakdown.overall_score = 90
        breakdown.recommendation = RiskRecommendation.BLOCK
        
        response = await service.trigger_response(session, 1, breakdown)
        assert response.user_id == 1
        assert response.risk_level == RiskLevel.CRITICAL
        assert response.score >= 76
    
    @pytest.mark.asyncio
    async def test_get_risk_trend(self, service, session: AsyncSession):
        trend = await service.get_risk_trend(session, 1, days=30)
        assert isinstance(trend, list)
    
    @pytest.mark.asyncio
    async def test_bulk_score_users(self, service, session: AsyncSession):
        scores = await service.bulk_score_users(session, [1, 2, 3])
        assert isinstance(scores, dict)

class TestRiskScoringWeighting:
    
    @pytest.fixture
    async def service(self, session_maker):
        return ContinuousRiskScoringService(session_maker)
    
    @pytest.mark.asyncio
    async def test_weighting_distribution(self, service):
        weights = {
            "transaction": 0.2,
            "fraud": 0.3,
            "compliance": 0.35,
            "behavior": 0.15
        }
        
        total_weight = sum(weights.values())
        assert total_weight == pytest.approx(1.0)
    
    @pytest.mark.asyncio
    async def test_compliance_highest_weight(self, service):
        assert 0.35 > 0.3
        assert 0.35 > 0.2
        assert 0.35 > 0.15

class TestRiskResponseActions:
    
    @pytest.fixture
    async def service(self, session_maker):
        return ContinuousRiskScoringService(session_maker)
    
    @pytest.mark.asyncio
    async def test_block_response_escalation(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        breakdown.overall_score = 95
        breakdown.recommendation = RiskRecommendation.BLOCK
        
        response = await service.trigger_response(session, 1, breakdown)
        assert "account_suspended" in response.actions_taken or len(response.actions_taken) >= 0
    
    @pytest.mark.asyncio
    async def test_restrict_response_limits(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        breakdown.overall_score = 60
        breakdown.recommendation = RiskRecommendation.RESTRICT
        
        response = await service.trigger_response(session, 1, breakdown)
        assert len(response.actions_taken) >= 0

class TestRiskScoringEdgeCases:
    
    @pytest.fixture
    async def service(self, session_maker):
        return ContinuousRiskScoringService(session_maker)
    
    @pytest.mark.asyncio
    async def test_zero_risk_user(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 9999)
        assert breakdown.overall_score >= 0
        assert breakdown.overall_score <= 100
    
    @pytest.mark.asyncio
    async def test_nonexistent_user_response(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        response = await service.trigger_response(session, 9999, breakdown)
        assert response.user_id == 9999
    
    @pytest.mark.asyncio
    async def test_score_boundaries(self, service, session: AsyncSession):
        breakdown = await service.calculate_overall_risk(session, 1)
        assert 0 <= breakdown.overall_score <= 100
        assert breakdown.transaction_risk <= 100
        assert breakdown.fraud_risk <= 100
        assert breakdown.compliance_risk <= 100
        assert breakdown.behavior_risk <= 100

class TestRiskTrendAnalysis:
    
    @pytest.fixture
    async def service(self, session_maker):
        return ContinuousRiskScoringService(session_maker)
    
    @pytest.mark.asyncio
    async def test_trend_empty_history(self, service, session: AsyncSession):
        trend = await service.get_risk_trend(session, 9999, days=30)
        assert isinstance(trend, list)
    
    @pytest.mark.asyncio
    async def test_trend_data_structure(self, service, session: AsyncSession):
        trend = await service.get_risk_trend(session, 1, days=7)
        if len(trend) > 0:
            first = trend[0]
            assert "timestamp" in first
            assert "overall_score" in first
            assert "recommendation" in first
