from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from api.dependencies import get_db, get_current_user
from services.user_behavior_analytics_service import UserBehaviorAnalyticsService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["user-analytics"])

analytics_service = None

def get_analytics_service(session_maker):
    global analytics_service
    if not analytics_service:
        analytics_service = UserBehaviorAnalyticsService(session_maker)
    return analytics_service

@router.get("/user/{user_id}/behavior")
async def get_user_behavior(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        service = get_analytics_service(session.session_maker)
        profile = await service.analyze_user_behavior(session, user_id)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": user_id,
                "cohort": profile.cohort.value,
                "lifetime_value": float(profile.lifetime_value),
                "churn_risk": profile.churn_risk.value,
                "engagement_score": profile.engagement_score,
                "retention_days": profile.retention_days,
                "avg_session_duration": profile.avg_session_duration,
                "total_bets": float(profile.total_bets),
                "win_rate": profile.win_rate,
                "days_since_login": profile.days_since_login,
                "activity_trend": profile.activity_trend
            }
        }
    except Exception as e:
        logger.error(f"Error fetching user behavior: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching behavior")

@router.get("/user/{user_id}/churn-prediction")
async def predict_user_churn(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        service = get_analytics_service(session.session_maker)
        prediction = await service.predict_churn(session, user_id)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": user_id,
                "risk_level": prediction.risk_level.value,
                "churn_probability": prediction.probability,
                "contributing_factors": prediction.contributing_factors,
                "recommended_actions": prediction.recommended_actions
            }
        }
    except Exception as e:
        logger.error(f"Error predicting churn: {str(e)}")
        raise HTTPException(status_code=500, detail="Error predicting churn")

@router.get("/cohorts")
async def analyze_cohorts(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_analytics_service(session.session_maker)
        cohort_data = await service.analyze_cohorts(session)
        
        formatted = {}
        for cohort_name, analysis in cohort_data.items():
            formatted[cohort_name] = {
                "user_count": analysis.user_count,
                "avg_lifetime_value": float(analysis.avg_lifetime_value),
                "avg_engagement": analysis.avg_engagement,
                "avg_retention_days": analysis.avg_retention_days,
                "churn_rate": analysis.churn_rate,
                "avg_win_rate": analysis.avg_win_rate
            }
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": formatted
        }
    except Exception as e:
        logger.error(f"Error analyzing cohorts: {str(e)}")
        raise HTTPException(status_code=500, detail="Error analyzing cohorts")

@router.get("/segments")
async def get_behavioral_segments(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_analytics_service(session.session_maker)
        segments = await service.get_behavioral_segments(session)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "high_value": segments.get("high_value", []),
                "at_risk": segments.get("at_risk", []),
                "new_users": segments.get("new_users", []),
                "dormant": segments.get("dormant", []),
                "engaged": segments.get("engaged", [])
            }
        }
    except Exception as e:
        logger.error(f"Error getting segments: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting segments")
