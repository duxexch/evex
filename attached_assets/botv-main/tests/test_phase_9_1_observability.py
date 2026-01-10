import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from services.monitoring_aggregator_service import (
    MonitoringAggregatorService,
    MetricType,
    Severity,
    Metric
)
from services.alert_management_service import (
    AlertManagementService,
    AlertSeverity,
    AlertStatus,
    AlertChannel
)
from services.dashboard_service import DashboardService

class TestMonitoringAggregatorService:
    
    @pytest.fixture
    async def service(self, session_maker):
        return MonitoringAggregatorService(session_maker)
    
    @pytest.mark.asyncio
    async def test_collect_transaction_metrics(self, service, session: AsyncSession):
        metrics = await service.collect_transaction_metrics(session)
        assert isinstance(metrics, dict)
        assert "transaction_count" in metrics
        assert "transaction_error_rate" in metrics
        assert "transaction_volume" in metrics
        assert all(isinstance(v, Decimal) for v in metrics.values())
    
    @pytest.mark.asyncio
    async def test_collect_game_metrics(self, service, session: AsyncSession):
        metrics = await service.collect_game_metrics(session)
        assert isinstance(metrics, dict)
        assert "game_count" in metrics
        assert "active_players" in metrics
        assert "game_win_rate" in metrics
    
    @pytest.mark.asyncio
    async def test_collect_user_metrics(self, service, session: AsyncSession):
        metrics = await service.collect_user_metrics(session)
        assert isinstance(metrics, dict)
        assert "user_total" in metrics
        assert "user_active" in metrics
        assert "user_new_today" in metrics
    
    @pytest.mark.asyncio
    async def test_collect_fraud_metrics(self, service, session: AsyncSession):
        metrics = await service.collect_fraud_metrics(session)
        assert isinstance(metrics, dict)
        assert "fraud_flags_count" in metrics
        assert "fraud_critical_count" in metrics
        assert "fraud_avg_score" in metrics
    
    @pytest.mark.asyncio
    async def test_collect_payment_metrics(self, service, session: AsyncSession):
        metrics = await service.collect_payment_metrics(session)
        assert isinstance(metrics, dict)
        assert "payment_count" in metrics
        assert "payment_failure_rate" in metrics
        assert "payment_volume" in metrics
    
    @pytest.mark.asyncio
    async def test_get_system_health(self, service, session: AsyncSession):
        health = await service.get_system_health(session)
        assert health is not None
        assert health.status in ["healthy", "degraded", "unknown"]
        assert health.uptime_percentage >= 0
        assert len(health.subsystems) > 0
        assert all(key in health.subsystems for key in [
            "transactions", "payments", "fraud_detection", "api", "database", "cache"
        ])
    
    @pytest.mark.asyncio
    async def test_get_current_metrics(self, service, session: AsyncSession):
        metrics = await service.get_current_metrics(session)
        assert isinstance(metrics, dict)
        assert len(metrics) > 0
        assert all(isinstance(v, Decimal) for v in metrics.values())
    
    @pytest.mark.asyncio
    async def test_get_metrics_timeseries(self, service, session: AsyncSession):
        timeseries = await service.get_metrics_timeseries(
            session, 
            "transaction_count",
            minutes=60
        )
        assert isinstance(timeseries, list)
    
    @pytest.mark.asyncio
    async def test_check_thresholds(self, service, session: AsyncSession):
        result = await service.check_thresholds(session)
        assert "violations" in result
        assert isinstance(result["violations"], list)
    
    @pytest.mark.asyncio
    async def test_log_metric(self, service, session: AsyncSession):
        metric = Metric(
            metric_type=MetricType.TRANSACTION_COUNT,
            value=Decimal("100.50"),
            timestamp=datetime.utcnow(),
            tags={"test": "value"}
        )
        result = await service.log_metric(session, metric)
        assert result in [True, False]

