#!/usr/bin/env python3
"""
Phase 9 Observability API Routes
Real-time monitoring, dashboards, and alerts
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from api.dependencies import get_db, get_current_user
from services.monitoring_aggregator_service import MonitoringAggregatorService
from services.alert_management_service import AlertManagementService, AlertSeverity
from services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/v1/observability", tags=["observability"])


# ============================================================================
# MONITORING ENDPOINTS
# ============================================================================

@router.get("/metrics/current")
async def get_current_metrics(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get current aggregated metrics"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = MonitoringAggregatorService(session)
    metrics = await service.get_current_metrics()
    
    return {'timestamp': datetime.utcnow().isoformat(), 'metrics': metrics}


@router.get("/metrics/timeseries")
async def get_metric_timeseries(
    metric: str,
    minutes: int = 60,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get metric timeseries data"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = MonitoringAggregatorService(session)
    data = await service.get_metrics_timeseries(metric, minutes)
    
    return {'metric': metric, 'period_minutes': minutes, 'data': data}


@router.get("/health/system")
async def get_system_health(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get overall system health"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = MonitoringAggregatorService(session)
    health = await service.get_system_health()
    
    return {
        'healthy': health.healthy,
        'subsystems': {
            'transactions': health.transaction_system,
            'payments': health.payment_system,
            'fraud': health.fraud_system,
            'api': health.api_system,
            'database': health.database_system,
            'users': health.user_system,
        },
        'uptime': health.overall_uptime,
    }


@router.get("/metrics/thresholds")
async def check_threshold_violations(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Check for metric threshold violations"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = MonitoringAggregatorService(session)
    violations = await service.check_thresholds()
    
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'violations_count': len(violations),
        'violations': violations,
    }


# ============================================================================
# ALERT ENDPOINTS
# ============================================================================

@router.get("/alerts/active")
async def get_active_alerts(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get all active alerts"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = AlertManagementService(session)
    alerts = await service.get_active_alerts()
    
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'count': len(alerts),
        'alerts': alerts,
    }


@router.get("/alerts/statistics")
async def get_alert_statistics(
    hours: int = 24,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get alert statistics"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = AlertManagementService(session)
    stats = await service.get_alert_statistics(hours)
    
    return stats


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Acknowledge an alert"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = AlertManagementService(session)
    success = await service.acknowledge_alert(alert_id, current_user.username)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to acknowledge alert")
    
    return {'alert_id': alert_id, 'acknowledged': True}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    resolution_notes: str = "",
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Resolve an alert"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = AlertManagementService(session)
    success = await service.resolve_alert(alert_id, resolution_notes)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to resolve alert")
    
    return {'alert_id': alert_id, 'resolved': True}


@router.post("/alerts/{alert_id}/escalate")
async def escalate_alert(
    alert_id: int,
    reason: str = "",
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Escalate an alert"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = AlertManagementService(session)
    success = await service.escalate_alert(alert_id, reason)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to escalate alert")
    
    return {'alert_id': alert_id, 'escalated': True}


# ============================================================================
# DASHBOARD ENDPOINTS
# ============================================================================

@router.get("/dashboards/executive")
async def get_executive_dashboard(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get executive dashboard"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = DashboardService(session)
    dashboard = await service.get_executive_dashboard()
    
    return dashboard


@router.get("/dashboards/operations")
async def get_operations_dashboard(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get operations dashboard"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = DashboardService(session)
    dashboard = await service.get_operations_dashboard()
    
    return dashboard


@router.get("/dashboards/security")
async def get_security_dashboard(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get security dashboard"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = DashboardService(session)
    dashboard = await service.get_security_dashboard()
    
    return dashboard


@router.get("/dashboards/players")
async def get_player_dashboard(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get player activity dashboard"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = DashboardService(session)
    dashboard = await service.get_player_dashboard()
    
    return dashboard


@router.get("/dashboards/system")
async def get_system_dashboard(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get system health dashboard"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = DashboardService(session)
    dashboard = await service.get_system_dashboard()
    
    return dashboard


# ============================================================================
# COMBINED DASHBOARD
# ============================================================================

@router.get("/dashboards/complete")
async def get_complete_dashboard(
    current_user=Depends(get_current_user),
    session=Depends(get_db),
):
    """Get all dashboard data (executive + operations + security)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    dashboard_service = DashboardService(session)
    alert_service = AlertManagementService(session)
    monitor_service = MonitoringAggregatorService(session)
    
    executive = await dashboard_service.get_executive_dashboard()
    operations = await dashboard_service.get_operations_dashboard()
    security = await dashboard_service.get_security_dashboard()
    players = await dashboard_service.get_player_dashboard()
    system = await dashboard_service.get_system_dashboard()
    
    active_alerts = await alert_service.get_active_alerts()
    health = await monitor_service.get_system_health()
    
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'system_health': {
            'healthy': health.healthy,
            'subsystems': {
                'transactions': health.transaction_system,
                'payments': health.payment_system,
                'fraud': health.fraud_system,
                'api': health.api_system,
                'database': health.database_system,
            },
        },
        'active_alerts': {
            'count': len(active_alerts),
            'alerts': active_alerts[:10],  # Top 10
        },
        'executive': executive,
        'operations': operations,
        'security': security,
        'players': players,
        'system': system,
    }
