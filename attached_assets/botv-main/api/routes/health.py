#!/usr/bin/env python3
"""
Health check API endpoints for production monitoring
Kubernetes-compatible liveness and readiness probes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db
from services.health_check_service import HealthCheckService
from services.observability_service import metrics_collector
from services.error_recovery_service import recovery_service, graceful_degradation
from services.rate_limiting_service import abuse_detector, ddos_protection

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def liveness_probe(session: AsyncSession = Depends(get_db)):
    """
    Kubernetes liveness probe endpoint
    Returns 200 if service is running, 503 if not
    
    Use for: Container is alive check
    """
    health_service = HealthCheckService(None)
    
    try:
        await session.execute("SELECT 1")
        metrics_collector.increment_counter('liveness_checks')
        return {"status": "alive"}
    except:
        metrics_collector.increment_counter('liveness_failures')
        raise HTTPException(status_code=503, detail="Service unhealthy")


@router.get("/ready")
async def readiness_probe(session: AsyncSession = Depends(get_db)):
    """
    Kubernetes readiness probe endpoint
    Returns 200 if service is ready for traffic, 503 if not
    
    Use for: Service ready to accept requests check
    """
    health_service = HealthCheckService(None)
    
    try:
        is_ready = await health_service.readiness_check()
        metrics_collector.increment_counter('readiness_checks')
        if is_ready:
            return {"status": "ready"}
        else:
            metrics_collector.increment_counter('readiness_failures')
            raise HTTPException(status_code=503, detail="Service not ready")
    except:
        metrics_collector.increment_counter('readiness_failures')
        raise HTTPException(status_code=503, detail="Readiness check failed")


@router.get("/check")
async def full_health_check(session: AsyncSession = Depends(get_db)):
    """
    Full comprehensive health check
    Returns detailed status of all components
    
    Use for: Detailed health monitoring and dashboards
    """
    health_service = HealthCheckService(None)
    
    try:
        health = await health_service.full_health_check()
        metrics_collector.increment_counter('health_checks')
        
        if health['status'] in ["HEALTHY", "DEGRADED"]:
            # Include recovery and degradation info
            health["recovery"] = {
                "circuit_breakers": {
                    name: {
                        "is_open": cb.is_open,
                        "failure_count": cb.failure_count,
                    }
                    for name, cb in recovery_service.circuit_breakers.items()
                }
            }
            health["degradation"] = graceful_degradation.get_degradation_status()
            return health
        
        raise HTTPException(status_code=503, detail=health)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def health_summary(session: AsyncSession = Depends(get_db)):
    """
    Quick health summary (just statuses, no details)
    
    Use for: Monitoring dashboards, simple status checks
    """
    health_service = HealthCheckService(None)
    
    try:
        health = await health_service.full_health_check()
        
        return {
            'status': health['status'],
            'timestamp': health['timestamp'],
            'components': {
                name: comp['status']
                for name, comp in health['components'].items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def metrics_summary():
    """
    Get current metrics summary
    
    Use for: Performance monitoring and diagnostics
    """
    return metrics_collector.get_metrics_snapshot()


@router.get("/security")
async def security_status():
    """
    Get security status and abuse detection
    
    Use for: Security monitoring and threat detection
    """
    return {
        "abuse_detection": abuse_detector.get_flagged_summary(),
        "ddos_protection": {
            "blocked_ips_count": len(ddos_protection.get_blocked_ips()),
            "blocked_ips": ddos_protection.get_blocked_ips(),
        },
    }