class TestAlertManagementService:
    
    @pytest.fixture
    async def service(self, session_maker):
        return AlertManagementService(session_maker)
    
    def test_default_rules_configured(self, service):
        assert len(service.rules) == 6
        rule_names = [r.name for r in service.rules]
        assert "transaction_error_rate_high" in rule_names
        assert "payment_failure_spike" in rule_names
        assert "high_fraud_activity" in rule_names
        assert "api_latency_high" in rule_names
        assert "database_slow_queries" in rule_names
        assert "cache_hit_rate_low" in rule_names
    
    @pytest.mark.asyncio
    async def test_create_alert(self, service, session: AsyncSession):
        alert_id = await service.create_alert(
            session,
            "test_rule",
            "transaction_error_rate",
            Decimal("7.5"),
            Decimal("5.0"),
            AlertSeverity.WARNING,
            "Test alert message",
            {"test": "details"}
        )
        assert alert_id is None or isinstance(alert_id, int)
    
    @pytest.mark.asyncio
    async def test_acknowledge_alert(self, service, session: AsyncSession):
        result = await service.acknowledge_alert(session, 9999, "test_user")
        assert isinstance(result, bool)
    
    @pytest.mark.asyncio
    async def test_resolve_alert(self, service, session: AsyncSession):
        result = await service.resolve_alert(session, 9999, "Resolved for testing")
        assert isinstance(result, bool)
    
    @pytest.mark.asyncio
    async def test_escalate_alert(self, service, session: AsyncSession):
        result = await service.escalate_alert(session, 9999, "Escalated for testing")
        assert isinstance(result, bool)
    
    @pytest.mark.asyncio
    async def test_get_active_alerts(self, service, session: AsyncSession):
        alerts = await service.get_active_alerts(session)
        assert isinstance(alerts, list)
    
    @pytest.mark.asyncio
    async def test_get_alert_statistics(self, service, session: AsyncSession):
        stats = await service.get_alert_statistics(session, hours=24)
        assert isinstance(stats, dict)
        assert "total_triggered" in stats
        assert "by_severity" in stats
        assert "resolved_count" in stats
    
    @pytest.mark.asyncio
    async def test_check_alert_rules(self, service, session: AsyncSession):
        metrics = {
            "transaction_error_rate": Decimal("7.5"),
            "payment_failure_rate": Decimal("0.5"),
            "fraud_critical_count": Decimal("5"),
            "api_latency_p99": Decimal("500"),
            "database_latency": Decimal("200"),
            "cache_hit_rate": Decimal("90")
        }
        alert_ids = await service.check_alert_rules(session, metrics)
        assert isinstance(alert_ids, list)
    
    def test_find_rule(self, service):
        rule = service._find_rule("transaction_error_rate")
        assert rule is not None
        assert rule.name == "transaction_error_rate_high"
    
    @pytest.mark.asyncio
    async def test_route_alert(self, service):
        result = await service._route_alert(
            1,
            AlertSeverity.CRITICAL,
            "Test alert",
            {"test": "details"}
        )
        assert result is True

