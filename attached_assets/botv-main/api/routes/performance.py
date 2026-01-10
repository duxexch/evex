from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from api.dependencies import get_db, get_current_user
from services.performance_optimization_service import PerformanceOptimizationService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/performance", tags=["performance"])

perf_service = None

def get_perf_service(session_maker):
    global perf_service
    if not perf_service:
        perf_service = PerformanceOptimizationService(session_maker)
    return perf_service

@router.get("/slow-queries")
async def get_slow_queries(
    limit: int = 50,
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        metrics = await service.analyze_slow_queries(session, limit)
        
        formatted = [
            {
                "query": m.query,
                "duration_ms": m.duration_ms,
                "rows_affected": m.rows_affected,
                "timestamp": m.timestamp.isoformat()
            }
            for m in metrics
        ]
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "slow_queries": formatted,
                "threshold_ms": 1000,
                "count": len(formatted)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching slow queries: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching queries")

@router.get("/index-recommendations")
async def get_index_recommendations(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        recommendations = service.get_index_recommendations()
        
        formatted = [
            {
                "table": r.table,
                "column": r.column,
                "reason": r.reason,
                "expected_improvement": r.expected_improvement,
                "priority": r.priority
            }
            for r in recommendations
        ]
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "recommendations": formatted,
                "total": len(formatted),
                "high_priority": sum(1 for r in recommendations if r.priority == "HIGH")
            }
        }
    except Exception as e:
        logger.error(f"Error fetching index recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching recommendations")

@router.get("/caching-strategies")
async def get_caching_strategies(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        strategies = service.get_caching_strategies()
        
        formatted = {}
        for key, strategy in strategies.items():
            formatted[key] = {
                "key": strategy.key,
                "ttl_seconds": strategy.ttl_seconds,
                "invalidation_triggers": strategy.invalidation_triggers,
                "data_size_estimate": strategy.data_size_estimate
            }
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "strategies": formatted,
                "total": len(formatted)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching caching strategies: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching strategies")

@router.get("/scaling-recommendations")
async def get_scaling_recommendations(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        recommendations = service.get_scaling_recommendations()
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": recommendations
        }
    except Exception as e:
        logger.error(f"Error fetching scaling recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching recommendations")

@router.get("/optimization-roadmap")
async def get_optimization_roadmap(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        roadmap = service.get_optimization_roadmap()
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "roadmap": roadmap,
                "total_phases": len(roadmap)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching roadmap: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching roadmap")

@router.get("/capacity-estimate")
async def estimate_capacity(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        estimates = await service.estimate_capacity()
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": estimates
        }
    except Exception as e:
        logger.error(f"Error estimating capacity: {str(e)}")
        raise HTTPException(status_code=500, detail="Error estimating capacity")

@router.get("/sql-optimization-examples")
async def get_sql_optimization_examples(
    current_user=Depends(get_current_user),
    session=Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = get_perf_service(session.session_maker)
        examples = service.get_sql_optimization_examples()
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "examples": examples,
                "total": len(examples)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching examples: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching examples")
