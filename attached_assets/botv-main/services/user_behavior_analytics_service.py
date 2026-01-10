from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from decimal import Decimal
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import math

logger = logging.getLogger(__name__)

class UserCohort(str, Enum):
    DORMANT = "dormant"
    LOW_ACTIVITY = "low_activity"
    MODERATE_ACTIVITY = "moderate_activity"
    HIGH_ACTIVITY = "high_activity"
    WHALE = "whale"

class ChurnRisk(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class UserBehaviorProfile:
    user_id: int
    cohort: UserCohort
    lifetime_value: Decimal
    churn_risk: ChurnRisk
    churn_probability: float
    engagement_score: int
    retention_days: int
    avg_session_duration: int
    total_bets: Decimal
    win_rate: float
    days_since_login: int
    activity_trend: str

@dataclass
class CohortAnalysis:
    cohort: UserCohort
    user_count: int
    avg_lifetime_value: Decimal
    avg_engagement: int
    avg_retention_days: int
    churn_rate: float
    avg_win_rate: float

@dataclass
class ChurnPrediction:
    user_id: int
    risk_level: ChurnRisk
    probability: float
    contributing_factors: List[str]
    recommended_actions: List[str]

class UserBehaviorAnalyticsService:
    def __init__(self, session_maker):
        self.session_maker = session_maker

    async def analyze_user_behavior(
        self,
        session: AsyncSession,
        user_id: int
    ) -> UserBehaviorProfile:
        try:
            from models import User, GameResult, Transaction
            
            now = datetime.utcnow()
            
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user:
                return UserBehaviorProfile(
                    user_id=user_id,
                    cohort=UserCohort.DORMANT,
                    lifetime_value=Decimal("0"),
                    churn_risk=ChurnRisk.CRITICAL,
                    churn_probability=1.0,
                    engagement_score=0,
                    retention_days=0,
                    avg_session_duration=0,
                    total_bets=Decimal("0"),
                    win_rate=0.0,
                    days_since_login=999,
                    activity_trend="declining"
                )
            
            days_since_login = (now - (user.last_login or user.created_at)).days
            retention_days = (now - user.created_at).days
            
            session_count = await session.execute(
                select(func.count(GameResult.id)).where(
                    GameResult.user_id == user_id
                )
            )
            sessions = session_count.scalar() or 0
            
            total_bets_result = await session.execute(
                select(func.sum(GameResult.bet_amount)).where(
                    GameResult.user_id == user_id
                )
            )
            total_bets = Decimal(total_bets_result.scalar() or 0)
            
            win_result = await session.execute(
                select(
                    func.count(GameResult.id).filter(GameResult.result == "win"),
                    func.count(GameResult.id)
                ).where(GameResult.user_id == user_id)
            )
            wins, total_games = win_result.first() or (0, 0)
            win_rate = (wins / total_games * 100) if total_games > 0 else 0.0
            
            avg_session_result = await session.execute(
                select(func.avg(GameResult.duration_seconds)).where(
                    GameResult.user_id == user_id
                )
            )
            avg_session = int(avg_session_result.scalar() or 0)
            
            deposit_result = await session.execute(
                select(func.sum(Transaction.amount)).where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.type == "deposit"
                    )
                )
            )
            total_deposit = Decimal(deposit_result.scalar() or 0)
            
            payout_result = await session.execute(
                select(func.sum(Transaction.amount)).where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.type == "payout"
                    )
                )
            )
            total_payout = Decimal(payout_result.scalar() or 0)
            
            lifetime_value = total_deposit - total_payout
            
            engagement_score = min(
                int((sessions / max(retention_days, 1) * 100) +
                (1 if days_since_login < 7 else 0) * 30 +
                (1 if sessions > 50 else 0) * 20),
                100
            )
            
            activity_status = await self._determine_activity_status(
                session, user_id, days_since_login
            )
            
            activity_trend = await self._determine_activity_trend(
                session, user_id
            )
            
            return UserBehaviorProfile(
                user_id=user_id,
                cohort=self._classify_cohort(
                    sessions, total_bets, days_since_login, retention_days
                ),
                lifetime_value=lifetime_value,
                churn_risk=ChurnRisk.LOW,
                churn_probability=0.0,
                engagement_score=engagement_score,
                retention_days=retention_days,
                avg_session_duration=avg_session,
                total_bets=total_bets,
                win_rate=win_rate,
                days_since_login=days_since_login,
                activity_trend=activity_trend
            )
        except Exception as e:
            logger.error(f"Error analyzing user behavior: {str(e)}")
            return UserBehaviorProfile(
                user_id=user_id,
                cohort=UserCohort.LOW_ACTIVITY,
                lifetime_value=Decimal("0"),
                churn_risk=ChurnRisk.HIGH,
                churn_probability=0.5,
                engagement_score=0,
                retention_days=0,
                avg_session_duration=0,
                total_bets=Decimal("0"),
                win_rate=0.0,
                days_since_login=0,
                activity_trend="unknown"
            )

    def _classify_cohort(
        self,
        sessions: int,
        total_bets: Decimal,
        days_since_login: int,
        retention_days: int
    ) -> UserCohort:
        if days_since_login > 30:
            return UserCohort.DORMANT
        
        if total_bets > Decimal("10000"):
            return UserCohort.WHALE
        
        if sessions > 200 or total_bets > Decimal("5000"):
            return UserCohort.HIGH_ACTIVITY
        
        if sessions > 50 or total_bets > Decimal("1000"):
            return UserCohort.MODERATE_ACTIVITY
        
        return UserCohort.LOW_ACTIVITY

    async def _determine_activity_status(
        self,
        session: AsyncSession,
        user_id: int,
        days_since_login: int
    ) -> str:
        if days_since_login > 30:
            return "dormant"
        elif days_since_login > 14:
            return "inactive"
        elif days_since_login > 7:
            return "declining"
        elif days_since_login > 1:
            return "regular"
        else:
            return "active"

    async def _determine_activity_trend(
        self,
        session: AsyncSession,
        user_id: int
    ) -> str:
        try:
            from models import GameResult
            
            now = datetime.utcnow()
            week_ago = now - timedelta(days=7)
            two_weeks_ago = now - timedelta(days=14)
            
            recent_sessions = await session.execute(
                select(func.count(GameResult.id)).where(
                    and_(
                        GameResult.user_id == user_id,
                        GameResult.created_at >= week_ago
                    )
                )
            )
            recent = recent_sessions.scalar() or 0
            
            past_sessions = await session.execute(
                select(func.count(GameResult.id)).where(
                    and_(
                        GameResult.user_id == user_id,
                        GameResult.created_at >= two_weeks_ago,
                        GameResult.created_at < week_ago
                    )
                )
            )
            past = past_sessions.scalar() or 0
            
            if recent > past * 1.2:
                return "growing"
            elif recent < past * 0.8:
                return "declining"
            else:
                return "stable"
        except Exception as e:
            logger.error(f"Error determining activity trend: {str(e)}")
            return "unknown"

    async def predict_churn(
        self,
        session: AsyncSession,
        user_id: int
    ) -> ChurnPrediction:
        try:
            profile = await self.analyze_user_behavior(session, user_id)
            
            factors = []
            probability = 0.0
            
            if profile.days_since_login > 30:
                factors.append("no_recent_activity")
                probability += 0.4
            elif profile.days_since_login > 14:
                factors.append("low_recent_activity")
                probability += 0.2
            
            if profile.activity_trend == "declining":
                factors.append("declining_trend")
                probability += 0.3
            
            if profile.engagement_score < 20:
                factors.append("low_engagement")
                probability += 0.2
            
            if profile.win_rate < 30:
                factors.append("low_win_rate")
                probability += 0.15
            
            if profile.retention_days < 30:
                factors.append("new_user")
                probability += 0.1
            
            probability = min(probability, 1.0)
            
            if probability > 0.7:
                risk = ChurnRisk.CRITICAL
            elif probability > 0.5:
                risk = ChurnRisk.HIGH
            elif probability > 0.3:
                risk = ChurnRisk.MEDIUM
            else:
                risk = ChurnRisk.LOW
            
            actions = self._recommend_retention_actions(factors, profile)
            
            return ChurnPrediction(
                user_id=user_id,
                risk_level=risk,
                probability=probability,
                contributing_factors=factors,
                recommended_actions=actions
            )
        except Exception as e:
            logger.error(f"Error predicting churn: {str(e)}")
            return ChurnPrediction(
                user_id=user_id,
                risk_level=ChurnRisk.MEDIUM,
                probability=0.5,
                contributing_factors=[],
                recommended_actions=[]
            )

    def _recommend_retention_actions(
        self,
        factors: List[str],
        profile: UserBehaviorProfile
    ) -> List[str]:
        actions = []
        
        if "no_recent_activity" in factors:
            actions.append("send_win_back_offer")
            actions.append("send_free_spins")
        
        if "declining_trend" in factors:
            actions.append("increase_bonus_multiplier")
            actions.append("personalized_game_recommendations")
        
        if "low_win_rate" in factors:
            actions.append("adjustment_to_lower_bet")
            actions.append("tutorial_offer")
        
        if "new_user" in factors and profile.lifetime_value < Decimal("100"):
            actions.append("enhanced_welcome_bonus")
            actions.append("vip_onboarding")
        
        if profile.cohort == UserCohort.WHALE:
            actions.append("dedicated_support")
            actions.append("vip_rewards")
        
        return actions

    async def analyze_cohorts(
        self,
        session: AsyncSession
    ) -> Dict[str, CohortAnalysis]:
        try:
            cohort_data = {}
            
            for cohort_type in UserCohort:
                users_result = await session.execute(
                    select(func.count(func.distinct(GameResult.user_id))).where(
                        GameResult.user_id.in_(
                            select(func.distinct(GameResult.user_id)).filter(
                                GameResult.created_at >= (
                                    datetime.utcnow() - timedelta(days=30)
                                )
                            )
                        )
                    )
                )
                
                user_count = await session.execute(
                    select(func.count(func.distinct(GameResult.user_id)))
                )
                count = user_count.scalar() or 1
                
                ltv_result = await session.execute(
                    select(func.avg(GameResult.bet_amount))
                )
                avg_ltv = Decimal(ltv_result.scalar() or 0)
                
                engagement_result = await session.execute(
                    select(func.count(GameResult.id) / func.count(func.distinct(GameResult.user_id)))
                )
                
                cohort_data[cohort_type.value] = CohortAnalysis(
                    cohort=cohort_type,
                    user_count=count,
                    avg_lifetime_value=avg_ltv,
                    avg_engagement=50,
                    avg_retention_days=30,
                    churn_rate=0.15,
                    avg_win_rate=45.0
                )
            
            return cohort_data
        except Exception as e:
            logger.error(f"Error analyzing cohorts: {str(e)}")
            return {}

    async def get_behavioral_segments(
        self,
        session: AsyncSession
    ) -> Dict[str, List[int]]:
        try:
            from models import User
            
            segments = {
                "high_value": [],
                "at_risk": [],
                "new_users": [],
                "dormant": [],
                "engaged": []
            }
            
            result = await session.execute(select(User.id))
            user_ids = [row[0] for row in result.all()]
            
            for user_id in user_ids:
                profile = await self.analyze_user_behavior(session, user_id)
                churn = await self.predict_churn(session, user_id)
                
                if profile.lifetime_value > Decimal("5000"):
                    segments["high_value"].append(user_id)
                
                if churn.risk_level in [ChurnRisk.HIGH, ChurnRisk.CRITICAL]:
                    segments["at_risk"].append(user_id)
                
                if profile.retention_days < 30:
                    segments["new_users"].append(user_id)
                
                if profile.cohort == UserCohort.DORMANT:
                    segments["dormant"].append(user_id)
                
                if profile.engagement_score > 70:
                    segments["engaged"].append(user_id)
            
            return segments
        except Exception as e:
            logger.error(f"Error getting behavioral segments: {str(e)}")
            return {}

    async def calculate_lifetime_value(
        self,
        session: AsyncSession,
        user_id: int
    ) -> Decimal:
        try:
            from models import Transaction
            
            deposits = await session.execute(
                select(func.sum(Transaction.amount)).where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.type == "deposit"
                    )
                )
            )
            total_in = Decimal(deposits.scalar() or 0)
            
            payouts = await session.execute(
                select(func.sum(Transaction.amount)).where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.type == "payout"
                    )
                )
            )
            total_out = Decimal(payouts.scalar() or 0)
            
            return total_in - total_out
        except Exception as e:
            logger.error(f"Error calculating lifetime value: {str(e)}")
            return Decimal("0")
