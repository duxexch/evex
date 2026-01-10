import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.audit_log_service import AuditLogService

logger = logging.getLogger(__name__)

SUPPORTED_FEATURES = {
    "bet_amount": "bet_amount",
    "payout_amount": "payout_amount",
}


@dataclass
class FeatureStats:
    count: int
    mean: Decimal
    min: Decimal
    max: Decimal


@dataclass
class DriftResult:
    feature: str
    baseline_mean: Decimal
    baseline_std: Decimal
    current_mean: Decimal
    z_score: Decimal
    drift_status: str


class ModelMonitoringService:
    def __init__(self):
        pass

    async def get_feature_stats(
        self,
        session: AsyncSession,
        feature: str,
        period_days: int = 30,
    ) -> FeatureStats:
        column = SUPPORTED_FEATURES.get(feature)
        if not column:
            raise ValueError("Unsupported feature")

        cutoff = datetime.utcnow() - timedelta(days=max(1, period_days))
        result = await session.execute(
            text(
                f"""
                SELECT
                    COUNT(*) as cnt,
                    COALESCE(AVG({column}), 0) as avg_val,
                    COALESCE(MIN({column}), 0) as min_val,
                    COALESCE(MAX({column}), 0) as max_val
                FROM game_rounds
                WHERE created_at >= :cutoff
                """
            ),
            {"cutoff": cutoff},
        )
        row = result.first() or (0, 0, 0, 0)
        return FeatureStats(
            count=int(row[0] or 0),
            mean=Decimal(str(row[1] or 0)),
            min=Decimal(str(row[2] or 0)),
            max=Decimal(str(row[3] or 0)),
        )

    async def detect_drift(
        self,
        session: AsyncSession,
        feature: str,
        baseline_mean: float,
        baseline_std: float,
        period_days: int = 7,
    ) -> DriftResult:
        stats = await self.get_feature_stats(session, feature, period_days)
        std = Decimal(str(baseline_std if baseline_std != 0 else 0.0001))
        z_score = (stats.mean - Decimal(str(baseline_mean))) / std

        status = "stable"
        if abs(z_score) >= Decimal("2"):
            status = "drift"
        elif abs(z_score) >= Decimal("1"):
            status = "monitor"

        return DriftResult(
            feature=feature,
            baseline_mean=Decimal(str(baseline_mean)),
            baseline_std=std,
            current_mean=stats.mean,
            z_score=z_score,
            drift_status=status,
        )

    async def segment_performance(
        self,
        session: AsyncSession,
        period_days: int = 30,
    ) -> Dict[str, List[Dict]]:
        cutoff = datetime.utcnow() - timedelta(days=max(1, period_days))
        rows = await session.execute(
            text(
                """
                SELECT user_id,
                       COALESCE(SUM(bet_amount), 0) as total_bet,
                       COALESCE(SUM(payout_amount), 0) as total_payout,
                       COUNT(*) as rounds
                FROM game_rounds
                WHERE created_at >= :cutoff
                GROUP BY user_id
                """
            ),
            {"cutoff": cutoff},
        )
        segments: Dict[str, List[Dict]] = {
            "vip": [],
            "high": [],
            "medium": [],
            "low": [],
        }
        for row in rows.fetchall():
            total_bet = Decimal(str(row.total_bet or 0))
            total_payout = Decimal(str(row.total_payout or 0))
            net_gain = total_bet - total_payout
            tier = self._classify_tier(total_bet)
            segments[tier].append(
                {
                    "user_id": row.user_id,
                    "total_bet": float(total_bet),
                    "total_payout": float(total_payout),
                    "net_gain": float(net_gain),
                    "rounds": int(row.rounds or 0),
                }
            )
        return segments

    async def log_monitoring_event(
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

    def _classify_tier(self, total_bet: Decimal) -> str:
        if total_bet >= Decimal("10000"):
            return "vip"
        if total_bet >= Decimal("5000"):
            return "high"
        if total_bet >= Decimal("1000"):
            return "medium"
        return "low"
