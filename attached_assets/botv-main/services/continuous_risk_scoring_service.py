from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from decimal import Decimal
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class RiskRecommendation(str, Enum):
    ALLOW = "allow"
    MONITOR = "monitor"
    RESTRICT = "restrict"
    BLOCK = "block"

@dataclass
class RiskScoreBreakdown:
    overall_score: int
    transaction_risk: int
    fraud_risk: int
    compliance_risk: int
    behavior_risk: int
    recommendation: RiskRecommendation
    level: RiskLevel

@dataclass
class RiskResponse:
    user_id: int
    risk_level: RiskLevel
    score: int
    actions_taken: List[str]
    escalation_reason: Optional[str]
    triggered_at: datetime

class ContinuousRiskScoringService:
    def __init__(self, session_maker):
        self.session_maker = session_maker
        self.thresholds = {
            "transaction_risk": {
                "low": (0, 20),
                "medium": (21, 50),
                "high": (51, 75),
                "critical": (76, 100)
            },
            "fraud_risk": {
                "low": (0, 20),
                "medium": (21, 50),
                "high": (51, 75),
                "critical": (76, 100)
            },
            "compliance_risk": {
                "low": (0, 15),
                "medium": (16, 40),
                "high": (41, 70),
                "critical": (71, 100)
            },
            "behavior_risk": {
                "low": (0, 25),
                "medium": (26, 55),
                "high": (56, 80),
                "critical": (81, 100)
            }
        }
        self.recommendation_threshold = {
            "allow": (0, 25),
            "monitor": (26, 50),
            "restrict": (51, 75),
            "block": (76, 100)
        }

    async def calculate_transaction_risk(
        self,
        session: AsyncSession,
        user_id: int
    ) -> int:
        try:
            from models import Transaction, TransactionStatus
            
            now = datetime.utcnow()
            one_hour_ago = now - timedelta(hours=1)
            
            transaction_count = await session.execute(
                select(func.count(Transaction.id)).where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.created_at >= one_hour_ago
                    )
                )
            )
            count = transaction_count.scalar() or 0
            
            failed_result = await session.execute(
                select(func.count(Transaction.id)).where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.created_at >= one_hour_ago,
                        Transaction.status == TransactionStatus.FAILED
                    )
                )
            )
            failed = failed_result.scalar() or 0
            
            error_rate = (Decimal(failed) / Decimal(count) * Decimal("100")) if count > 0 else Decimal("0")
            
            frequent_transactions = 1 if count > 50 else 0
            high_failure_rate = 1 if error_rate > Decimal("20") else 0
            
            risk_score = min(
                int(error_rate) + (frequent_transactions * 10) + (high_failure_rate * 20),
                100
            )
            
            return risk_score
        except Exception as e:
            logger.error(f"Error calculating transaction risk: {str(e)}")
            return 0

    async def calculate_fraud_risk(
        self,
        session: AsyncSession,
        user_id: int
    ) -> int:
        try:
            from models import FraudFlag
            
            now = datetime.utcnow()
            one_hour_ago = now - timedelta(hours=1)
            seven_days_ago = now - timedelta(days=7)
            
            recent_flags = await session.execute(
                select(func.count(FraudFlag.id)).where(
                    and_(
                        FraudFlag.user_id == user_id,
                        FraudFlag.created_at >= one_hour_ago
                    )
                )
            )
            recent = recent_flags.scalar() or 0
            
            recent_critical = await session.execute(
                select(func.count(FraudFlag.id)).where(
                    and_(
                        FraudFlag.user_id == user_id,
                        FraudFlag.created_at >= one_hour_ago,
                        FraudFlag.score >= Decimal("75")
                    )
                )
            )
            critical = recent_critical.scalar() or 0
            
            week_flags = await session.execute(
                select(func.count(FraudFlag.id)).where(
                    and_(
                        FraudFlag.user_id == user_id,
                        FraudFlag.created_at >= seven_days_ago
                    )
                )
            )
            week_total = week_flags.scalar() or 0
            
            avg_score_result = await session.execute(
                select(func.avg(FraudFlag.score)).where(
                    FraudFlag.user_id == user_id
                )
            )
            avg_score = Decimal(avg_score_result.scalar() or 0)
            
            has_recent = 1 if recent > 0 else 0
            has_critical = 1 if critical > 0 else 0
            pattern_detected = 1 if week_total > 5 else 0
            
            risk_score = min(
                (recent * 5) + (critical * 30) + (has_recent * 10) + 
                (has_critical * 20) + (pattern_detected * 15) + int(avg_score / 2),
                100
            )
            
            return risk_score
        except Exception as e:
            logger.error(f"Error calculating fraud risk: {str(e)}")
            return 0

    async def calculate_compliance_risk(
        self,
        session: AsyncSession,
        user_id: int
    ) -> int:
        try:
            from models import ComplianceEvent
            
            now = datetime.utcnow()
            
            kyc_status = await session.execute(
                select(ComplianceEvent).where(
                    and_(
                        ComplianceEvent.user_id == user_id,
                        ComplianceEvent.event_type.in_([
                            "kyc_verified",
                            "kyc_failed"
                        ])
                    )
                ).order_by(ComplianceEvent.created_at.desc()).limit(1)
            )
            last_kyc = kyc_status.scalar_one_or_none()
            
            aml_flags = await session.execute(
                select(func.count(ComplianceEvent.id)).where(
                    and_(
                        ComplianceEvent.user_id == user_id,
                        ComplianceEvent.event_type == "aml_flagged"
                    )
                )
            )
            aml_count = aml_flags.scalar() or 0
            
            self_excluded = await session.execute(
                select(func.count(ComplianceEvent.id)).where(
                    and_(
                        ComplianceEvent.user_id == user_id,
                        ComplianceEvent.event_type == "self_excluded"
                    )
                )
            )
            excluded = self_excluded.scalar() or 0
            
            kyc_failed = 1 if last_kyc and last_kyc.event_type == "kyc_failed" else 0
            kyc_missing = 1 if not last_kyc else 0
            has_aml = 1 if aml_count > 0 else 0
            is_excluded = 1 if excluded > 0 else 0
            
            risk_score = min(
                (kyc_failed * 40) + (kyc_missing * 30) + (has_aml * 50) + 
                (is_excluded * 100) + (aml_count * 10),
                100
            )
            
            return risk_score
        except Exception as e:
            logger.error(f"Error calculating compliance risk: {str(e)}")
            return 0

    async def calculate_behavior_risk(
        self,
        session: AsyncSession,
        user_id: int
    ) -> int:
        try:
            from models import User, GameResult
            
            now = datetime.utcnow()
            one_day_ago = now - timedelta(days=1)
            seven_days_ago = now - timedelta(days=7)
            
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user:
                return 0
            
            session_count = await session.execute(
                select(func.count(GameResult.id)).where(
                    and_(
                        GameResult.user_id == user_id,
                        GameResult.created_at >= one_day_ago
                    )
                )
            )
            sessions = session_count.scalar() or 0
            
            total_bets = await session.execute(
                select(func.sum(GameResult.bet_amount)).where(
                    and_(
                        GameResult.user_id == user_id,
                        GameResult.created_at >= seven_days_ago
                    )
                )
            )
            bets = Decimal(total_bets.scalar() or 0)
            
            new_account = 1 if user.created_at >= (now - timedelta(days=7)) else 0
            high_activity = 1 if sessions > 100 else 0
            rapid_escalation = 1 if sessions > 500 and new_account else 0
            
            risk_score = min(
                (new_account * 20) + (high_activity * 15) + (rapid_escalation * 40),
                100
            )
            
            return risk_score
        except Exception as e:
            logger.error(f"Error calculating behavior risk: {str(e)}")
            return 0

    async def calculate_overall_risk(
        self,
        session: AsyncSession,
        user_id: int
    ) -> RiskScoreBreakdown:
        try:
            transaction_risk = await self.calculate_transaction_risk(session, user_id)
            fraud_risk = await self.calculate_fraud_risk(session, user_id)
            compliance_risk = await self.calculate_compliance_risk(session, user_id)
            behavior_risk = await self.calculate_behavior_risk(session, user_id)
            
            overall_score = int(
                (transaction_risk * 0.2) +
                (fraud_risk * 0.3) +
                (compliance_risk * 0.35) +
                (behavior_risk * 0.15)
            )
            
            if overall_score >= 76:
                recommendation = RiskRecommendation.BLOCK
                level = RiskLevel.CRITICAL
            elif overall_score >= 51:
                recommendation = RiskRecommendation.RESTRICT
                level = RiskLevel.HIGH
            elif overall_score >= 26:
                recommendation = RiskRecommendation.MONITOR
                level = RiskLevel.MEDIUM
            else:
                recommendation = RiskRecommendation.ALLOW
                level = RiskLevel.LOW
            
            return RiskScoreBreakdown(
                overall_score=overall_score,
                transaction_risk=transaction_risk,
                fraud_risk=fraud_risk,
                compliance_risk=compliance_risk,
                behavior_risk=behavior_risk,
                recommendation=recommendation,
                level=level
            )
        except Exception as e:
            logger.error(f"Error calculating overall risk: {str(e)}")
            return RiskScoreBreakdown(
                overall_score=0,
                transaction_risk=0,
                fraud_risk=0,
                compliance_risk=0,
                behavior_risk=0,
                recommendation=RiskRecommendation.ALLOW,
                level=RiskLevel.LOW
            )

    async def log_risk_score(
        self,
        session: AsyncSession,
        user_id: int,
        breakdown: RiskScoreBreakdown
    ) -> bool:
        try:
            from models import RiskScoreHistory
            
            history = RiskScoreHistory(
                user_id=user_id,
                overall_score=breakdown.overall_score,
                transaction_risk=breakdown.transaction_risk,
                fraud_risk=breakdown.fraud_risk,
                compliance_risk=breakdown.compliance_risk,
                recommendation=breakdown.recommendation.value,
                calculated_at=datetime.utcnow()
            )
            
            session.add(history)
            await session.commit()
            return True
        except Exception as e:
            logger.error(f"Error logging risk score: {str(e)}")
            return False

    async def trigger_response(
        self,
        session: AsyncSession,
        user_id: int,
        breakdown: RiskScoreBreakdown
    ) -> RiskResponse:
        try:
            from models import User, RevenueLimits, ComplianceEvent
            
            actions = []
            escalation_reason = None
            
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user:
                return RiskResponse(
                    user_id=user_id,
                    risk_level=breakdown.level,
                    score=breakdown.overall_score,
                    actions_taken=[],
                    escalation_reason="User not found",
                    triggered_at=datetime.utcnow()
                )
            
            if breakdown.recommendation == RiskRecommendation.BLOCK:
                user.is_suspended = True
                actions.append("account_suspended")
                escalation_reason = f"Critical risk score {breakdown.overall_score}"
            
            elif breakdown.recommendation == RiskRecommendation.RESTRICT:
                limits_result = await session.execute(
                    select(RevenueLimits).where(
                        RevenueLimits.user_id == user_id
                    ).order_by(RevenueLimits.created_at.desc()).limit(1)
                )
                current_limit = limits_result.scalar_one_or_none()
                
                if current_limit:
                    current_limit.daily_bet_limit = current_limit.daily_bet_limit / 2
                    current_limit.weekly_bet_limit = current_limit.weekly_bet_limit / 2
                    actions.append("betting_limits_reduced")
                
                escalation_reason = f"High risk score {breakdown.overall_score}"
            
            elif breakdown.recommendation == RiskRecommendation.MONITOR:
                actions.append("enhanced_monitoring_enabled")
            
            await session.commit()
            
            await self.log_risk_score(session, user_id, breakdown)
            
            return RiskResponse(
                user_id=user_id,
                risk_level=breakdown.level,
                score=breakdown.overall_score,
                actions_taken=actions,
                escalation_reason=escalation_reason,
                triggered_at=datetime.utcnow()
            )
        except Exception as e:
            logger.error(f"Error triggering response: {str(e)}")
            return RiskResponse(
                user_id=user_id,
                risk_level=breakdown.level,
                score=breakdown.overall_score,
                actions_taken=[],
                escalation_reason=f"Error: {str(e)}",
                triggered_at=datetime.utcnow()
            )

    async def get_risk_trend(
        self,
        session: AsyncSession,
        user_id: int,
        days: int = 30
    ) -> List[Dict]:
        try:
            from models import RiskScoreHistory
            
            cutoff = datetime.utcnow() - timedelta(days=days)
            
            result = await session.execute(
                select(RiskScoreHistory).where(
                    and_(
                        RiskScoreHistory.user_id == user_id,
                        RiskScoreHistory.calculated_at >= cutoff
                    )
                ).order_by(RiskScoreHistory.calculated_at)
            )
            
            scores = result.scalars().all()
            return [
                {
                    "timestamp": score.calculated_at.isoformat(),
                    "overall_score": score.overall_score,
                    "transaction_risk": score.transaction_risk,
                    "fraud_risk": score.fraud_risk,
                    "compliance_risk": score.compliance_risk,
                    "recommendation": score.recommendation
                }
                for score in scores
            ]
        except Exception as e:
            logger.error(f"Error getting risk trend: {str(e)}")
            return []

    async def bulk_score_users(
        self,
        session: AsyncSession,
        user_ids: List[int] = None
    ) -> Dict[int, RiskScoreBreakdown]:
        try:
            from models import User
            
            if not user_ids:
                result = await session.execute(select(User.id))
                user_ids = [row[0] for row in result.all()]
            
            scores = {}
            for user_id in user_ids:
                breakdown = await self.calculate_overall_risk(session, user_id)
                scores[user_id] = breakdown
                await self.log_risk_score(session, user_id, breakdown)
            
            return scores
        except Exception as e:
            logger.error(f"Error bulk scoring users: {str(e)}")
            return {}
