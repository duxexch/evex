#!/usr/bin/env python3
"""
Alert management system
Manages alert creation, routing, and acknowledgment
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
import logging
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertStatus(Enum):
    """Alert status"""
    TRIGGERED = "triggered"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class AlertChannel(Enum):
    """Alert notification channels"""
    LOG = "log"
    EMAIL = "email"
    SLACK = "slack"
    PAGERDUTY = "pagerduty"
    SMS = "sms"


@dataclass
class AlertRule:
    """Alert rule definition"""
    name: str
    metric: str
    condition: str  # >, <, ==, !=
    threshold: float
    severity: AlertSeverity
    duration_seconds: int  # How long violation must persist
    channels: List[AlertChannel]
    enabled: bool = True


@dataclass
class Alert:
    """Alert instance"""
    id: Optional[int]
    rule_name: str
    metric: str
    value: float
    threshold: float
    severity: AlertSeverity
    status: AlertStatus
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    message: str = ""
    details: Dict[str, Any] = None


class AlertManagementService:
    """Manage system alerts"""
    
    def __init__(self, session_maker):
        """
        Initialize service
        
        Args:
            session_maker: AsyncSession maker
        """
        self.session_maker = session_maker
        # Default alert rules
        self.default_rules = [
            AlertRule(
                name='high_transaction_error_rate',
                metric='transaction_error_rate',
                condition='>',
                threshold=0.05,
                severity=AlertSeverity.CRITICAL,
                duration_seconds=300,
                channels=[AlertChannel.LOG, AlertChannel.EMAIL, AlertChannel.SLACK],
            ),
            AlertRule(
                name='payment_failure_spike',
                metric='payment_failure_rate',
                condition='>',
                threshold=0.01,
                severity=AlertSeverity.CRITICAL,
                duration_seconds=60,
                channels=[AlertChannel.LOG, AlertChannel.SLACK, AlertChannel.PAGERDUTY],
            ),
            AlertRule(
                name='high_fraud_activity',
                metric='fraud_alerts_1h',
                condition='>',
                threshold=100,
                severity=AlertSeverity.WARNING,
                duration_seconds=600,
                channels=[AlertChannel.LOG, AlertChannel.EMAIL],
            ),
            AlertRule(
                name='api_latency_high',
                metric='api_latency_p99',
                condition='>',
                threshold=1000,
                severity=AlertSeverity.WARNING,
                duration_seconds=300,
                channels=[AlertChannel.LOG, AlertChannel.SLACK],
            ),
            AlertRule(
                name='database_slow_queries',
                metric='database_query_time',
                condition='>',
                threshold=1000,
                severity=AlertSeverity.WARNING,
                duration_seconds=300,
                channels=[AlertChannel.LOG],
            ),
            AlertRule(
                name='cache_hit_rate_low',
                metric='cache_hit_rate',
                condition='<',
                threshold=0.80,
                severity=AlertSeverity.INFO,
                duration_seconds=600,
                channels=[AlertChannel.LOG],
            ),
        ]
    
    async def create_alert(
        self,
        rule_name: str,
        metric: str,
        value: float,
        threshold: float,
        severity: AlertSeverity,
        message: str = "",
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Create alert
        
        Args:
            rule_name: Rule name
            metric: Metric name
            value: Current value
            threshold: Threshold
            severity: Alert severity
            message: Alert message
            details: Additional details
            
        Returns:
            Success
        """
        try:
            async with self.session_maker() as session:
                await session.execute(text("""
                    INSERT INTO alerts (rule_name, metric, value, threshold, severity, status, triggered_at, message, details)
                    VALUES (:rule, :metric, :value, :threshold, :severity, :status, :triggered, :message, :details)
                """), {
                    'rule': rule_name,
                    'metric': metric,
                    'value': value,
                    'threshold': threshold,
                    'severity': severity.value,
                    'status': AlertStatus.TRIGGERED.value,
                    'triggered': datetime.utcnow(),
                    'message': message,
                    'details': json.dumps(details or {}),
                })
                
                await session.commit()
                
                # Route to channels
                rule = self._find_rule(rule_name)
                if rule:
                    await self._route_alert(rule, value, threshold, message)
                
                return True
        
        except Exception as e:
            logger.error(f"Alert creation error: {e}")
            return False
    
    async def acknowledge_alert(
        self,
        alert_id: int,
        acknowledged_by: str = "",
    ) -> bool:
        """
        Acknowledge alert
        
        Args:
            alert_id: Alert ID
            acknowledged_by: User/system acknowledging
            
        Returns:
            Success
        """
        try:
            async with self.session_maker() as session:
                await session.execute(text("""
                    UPDATE alerts
                    SET status = :status, acknowledged_at = :ack_time, acknowledged_by = :ack_by
                    WHERE id = :alert_id
                """), {
                    'status': AlertStatus.ACKNOWLEDGED.value,
                    'ack_time': datetime.utcnow(),
                    'ack_by': acknowledged_by,
                    'alert_id': alert_id,
                })
                
                await session.commit()
                return True
        
        except Exception as e:
            logger.error(f"Alert acknowledgment error: {e}")
            return False
    
    async def resolve_alert(
        self,
        alert_id: int,
        resolution_notes: str = "",
    ) -> bool:
        """
        Mark alert as resolved
        
        Args:
            alert_id: Alert ID
            resolution_notes: Resolution notes
            
        Returns:
            Success
        """
        try:
            async with self.session_maker() as session:
                await session.execute(text("""
                    UPDATE alerts
                    SET status = :status, resolved_at = :resolved_time, resolution_notes = :notes
                    WHERE id = :alert_id
                """), {
                    'status': AlertStatus.RESOLVED.value,
                    'resolved_time': datetime.utcnow(),
                    'notes': resolution_notes,
                    'alert_id': alert_id,
                })
                
                await session.commit()
                return True
        
        except Exception as e:
            logger.error(f"Alert resolution error: {e}")
            return False
    
    async def escalate_alert(
        self,
        alert_id: int,
        escalation_reason: str = "",
    ) -> bool:
        """
        Escalate alert to higher severity
        
        Args:
            alert_id: Alert ID
            escalation_reason: Reason for escalation
            
        Returns:
            Success
        """
        try:
            async with self.session_maker() as session:
                alert_result = await session.execute(text("""
                    SELECT severity FROM alerts WHERE id = :alert_id
                """), {'alert_id': alert_id})
                
                severity = alert_result.scalar()
                
                if severity == AlertSeverity.WARNING.value:
                    new_severity = AlertSeverity.CRITICAL.value
                elif severity == AlertSeverity.CRITICAL.value:
                    new_severity = AlertSeverity.EMERGENCY.value
                else:
                    new_severity = severity
                
                await session.execute(text("""
                    UPDATE alerts
                    SET status = :status, severity = :severity, escalation_reason = :reason
                    WHERE id = :alert_id
                """), {
                    'status': AlertStatus.ESCALATED.value,
                    'severity': new_severity,
                    'reason': escalation_reason,
                    'alert_id': alert_id,
                })
                
                await session.commit()
                return True
        
        except Exception as e:
            logger.error(f"Alert escalation error: {e}")
            return False
    
    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        """
        Get all active (non-resolved) alerts
        
        Returns:
            List of active alerts
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(text("""
                    SELECT id, rule_name, metric, value, threshold, severity, status, triggered_at, message
                    FROM alerts
                    WHERE status IN ('triggered', 'acknowledged', 'escalated')
                    ORDER BY severity DESC, triggered_at DESC
                    LIMIT 100
                """))
                
                return [
                    {
                        'id': row[0],
                        'rule_name': row[1],
                        'metric': row[2],
                        'value': float(row[3]),
                        'threshold': float(row[4]),
                        'severity': row[5],
                        'status': row[6],
                        'triggered_at': row[7].isoformat(),
                        'message': row[8],
                    }
                    for row in result.fetchall()
                ]
        
        except Exception as e:
            logger.error(f"Get active alerts error: {e}")
            return []
    
    async def get_alert_statistics(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get alert statistics
        
        Args:
            hours: Hours to analyze
            
        Returns:
            Alert statistics
        """
        try:
            async with self.session_maker() as session:
                period_start = datetime.utcnow() - timedelta(hours=hours)
                
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as total_alerts,
                        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
                        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
                        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
                        COUNT(CASE WHEN status = 'triggered' THEN 1 END) as active_count,
                        AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - triggered_at))) as avg_resolution_time
                    FROM alerts
                    WHERE triggered_at >= :start
                """), {'start': period_start})
                
                row = result.fetchone()
                
                return {
                    'period_hours': hours,
                    'total_alerts': row[0] or 0,
                    'critical_alerts': row[1] or 0,
                    'warning_alerts': row[2] or 0,
                    'resolved_alerts': row[3] or 0,
                    'active_alerts': row[4] or 0,
                    'avg_resolution_time_seconds': int(row[5] or 0),
                }
        
        except Exception as e:
            logger.error(f"Alert statistics error: {e}")
            return {}
    
    def _find_rule(self, rule_name: str) -> Optional[AlertRule]:
        """Find rule by name"""
        for rule in self.default_rules:
            if rule.name == rule_name:
                return rule
        return None
    
    async def _route_alert(
        self,
        rule: AlertRule,
        value: float,
        threshold: float,
        message: str,
    ) -> None:
        """
        Route alert to configured channels
        
        Args:
            rule: Alert rule
            value: Current value
            threshold: Threshold
            message: Alert message
        """
        if not rule.enabled:
            return
        
        alert_text = f"[{rule.name}] {message} (value: {value}, threshold: {threshold})"
        
        for channel in rule.channels:
            try:
                if channel == AlertChannel.LOG:
                    if rule.severity == AlertSeverity.CRITICAL:
                        logger.critical(alert_text)
                    elif rule.severity == AlertSeverity.WARNING:
                        logger.warning(alert_text)
                    else:
                        logger.info(alert_text)
                
                elif channel == AlertChannel.EMAIL:
                    # Would integrate with email service
                    logger.info(f"[EMAIL] {alert_text}")
                
                elif channel == AlertChannel.SLACK:
                    # Would integrate with Slack API
                    logger.info(f"[SLACK] {alert_text}")
                
                elif channel == AlertChannel.PAGERDUTY:
                    # Would integrate with PagerDuty API
                    logger.info(f"[PAGERDUTY] {alert_text}")
                
                elif channel == AlertChannel.SMS:
                    # Would integrate with SMS service
                    logger.info(f"[SMS] {alert_text}")
            
            except Exception as e:
                logger.error(f"Alert routing error ({channel.value}): {e}")
    
    async def check_alert_rules(self, metrics: Dict[str, float]) -> None:
        """
        Check metrics against alert rules
        
        Args:
            metrics: Current metrics
        """
        for rule in self.default_rules:
            if not rule.enabled:
                continue
            
            if rule.metric not in metrics:
                continue
            
            value = metrics[rule.metric]
            triggered = False
            
            if rule.condition == '>':
                triggered = value > rule.threshold
            elif rule.condition == '<':
                triggered = value < rule.threshold
            elif rule.condition == '==':
                triggered = value == rule.threshold
            elif rule.condition == '!=':
                triggered = value != rule.threshold
            
            if triggered:
                await self.create_alert(
                    rule_name=rule.name,
                    metric=rule.metric,
                    value=value,
                    threshold=rule.threshold,
                    severity=rule.severity,
                    message=f"{rule.name}: {value} {rule.condition} {rule.threshold}",
                )
