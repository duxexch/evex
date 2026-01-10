from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from api.dependencies import get_db, get_current_user
from services.continuous_risk_scoring_service import ContinuousRiskScoringService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/risk", tags=["risk-scoring"])

risk_service = None

def get_risk_service(session_maker):
    global risk_service
    if not risk_service:
        risk_service = ContinuousRiskScoringService(session_maker)
    return risk_service

@router.get("/score/{user_id}")
async def get_user_risk_score(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        service = get_risk_service(session.session_maker)
        breakdown = await service.calculate_overall_risk(session, user_id)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": user_id,
                "overall_score": breakdown.overall_score,
                "level": breakdown.level.value,
                "recommendation": breakdown.recommendation.value,
                "breakdown": {
                    "transaction_risk": breakdown.transaction_risk,
                    "fraud_risk": breakdown.fraud_risk,
                    "compliance_risk": breakdown.compliance_risk,
                    "behavior_risk": breakdown.behavior_risk
                }
            }
        }
    except Exception as e:
        logger.error(f"Error calculating risk score: {str(e)}")
        raise HTTPException(status_code=500, detail="Error calculating risk score")

@router.post("/score/{user_id}/action")
async def trigger_risk_response(
    user_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_risk_service(session.session_maker)
        breakdown = await service.calculate_overall_risk(session, user_id)
        response = await service.trigger_response(session, user_id, breakdown)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": response.user_id,
                "risk_level": response.risk_level.value,
                "score": response.score,
                "actions_taken": response.actions_taken,
                "escalation_reason": response.escalation_reason,
                "triggered_at": response.triggered_at.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error triggering risk response: {str(e)}")
        raise HTTPException(status_code=500, detail="Error triggering response")

@router.get("/trend/{user_id}")
async def get_user_risk_trend(
    user_id: int,
    days: int = 30,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 365")
    
    try:
        service = get_risk_service(session.session_maker)
        trend = await service.get_risk_trend(session, user_id, days)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "user_id": user_id,
                "days": days,
                "trend": trend
            }
        }
    except Exception as e:
        logger.error(f"Error fetching risk trend: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching trend")

@router.post("/score/bulk")
async def bulk_score_users(
    user_ids: list = None,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_risk_service(session.session_maker)
        scores = await service.bulk_score_users(session, user_ids)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "total_users_scored": len(scores),
                "high_risk_count": sum(1 for b in scores.values() if b.overall_score > 50),
                "critical_count": sum(1 for b in scores.values() if b.overall_score > 75)
            }
        }
    except Exception as e:
        logger.error(f"Error bulk scoring: {str(e)}")
        raise HTTPException(status_code=500, detail="Error bulk scoring")
