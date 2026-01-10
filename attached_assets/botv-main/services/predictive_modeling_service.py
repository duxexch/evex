import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.audit_log_service import AuditLogService

logger = logging.getLogger(__name__)


class PlayerValueTier(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VIP = "vip"


@dataclass
class LTVForecast:
    user_id: int
    horizon_days: int
    predicted_ltv: Decimal
    lower_bound: Decimal
    upper_bound: Decimal


@dataclass
class RevenueForecast:
    horizon_days: int
    projected_net: Decimal
    daily_projection: List[Decimal]


@dataclass
class PlayerValuePrediction:
    user_id: int
    tier: PlayerValueTier
    expected_monthly_value: Decimal
    win_rate: float
    net_gain: Decimal


@dataclass
class EngagementForecast:
    user_id: int
    horizon_days: int
    predicted_sessions: int
    avg_daily_sessions: float


@dataclass
class GlobalInsight:
    revenue_forecast: RevenueForecast
    top_value_users: List[int]
    at_risk_users: List[int]
    engagement_hotspots: Dict[str, int]


class PredictiveModelingService:
    def __init__(self, session_maker=None):
        self.session_maker = session_maker

    async def forecast_user_ltv(
        self,
        session: AsyncSession,
        user_id: int,
        horizon_days: int = 90,
    ) -> LTVForecast:
        try:
            from models import Transaction

            horizon = max(7, min(horizon_days, 365))
            now = datetime.utcnow()
            window_start = now - timedelta(days=30)

            deposit_types = ["CREDIT", "credit", "deposit", "DEPOSIT"]
            withdrawal_types = ["DEBIT", "debit", "withdrawal", "payout", "PAYOUT"]

            deposits_result = await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user_id,
                    Transaction.type.in_(deposit_types),
                )
            )
            withdrawals_result = await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user_id,
                    Transaction.type.in_(withdrawal_types),
                )
            )

            window_net_result = await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user_id,
                    Transaction.created_at >= window_start,
                    or_(
                        Transaction.type.in_(deposit_types),
                        Transaction.type.in_(withdrawal_types),
                    ),
                )
            )

            total_deposits = Decimal(deposits_result.scalar() or 0)
            total_withdrawals = Decimal(withdrawals_result.scalar() or 0)
            lifetime_value = total_deposits - total_withdrawals

            window_net = Decimal(window_net_result.scalar() or 0)
            daily_net = window_net / Decimal(30)
            forecast_increment = daily_net * Decimal(horizon)

            predicted = lifetime_value + forecast_increment
            lower = predicted * Decimal("0.9")
            upper = predicted * Decimal("1.1")

            return LTVForecast(
                user_id=user_id,
                horizon_days=horizon,
                predicted_ltv=predicted,
                lower_bound=lower,
                upper_bound=upper,
            )
        except Exception as exc:
            logger.error(f"LTV forecast error: {exc}")
            return LTVForecast(
                user_id=user_id,
                horizon_days=horizon_days,
                predicted_ltv=Decimal(0),
                lower_bound=Decimal(0),
                upper_bound=Decimal(0),
            )

    async def forecast_revenue(
        self,
        session: AsyncSession,
        horizon_days: int = 30,
    ) -> RevenueForecast:
        try:
            from models import Transaction

            horizon = max(7, min(horizon_days, 365))
            now = datetime.utcnow()
            window_start = now - timedelta(days=30)

            revenue_result = await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.created_at >= window_start
                )
            )

            window_total = Decimal(revenue_result.scalar() or 0)
            daily_avg = window_total / Decimal(30)
            projected_net = daily_avg * Decimal(horizon)
            daily_projection = [daily_avg for _ in range(horizon)]

            return RevenueForecast(
                horizon_days=horizon,
                projected_net=projected_net,
                daily_projection=daily_projection,
            )
        except Exception as exc:
            logger.error(f"Revenue forecast error: {exc}")
            return RevenueForecast(horizon_days=horizon_days, projected_net=Decimal(0), daily_projection=[])

    async def predict_player_value(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> PlayerValuePrediction:
        try:
            from models import GameRound

            now = datetime.utcnow()
            window_start = now - timedelta(days=30)

            bets_result = await session.execute(
                select(func.coalesce(func.sum(GameRound.bet_amount), 0)).where(
                    GameRound.user_id == user_id,
                    GameRound.created_at >= window_start,
                )
            )
            payout_result = await session.execute(
                select(func.coalesce(func.sum(GameRound.payout_amount), 0)).where(
                    GameRound.user_id == user_id,
                    GameRound.created_at >= window_start,
                )
            )
            win_result = await session.execute(
                select(
                    func.count(GameRound.id).filter(GameRound.result == "WIN"),
                    func.count(GameRound.id),
                ).where(
                    GameRound.user_id == user_id,
                    GameRound.created_at >= window_start,
                )
            )

            total_bets = Decimal(bets_result.scalar() or 0)
            total_payout = Decimal(payout_result.scalar() or 0)
            wins, total_games = win_result.first() or (0, 0)
            win_rate = float((wins / total_games) * 100) if total_games else 0.0
            net_gain = total_bets - total_payout

            tier = PlayerValueTier.LOW
            if total_bets >= Decimal("10000"):
                tier = PlayerValueTier.VIP
            elif total_bets >= Decimal("5000"):
                tier = PlayerValueTier.HIGH
            elif total_bets >= Decimal("1000"):
                tier = PlayerValueTier.MEDIUM

            expected_monthly_value = max(net_gain, Decimal(0)) + (total_bets * Decimal("0.05"))

            return PlayerValuePrediction(
                user_id=user_id,
                tier=tier,
                expected_monthly_value=expected_monthly_value,
                win_rate=win_rate,
                net_gain=net_gain,
            )
        except Exception as exc:
            logger.error(f"Player value prediction error: {exc}")
            return PlayerValuePrediction(
                user_id=user_id,
                tier=PlayerValueTier.LOW,
                expected_monthly_value=Decimal(0),
                win_rate=0.0,
                net_gain=Decimal(0),
            )

    async def forecast_engagement(
        self,
        session: AsyncSession,
        user_id: int,
        horizon_days: int = 14,
    ) -> EngagementForecast:
        try:
            from models import GameRound

            horizon = max(3, min(horizon_days, 90))
            now = datetime.utcnow()
            week_ago = now - timedelta(days=7)

            session_result = await session.execute(
                select(func.count(GameRound.id)).where(
                    GameRound.user_id == user_id,
                    GameRound.created_at >= week_ago,
                )
            )
            sessions_last_week = int(session_result.scalar() or 0)
            avg_daily = sessions_last_week / 7 if sessions_last_week else 0
            predicted_sessions = int(avg_daily * horizon)

            return EngagementForecast(
                user_id=user_id,
                horizon_days=horizon,
                predicted_sessions=predicted_sessions,
                avg_daily_sessions=avg_daily,
            )
        except Exception as exc:
            logger.error(f"Engagement forecast error: {exc}")
            return EngagementForecast(
                user_id=user_id,
                horizon_days=horizon_days,
                predicted_sessions=0,
                avg_daily_sessions=0,
            )

    async def generate_global_insights(
        self,
        session: AsyncSession,
        horizon_days: int = 30,
        top_n: int = 10,
    ) -> GlobalInsight:
        revenue_forecast = await self.forecast_revenue(session, horizon_days)

        from models import GameRound

        now = datetime.utcnow()
        window_start = now - timedelta(days=30)

        top_users_result = await session.execute(
            select(GameRound.user_id, func.sum(GameRound.bet_amount).label("bet_total"))
            .where(GameRound.created_at >= window_start)
            .group_by(GameRound.user_id)
            .order_by(func.sum(GameRound.bet_amount).desc())
            .limit(top_n)
        )
        top_users = [row[0] for row in top_users_result.fetchall()]

        dormant_result = await session.execute(
            select(GameRound.user_id, func.max(GameRound.created_at))
            .group_by(GameRound.user_id)
            .having(func.max(GameRound.created_at) < window_start)
            .limit(top_n)
        )
        at_risk_users = [row[0] for row in dormant_result.fetchall()]

        engagement_hotspots = {
            "high_volume_sessions": len(top_users),
            "dormant_users": len(at_risk_users),
        }

        return GlobalInsight(
            revenue_forecast=revenue_forecast,
            top_value_users=top_users,
            at_risk_users=at_risk_users,
            engagement_hotspots=engagement_hotspots,
        )

    async def log_inference(
        self,
        session: AsyncSession,
        admin_id: int,
        model_name: str,
        target_type: str,
        target_id: Optional[int],
        parameters: Optional[Dict] = None,
        metrics: Optional[Dict] = None,
    ) -> None:
        await AuditLogService.log_predictive_inference(
            session=session,
            admin_id=admin_id,
            model_name=model_name,
            target_type=target_type,
            target_id=target_id,
            parameters=parameters or {},
            metrics=metrics or {},
        )
