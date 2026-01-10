import asyncio
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_db, get_current_user
from services.model_monitoring_service import ModelMonitoringService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/model-monitoring", tags=["model-monitoring"])

_monitor_service = None
_monitor_lock = asyncio.Lock()


async def get_monitor_service():
    global _monitor_service
    if _monitor_service is not None:
        return _monitor_service
    async with _monitor_lock:
        if _monitor_service is None:
            _monitor_service = ModelMonitoringService()
        return _monitor_service


@router.get("/feature-stats")
async def feature_stats(
    feature: str,
    period_days: int = 30,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if period_days < 1 or period_days > 365:
        raise HTTPException(status_code=400, detail="period_days must be between 1 and 365")

    try:
        service = await get_monitor_service()
        stats = await service.get_feature_stats(session, feature, period_days)
        await service.log_monitoring_event(
            session,
            admin_id=current_user.id,
            model_name="feature_stats",
            target_type="SYSTEM",
            target_id=None,
            parameters={"feature": feature, "period_days": period_days},
            metrics={
                "count": stats.count,
                "mean": float(stats.mean),
                "min": float(stats.min),
                "max": float(stats.max),
            },
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "feature": feature,
                "count": stats.count,
                "mean": float(stats.mean),
                "min": float(stats.min),
                "max": float(stats.max),
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"Feature stats failed: {exc}")
        raise HTTPException(status_code=500, detail="Feature stats failed")


@router.get("/drift")
async def detect_drift(
    feature: str,
    baseline_mean: float,
    baseline_std: float,
    period_days: int = 7,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if period_days < 1 or period_days > 365:
        raise HTTPException(status_code=400, detail="period_days must be between 1 and 365")

    try:
        service = await get_monitor_service()
        result = await service.detect_drift(session, feature, baseline_mean, baseline_std, period_days)
        await service.log_monitoring_event(
            session,
            admin_id=current_user.id,
            model_name="drift_detection",
            target_type="SYSTEM",
            target_id=None,
            parameters={
                "feature": feature,
                "period_days": period_days,
                "baseline_mean": baseline_mean,
                "baseline_std": baseline_std,
            },
            metrics={
                "current_mean": float(result.current_mean),
                "z_score": float(result.z_score),
                "drift_status": result.drift_status,
            },
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "feature": feature,
                "baseline_mean": float(result.baseline_mean),
                "baseline_std": float(result.baseline_std),
                "current_mean": float(result.current_mean),
                "z_score": float(result.z_score),
                "drift_status": result.drift_status,
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"Drift detection failed: {exc}")
        raise HTTPException(status_code=500, detail="Drift detection failed")


@router.get("/segment-performance")
async def segment_performance(
    period_days: int = 30,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if period_days < 1 or period_days > 365:
        raise HTTPException(status_code=400, detail="period_days must be between 1 and 365")

    try:
        service = await get_monitor_service()
        segments = await service.segment_performance(session, period_days)
        await service.log_monitoring_event(
            session,
            admin_id=current_user.id,
            model_name="segment_performance",
            target_type="SYSTEM",
            target_id=None,
            parameters={"period_days": period_days},
            metrics={"segments": {k: len(v) for k, v in segments.items()}},
        )
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": segments,
        }
    except Exception as exc:
        logger.error(f"Segment performance failed: {exc}")
        raise HTTPException(status_code=500, detail="Segment performance failed")