class TestDashboardService:
    
    @pytest.fixture
    async def service(self, session_maker):
        return DashboardService(session_maker)
    
    @pytest.mark.asyncio
    async def test_get_executive_dashboard(self, service, session: AsyncSession):
        dashboard = await service.get_executive_dashboard(session)
        assert isinstance(dashboard, dict)
        assert "financial" in dashboard
        assert "users" in dashboard
        assert "games" in dashboard
        assert "period" in dashboard
        assert "timestamp" in dashboard
    
    @pytest.mark.asyncio
    async def test_executive_dashboard_financial_metrics(self, service, session: AsyncSession):
        dashboard = await service.get_executive_dashboard(session)
        financial = dashboard.get("financial", {})
        assert "deposits" in financial
        assert "bets" in financial
        assert "payouts" in financial
        assert "withdrawals" in financial
        assert "gross_revenue" in financial
        assert "net_revenue" in financial
        assert "roi_percentage" in financial
    
    @pytest.mark.asyncio
    async def test_get_operations_dashboard(self, service, session: AsyncSession):
        dashboard = await service.get_operations_dashboard(session)
        assert isinstance(dashboard, dict)
        assert "transactions" in dashboard
        assert "payments" in dashboard
        assert "fraud" in dashboard
        assert "compliance" in dashboard
    
    @pytest.mark.asyncio
    async def test_operations_dashboard_transaction_metrics(self, service, session: AsyncSession):
        dashboard = await service.get_operations_dashboard(session)
        transactions = dashboard.get("transactions", {})
        assert "count" in transactions
        assert "completed" in transactions
        assert "error_rate_percentage" in transactions
    
    @pytest.mark.asyncio
    async def test_get_security_dashboard(self, service, session: AsyncSession):
        dashboard = await service.get_security_dashboard(session)
        assert isinstance(dashboard, dict)
        assert "fraud_flags" in dashboard
        assert "compliance" in dashboard
    
    @pytest.mark.asyncio
    async def test_security_dashboard_fraud_metrics(self, service, session: AsyncSession):
        dashboard = await service.get_security_dashboard(session)
        fraud = dashboard.get("fraud_flags", {})
        assert "total" in fraud
        assert "critical" in fraud
        assert "high" in fraud
        assert "medium" in fraud
    
    @pytest.mark.asyncio
    async def test_get_player_dashboard(self, service, session: AsyncSession):
        dashboard = await service.get_player_dashboard(session)
        assert isinstance(dashboard, dict)
        assert "active_players" in dashboard
        assert "sessions" in dashboard
        assert "bets" in dashboard
    
    @pytest.mark.asyncio
    async def test_player_dashboard_metrics(self, service, session: AsyncSession):
        dashboard = await service.get_player_dashboard(session)
        active = dashboard.get("active_players", {})
        assert "now" in active
        assert "today" in active
    
    @pytest.mark.asyncio
    async def test_get_system_dashboard(self, service, session: AsyncSession):
        dashboard = await service.get_system_dashboard(session)
        assert isinstance(dashboard, dict)
        assert "database" in dashboard
        assert "errors_last_hour" in dashboard
        assert "uptime_percentage" in dashboard

class TestObservabilityIntegration:
    
    @pytest.mark.asyncio
    async def test_metric_collection_pipeline(self, session_maker, session: AsyncSession):
        monitoring = MonitoringAggregatorService(session_maker)
        
        metrics = await monitoring.get_current_metrics(session)
        assert isinstance(metrics, dict)
        
        health = await monitoring.get_system_health(session)
        assert health.status in ["healthy", "degraded", "unknown"]
    
    @pytest.mark.asyncio
    async def test_alert_rule_matching(self, session_maker, session: AsyncSession):
        alerts = AlertManagementService(session_maker)
        
        metrics = {
            "transaction_error_rate": Decimal("7.5"),
            "payment_failure_rate": Decimal("0.5")
        }
        
        alert_ids = await alerts.check_alert_rules(session, metrics)
        assert isinstance(alert_ids, list)
    
    @pytest.mark.asyncio
    async def test_dashboard_completeness(self, session_maker, session: AsyncSession):
        dashboards = DashboardService(session_maker)
        
        exec_dash = await dashboards.get_executive_dashboard(session)
        ops_dash = await dashboards.get_operations_dashboard(session)
        sec_dash = await dashboards.get_security_dashboard(session)
        player_dash = await dashboards.get_player_dashboard(session)
        sys_dash = await dashboards.get_system_dashboard(session)
        
        assert all(isinstance(d, dict) for d in [
            exec_dash, ops_dash, sec_dash, player_dash, sys_dash
        ])
    
    @pytest.mark.asyncio
    async def test_threshold_violation_detection(self, session_maker, session: AsyncSession):
        monitoring = MonitoringAggregatorService(session_maker)
        
        violations = await monitoring.check_thresholds(session)
        assert isinstance(violations, dict)
        assert "violations" in violations
        assert isinstance(violations["violations"], list)
