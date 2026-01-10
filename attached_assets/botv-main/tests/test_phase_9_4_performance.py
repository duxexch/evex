import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from services.performance_optimization_service import (
    PerformanceOptimizationService,
    QueryMetrics,
    IndexRecommendation,
    CacheStrategy
)

class TestPerformanceOptimizationService:
    
    @pytest.fixture
    async def service(self, session_maker):
        return PerformanceOptimizationService(session_maker)
    
    @pytest.mark.asyncio
    async def test_analyze_slow_queries(self, service, session: AsyncSession):
        metrics = await service.analyze_slow_queries(session, 10)
        assert isinstance(metrics, list)
    
    def test_get_index_recommendations(self, service):
        recommendations = service.get_index_recommendations()
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        
        for rec in recommendations:
            assert hasattr(rec, 'table')
            assert hasattr(rec, 'column')
            assert hasattr(rec, 'reason')
            assert rec.priority in ["HIGH", "MEDIUM", "LOW"]
    
    def test_index_recommendations_coverage(self, service):
        recommendations = service.get_index_recommendations()
        tables = [r.table for r in recommendations]
        
        expected_tables = [
            "users", "transactions", "fraud_flags", 
            "game_results", "alerts", "metrics_history"
        ]
        
        for table in expected_tables:
            assert table in tables, f"Missing recommendations for {table}"
    
    def test_high_priority_indexes(self, service):
        recommendations = service.get_index_recommendations()
        high_priority = [r for r in recommendations if r.priority == "HIGH"]
        
        assert len(high_priority) >= 3
        tables = [r.table for r in high_priority]
        assert "users" in tables
        assert "transactions" in tables
    
    def test_get_caching_strategies(self, service):
        strategies = service.get_caching_strategies()
        assert isinstance(strategies, dict)
        assert len(strategies) > 0
        
        for key, strategy in strategies.items():
            assert isinstance(strategy, CacheStrategy)
            assert strategy.ttl_seconds > 0
            assert isinstance(strategy.invalidation_triggers, list)
    
    def test_cache_ttl_hierarchy(self, service):
        strategies = service.get_caching_strategies()
        
        dashboard_ops = strategies.get("dashboard_operations")
        dashboard_exec = strategies.get("dashboard_executive")
        
        assert dashboard_ops.ttl_seconds < dashboard_exec.ttl_seconds
    
    def test_get_scaling_recommendations(self, service):
        recommendations = service.get_scaling_recommendations()
        assert isinstance(recommendations, dict)
        
        assert "read_replicas" in recommendations
        assert "connection_pooling" in recommendations
        assert "materialized_views" in recommendations
    
    def test_get_optimization_roadmap(self, service):
        roadmap = service.get_optimization_roadmap()
        assert isinstance(roadmap, list)
        assert len(roadmap) == 4
        
        for phase in roadmap:
            assert "phase" in phase
            assert "duration" in phase
            assert "tasks" in phase
            assert "expected_improvement" in phase
    
    def test_roadmap_phases_sequential(self, service):
        roadmap = service.get_optimization_roadmap()
        
        for i, phase in enumerate(roadmap):
            assert phase["phase"] == i + 1
    
    @pytest.mark.asyncio
    async def test_estimate_capacity(self, service):
        estimates = await service.estimate_capacity()
        assert isinstance(estimates, dict)
        
        assert "current_database_size" in estimates
        assert "projected_6_months" in estimates
        assert "growth_rate" in estimates
        assert "scaling_triggers" in estimates
    
    def test_get_sql_optimization_examples(self, service):
        examples = service.get_sql_optimization_examples()
        assert isinstance(examples, dict)
        assert len(examples) > 0
        
        for key, example in examples.items():
            assert "original" in example
            assert "optimized" in example
            assert "improvement" in example
    
    @pytest.mark.asyncio
    async def test_log_query_metric(self, service):
        await service.log_query_metric(
            "SELECT * FROM users WHERE id = 1",
            150.0,
            rows_affected=1
        )
        
        assert len(service.query_metrics) > 0
    
    @pytest.mark.asyncio
    async def test_log_slow_query_metric(self, service):
        await service.log_query_metric(
            "SELECT * FROM large_table WHERE status = 'pending'",
            2000.0,
            rows_affected=500
        )
        
        slow_queries = [m for m in service.query_metrics if m.is_slow]
        assert len(slow_queries) > 0

class TestIndexRecommendationQuality:
    
    @pytest.fixture
    async def service(self, session_maker):
        return PerformanceOptimizationService(session_maker)
    
    def test_recommendations_have_clear_reasoning(self, service):
        recommendations = service.get_index_recommendations()
        
        for rec in recommendations:
            assert len(rec.reason) > 10
            assert len(rec.expected_improvement) > 10
    
    def test_recommendations_cite_phases(self, service):
        recommendations = service.get_index_recommendations()
        
        phase_citations = 0
        for rec in recommendations:
            if "Phase" in rec.reason:
                phase_citations += 1
        
        assert phase_citations > 0

class TestCachingStrategyValidity:
    
    @pytest.fixture
    async def service(self, session_maker):
        return PerformanceOptimizationService(session_maker)
    
    def test_all_caches_have_invalidation(self, service):
        strategies = service.get_caching_strategies()
        
        for strategy in strategies.values():
            assert len(strategy.invalidation_triggers) > 0
    
    def test_ttl_values_reasonable(self, service):
        strategies = service.get_caching_strategies()
        
        for strategy in strategies.values():
            assert strategy.ttl_seconds > 0
            assert strategy.ttl_seconds <= 86400 * 7  # Max 1 week

class TestScalingRecommendations:
    
    @pytest.fixture
    async def service(self, session_maker):
        return PerformanceOptimizationService(session_maker)
    
    def test_read_replicas_recommendation(self, service):
        recommendations = service.get_scaling_recommendations()
        assert recommendations["read_replicas"]["recommended"] is True
    
    def test_materialized_views_candidates(self, service):
        recommendations = service.get_scaling_recommendations()
        candidates = recommendations["materialized_views"]["candidates"]
        
        assert len(candidates) > 0
        assert any("cohort" in c.lower() for c in candidates)
    
    def test_partitioning_strategy_defined(self, service):
        recommendations = service.get_scaling_recommendations()
        assert "partitioning" in recommendations
        assert recommendations["partitioning"]["strategy"] == "Time-based partitioning"

class TestOptimizationRoadmapReality:
    
    @pytest.fixture
    async def service(self, session_maker):
        return PerformanceOptimizationService(session_maker)
    
    def test_roadmap_has_realistic_timeline(self, service):
        roadmap = service.get_optimization_roadmap()
        
        for phase in roadmap:
            assert "Week" in phase["duration"]
    
    def test_roadmap_tasks_are_concrete(self, service):
        roadmap = service.get_optimization_roadmap()
        
        for phase in roadmap:
            for task in phase["tasks"]:
                assert len(task) > 10
                assert "(" not in task or ")" in task
    
    def test_improvement_percentages_increase(self, service):
        roadmap = service.get_optimization_roadmap()
        
        improvements = []
        for phase in roadmap:
            text = phase["expected_improvement"]
            if "-" in text:
                values = text.split("%")[0].split("-")
                improvements.append(int(values[1]))
        
        assert improvements == sorted(improvements)
