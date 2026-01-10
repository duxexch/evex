import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from services.user_behavior_analytics_service import (
    UserBehaviorAnalyticsService,
    UserCohort,
    ChurnRisk
)

class TestUserBehaviorAnalyticsService:
    
    @pytest.fixture
    async def service(self, session_maker):
        return UserBehaviorAnalyticsService(session_maker)
    
    @pytest.mark.asyncio
    async def test_analyze_user_behavior(self, service, session: AsyncSession):
        profile = await service.analyze_user_behavior(session, 1)
        assert profile is not None
        assert profile.user_id == 1
        assert profile.cohort in UserCohort
        assert 0 <= profile.engagement_score <= 100
    
    @pytest.mark.asyncio
    async def test_behavior_profile_structure(self, service, session: AsyncSession):
        profile = await service.analyze_user_behavior(session, 1)
        assert hasattr(profile, 'user_id')
        assert hasattr(profile, 'cohort')
        assert hasattr(profile, 'lifetime_value')
        assert hasattr(profile, 'engagement_score')
        assert hasattr(profile, 'win_rate')
    
    @pytest.mark.asyncio
    async def test_predict_churn(self, service, session: AsyncSession):
        prediction = await service.predict_churn(session, 1)
        assert prediction is not None
        assert prediction.user_id == 1
        assert prediction.risk_level in ChurnRisk
        assert 0.0 <= prediction.probability <= 1.0
    
    @pytest.mark.asyncio
    async def test_churn_factors_and_actions(self, service, session: AsyncSession):
        prediction = await service.predict_churn(session, 1)
        assert isinstance(prediction.contributing_factors, list)
        assert isinstance(prediction.recommended_actions, list)
    
    @pytest.mark.asyncio
    async def test_analyze_cohorts(self, service, session: AsyncSession):
        cohorts = await service.analyze_cohorts(session)
        assert isinstance(cohorts, dict)
        assert len(cohorts) >= 0
    
    @pytest.mark.asyncio
    async def test_get_behavioral_segments(self, service, session: AsyncSession):
        segments = await service.get_behavioral_segments(session)
        assert isinstance(segments, dict)
        assert "high_value" in segments
        assert "at_risk" in segments
        assert "new_users" in segments
        assert "dormant" in segments
        assert "engaged" in segments
    
    @pytest.mark.asyncio
    async def test_calculate_lifetime_value(self, service, session: AsyncSession):
        ltv = await service.calculate_lifetime_value(session, 1)
        assert isinstance(ltv, Decimal)
        assert ltv >= 0

class TestCohortClassification:
    
    @pytest.fixture
    async def service(self, session_maker):
        return UserBehaviorAnalyticsService(session_maker)
    
    def test_classify_dormant(self, service):
        cohort = service._classify_cohort(
            sessions=0,
            total_bets=Decimal("100"),
            days_since_login=60,
            retention_days=90
        )
        assert cohort == UserCohort.DORMANT
    
    def test_classify_whale(self, service):
        cohort = service._classify_cohort(
            sessions=500,
            total_bets=Decimal("15000"),
            days_since_login=5,
            retention_days=60
        )
        assert cohort == UserCohort.WHALE
    
    def test_classify_high_activity(self, service):
        cohort = service._classify_cohort(
            sessions=250,
            total_bets=Decimal("6000"),
            days_since_login=5,
            retention_days=60
        )
        assert cohort == UserCohort.HIGH_ACTIVITY
    
    def test_classify_moderate_activity(self, service):
        cohort = service._classify_cohort(
            sessions=100,
            total_bets=Decimal("2000"),
            days_since_login=10,
            retention_days=45
        )
        assert cohort == UserCohort.MODERATE_ACTIVITY
    
    def test_classify_low_activity(self, service):
        cohort = service._classify_cohort(
            sessions=10,
            total_bets=Decimal("200"),
            days_since_login=5,
            retention_days=30
        )
        assert cohort == UserCohort.LOW_ACTIVITY

class TestChurnPrediction:
    
    @pytest.fixture
    async def service(self, session_maker):
        return UserBehaviorAnalyticsService(session_maker)
    
    @pytest.mark.asyncio
    async def test_churn_low_risk(self, service, session: AsyncSession):
        prediction = await service.predict_churn(session, 1)
        if prediction.probability < 0.3:
            assert prediction.risk_level == ChurnRisk.LOW
    
    @pytest.mark.asyncio
    async def test_churn_critical_risk(self, service, session: AsyncSession):
        prediction = await service.predict_churn(session, 1)
        if prediction.probability > 0.7:
            assert prediction.risk_level == ChurnRisk.CRITICAL
    
    def test_retention_action_recommendations(self, service):
        from services.user_behavior_analytics_service import UserBehaviorProfile
        
        profile = UserBehaviorProfile(
            user_id=1,
            cohort=UserCohort.LOW_ACTIVITY,
            lifetime_value=Decimal("500"),
            churn_risk=ChurnRisk.HIGH,
            churn_probability=0.6,
            engagement_score=20,
            retention_days=45,
            avg_session_duration=300,
            total_bets=Decimal("1000"),
            win_rate=35.0,
            days_since_login=20,
            activity_trend="declining"
        )
        
        factors = ["declining_trend", "low_win_rate"]
        actions = service._recommend_retention_actions(factors, profile)
        assert len(actions) > 0
        assert any("bonus" in action for action in actions)

class TestBehaviorSegmentation:
    
    @pytest.fixture
    async def service(self, session_maker):
        return UserBehaviorAnalyticsService(session_maker)
    
    @pytest.mark.asyncio
    async def test_high_value_segment(self, service, session: AsyncSession):
        segments = await service.get_behavioral_segments(session)
        high_value = segments.get("high_value", [])
        assert isinstance(high_value, list)
    
    @pytest.mark.asyncio
    async def test_at_risk_segment(self, service, session: AsyncSession):
        segments = await service.get_behavioral_segments(session)
        at_risk = segments.get("at_risk", [])
        assert isinstance(at_risk, list)
    
    @pytest.mark.asyncio
    async def test_segment_variety(self, service, session: AsyncSession):
        segments = await service.get_behavioral_segments(session)
        assert len(segments) == 5
        assert all(isinstance(v, list) for v in segments.values())

class TestActivityTrendAnalysis:
    
    @pytest.fixture
    async def service(self, session_maker):
        return UserBehaviorAnalyticsService(session_maker)
    
    @pytest.mark.asyncio
    async def test_determine_activity_status(self, service, session: AsyncSession):
        status = await service._determine_activity_status(session, 1, 2)
        assert status in ["dormant", "inactive", "declining", "regular", "active"]
    
    @pytest.mark.asyncio
    async def test_determine_activity_trend(self, service, session: AsyncSession):
        trend = await service._determine_activity_trend(session, 1)
        assert trend in ["growing", "declining", "stable", "unknown"]

class TestLifetimeValueCalculation:
    
    @pytest.fixture
    async def service(self, session_maker):
        return UserBehaviorAnalyticsService(session_maker)
    
    @pytest.mark.asyncio
    async def test_ltv_non_negative(self, service, session: AsyncSession):
        ltv = await service.calculate_lifetime_value(session, 1)
        assert ltv >= 0
    
    @pytest.mark.asyncio
    async def test_ltv_type(self, service, session: AsyncSession):
        ltv = await service.calculate_lifetime_value(session, 1)
        assert isinstance(ltv, Decimal)
