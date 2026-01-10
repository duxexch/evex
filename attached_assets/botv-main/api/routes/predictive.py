import asyncio
from datetime import datetime
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_db, get_current_user
from services.predictive_modeling_service import PredictiveModelingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/predictive", tags=["predictive-modeling"])

_service_instance: Optional[PredictiveModelingService] = None
_service_lock = asyncio.Lock()


async def get_predictive_service():
    global _service_instance
    if _service_instance is not None:
        return _service_instance
    async with _service_lock:
        if _service_instance is None:
            _service_instance = PredictiveModelingService(None)
        return _service_instance


@router.get("/ltv/{user_id}")
async def forecast_user_ltv(
    user_id: int,
    horizon_days: int = 90,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        service = await get_predictive_service()
        forecast = await service.forecast_user_ltv(session, user_id, horizon_days)
        await service.log_inference(
            session,
            current_user.id,
            model_name="ltv_forecast",
            target_type="USER",
            target_id=user_id,
            parameters={"horizon_days": horizon_days},
            metrics={"predicted_ltv": float(forecast.predicted_ltv)},
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": forecast.user_id,
                "horizon_days": forecast.horizon_days,
                "predicted_ltv": float(forecast.predicted_ltv),
                "lower_bound": float(forecast.lower_bound),
                "upper_bound": float(forecast.upper_bound),
            },
        }
    except Exception as exc:
        logger.error(f"LTV forecast failed: {exc}")
        raise HTTPException(status_code=500, detail="LTV forecast failed")


@router.get("/revenue-forecast")
async def forecast_revenue(
    horizon_days: int = 30,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        service = await get_predictive_service()
        forecast = await service.forecast_revenue(session, horizon_days)
        await service.log_inference(
            session,
            current_user.id,
            model_name="revenue_forecast",
            target_type="SYSTEM",
            target_id=None,
            parameters={"horizon_days": horizon_days},
            metrics={"projected_net": float(forecast.projected_net)},
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "horizon_days": forecast.horizon_days,
                "projected_net": float(forecast.projected_net),
                "daily_projection": [float(x) for x in forecast.daily_projection],
            },
        }
    except Exception as exc:
        logger.error(f"Revenue forecast failed: {exc}")
        raise HTTPException(status_code=500, detail="Revenue forecast failed")


@router.get("/player-value/{user_id}")
async def predict_player_value(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        service = await get_predictive_service()
        prediction = await service.predict_player_value(session, user_id)
        await service.log_inference(
            session,
            current_user.id,
            model_name="player_value",
            target_type="USER",
            target_id=user_id,
            parameters={},
            metrics={
                "tier": prediction.tier.value,
                "expected_monthly_value": float(prediction.expected_monthly_value),
            },
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": prediction.user_id,
                "tier": prediction.tier.value,
                "expected_monthly_value": float(prediction.expected_monthly_value),
                "win_rate": prediction.win_rate,
                "net_gain": float(prediction.net_gain),
            },
        }
    except Exception as exc:
        logger.error(f"Player value prediction failed: {exc}")
        raise HTTPException(status_code=500, detail="Player value prediction failed")


@router.get("/engagement/{user_id}")
async def forecast_engagement(
    user_id: int,
    horizon_days: int = 14,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if horizon_days < 3 or horizon_days > 90:
        raise HTTPException(status_code=400, detail="horizon_days must be between 3 and 90")

    try:
        service = await get_predictive_service()
        forecast = await service.forecast_engagement(session, user_id, horizon_days)
        await service.log_inference(
            session,
            current_user.id,
            model_name="engagement_forecast",
            target_type="USER",
            target_id=user_id,
            parameters={"horizon_days": horizon_days},
            metrics={"predicted_sessions": forecast.predicted_sessions},
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": forecast.user_id,
                "horizon_days": forecast.horizon_days,
                "predicted_sessions": forecast.predicted_sessions,
                "avg_daily_sessions": forecast.avg_daily_sessions,
            },
        }
    except Exception as exc:
        logger.error(f"Engagement forecast failed: {exc}")
        raise HTTPException(status_code=500, detail="Engagement forecast failed")


@router.get("/global-insights")
async def global_insights(
    horizon_days: int = 30,
    top_n: int = 10,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if top_n < 1 or top_n > 100:
        raise HTTPException(status_code=400, detail="top_n must be between 1 and 100")

    try:
        service = await get_predictive_service()
        insights = await service.generate_global_insights(session, horizon_days, top_n)
        await service.log_inference(
            session,
            current_user.id,
            model_name="global_insights",
            target_type="SYSTEM",
            target_id=None,
            parameters={"horizon_days": horizon_days, "top_n": top_n},
            metrics={"projected_net": float(insights.revenue_forecast.projected_net)},
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "horizon_days": insights.revenue_forecast.horizon_days,
                "projected_net": float(insights.revenue_forecast.projected_net),
                "top_value_users": insights.top_value_users,
                "at_risk_users": insights.at_risk_users,
                "engagement_hotspots": insights.engagement_hotspots,
            },
        }
    except Exception as exc:
        logger.error(f"Global insights failed: {exc}")
        raise HTTPException(status_code=500, detail="Global insights failed")
