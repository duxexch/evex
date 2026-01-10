from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy import event, create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import time

logger = logging.getLogger(__name__)

@dataclass
class QueryMetrics:
    query: str
    duration_ms: float
    rows_affected: int
    timestamp: datetime
    is_slow: bool

@dataclass
class IndexRecommendation:
    table: str
    column: str
    reason: str
    expected_improvement: str
    priority: str

@dataclass
class CacheStrategy:
    key: str
    ttl_seconds: int
    invalidation_triggers: List[str]
    data_size_estimate: str

class PerformanceOptimizationService:
    def __init__(self, session_maker):
        self.session_maker = session_maker
        self.slow_query_threshold_ms = 1000
        self.query_metrics = []

    async def analyze_slow_queries(
        self,
        session: AsyncSession,
        limit: int = 50
    ) -> List[QueryMetrics]:
        try:
            metrics = self.query_metrics[-limit:]
            slow_queries = [m for m in metrics if m.is_slow]
            return sorted(slow_queries, key=lambda x: x.duration_ms, reverse=True)
        except Exception as e:
            logger.error(f"Error analyzing slow queries: {str(e)}")
            return []

    def get_index_recommendations(self) -> List[IndexRecommendation]:
        recommendations = [
            IndexRecommendation(
                table="users",
                column="last_login",
                reason="Frequently used in activity status queries (Phase 9.1)",
                expected_improvement="40-50% faster active user queries",
                priority="HIGH"
            ),
            IndexRecommendation(
                table="transactions",
                column="(user_id, created_at)",
                reason="Composite index for transaction history queries (Phase 9.2)",
                expected_improvement="30-40% faster transaction metrics",
                priority="HIGH"
            ),
            IndexRecommendation(
                table="fraud_flags",
                column="(user_id, created_at)",
                reason="Composite index for fraud trend analysis (Phase 9.2-9.3)",
                expected_improvement="35-45% faster fraud queries",
                priority="HIGH"
            ),
            IndexRecommendation(
                table="game_results",
                column="(user_id, created_at)",
                reason="Composite for game history and cohort analysis (Phase 9.3)",
                expected_improvement="25-35% faster game metrics",
                priority="MEDIUM"
            ),
            IndexRecommendation(
                table="alerts",
                column="(status, severity, triggered_at)",
                reason="Active alert filtering (Phase 9.1)",
                expected_improvement="50-60% faster alert queries",
                priority="HIGH"
            ),
            IndexRecommendation(
                table="metrics_history",
                column="(metric_type, timestamp)",
                reason="Timeseries data retrieval (Phase 9.1)",
                expected_improvement="40-50% faster metric queries",
                priority="MEDIUM"
            ),
            IndexRecommendation(
                table="risk_scores_history",
                column="(user_id, calculated_at)",
                reason="Risk trend analysis (Phase 9.2)",
                expected_improvement="30-40% faster trend queries",
                priority="MEDIUM"
            ),
            IndexRecommendation(
                table="audit_events",
                column="(created_at, admin_id)",
                reason="Audit trail queries (System)",
                expected_improvement="25-35% faster audit queries",
                priority="LOW"
            )
        ]
        return recommendations

    def get_caching_strategies(self) -> Dict[str, CacheStrategy]:
        strategies = {
            "system_health": CacheStrategy(
                key="cache:system_health",
                ttl_seconds=300,
                invalidation_triggers=["metric_updated", "alert_triggered"],
                data_size_estimate="<1KB"
            ),
            "dashboard_executive": CacheStrategy(
                key="cache:dashboard:executive",
                ttl_seconds=3600,
                invalidation_triggers=["transaction_completed", "user_created"],
                data_size_estimate="5-10KB"
            ),
            "dashboard_operations": CacheStrategy(
                key="cache:dashboard:operations",
                ttl_seconds=600,
                invalidation_triggers=["transaction_created", "payment_created"],
                data_size_estimate="8-15KB"
            ),
            "dashboard_security": CacheStrategy(
                key="cache:dashboard:security",
                ttl_seconds=1800,
                invalidation_triggers=["fraud_flag_created", "compliance_event"],
                data_size_estimate="5-12KB"
            ),
            "user_risk_score": CacheStrategy(
                key="cache:risk:user:{user_id}",
                ttl_seconds=600,
                invalidation_triggers=["transaction_created", "fraud_flag_created"],
                data_size_estimate="<1KB"
            ),
            "user_behavior_profile": CacheStrategy(
                key="cache:analytics:user:{user_id}",
                ttl_seconds=3600,
                invalidation_triggers=["game_result", "user_login"],
                data_size_estimate="2-5KB"
            ),
            "cohort_analysis": CacheStrategy(
                key="cache:analytics:cohorts",
                ttl_seconds=86400,
                invalidation_triggers=["user_created", "bulk_scoring"],
                data_size_estimate="50-100KB"
            ),
            "alert_statistics": CacheStrategy(
                key="cache:alerts:stats",
                ttl_seconds=1800,
                invalidation_triggers=["alert_resolved", "alert_escalated"],
                data_size_estimate="5-8KB"
            ),
            "metrics_timeseries": CacheStrategy(
                key="cache:metrics:ts:{metric_type}:{minutes}",
                ttl_seconds=300,
                invalidation_triggers=["metric_logged"],
                data_size_estimate="10-50KB"
            ),
            "user_segments": CacheStrategy(
                key="cache:analytics:segments",
                ttl_seconds=7200,
                invalidation_triggers=["churn_prediction", "cohort_change"],
                data_size_estimate="100-500KB"
            )
        }
        return strategies

    def get_scaling_recommendations(self) -> Dict[str, any]:
        recommendations = {
            "read_replicas": {
                "recommended": True,
                "count": 2,
                "use_case": "Analytics queries (Phase 9.1-9.4) to separate from OLTP",
                "estimated_cost_reduction": "20-30% latency improvement"
            },
            "connection_pooling": {
                "recommended": True,
                "pool_size": 20,
                "max_overflow": 10,
                "use_case": "Handle concurrent dashboard and API queries",
                "estimated_benefit": "Reduce connection overhead by 40%"
            },
            "materialized_views": {
                "recommended": True,
                "candidates": [
                    "mv_cohort_summary (refresh hourly)",
                    "mv_active_alerts (refresh every 5 min)",
                    "mv_risk_summary (refresh every 10 min)",
                    "mv_daily_metrics (refresh daily)"
                ],
                "estimated_improvement": "50-70% query time reduction"
            },
            "partitioning": {
                "recommended": True,
                "strategy": "Time-based partitioning",
                "tables": [
                    "metrics_history (monthly)",
                    "audit_events (monthly)",
                    "alerts (quarterly)",
                    "error_logs (monthly)"
                ],
                "benefit": "Faster queries on recent data, easier archival"
            },
            "vertical_scaling": {
                "recommended_when": "Read/write volume exceeds 5000 QPS",
                "suggested_instances": ["r6i.2xlarge", "r6i.4xlarge"],
                "memory_increase": "256GB → 512GB+"
            },
            "horizontal_scaling": {
                "recommended_when": "Single instance reaches 70% CPU",
                "strategy": "Read replicas for analytics, primary for writes",
                "sharding_strategy": "By user_id for user-centric data"
            }
        }
        return recommendations

    async def get_query_execution_plan(
        self,
        session: AsyncSession,
        query: str
    ) -> Optional[Dict]:
        try:
            result = await session.execute(text(f"EXPLAIN ANALYZE {query}"))
            plan = result.fetchall()
            return {"plan": [str(row) for row in plan]}
        except Exception as e:
            logger.error(f"Error getting execution plan: {str(e)}")
            return None

    def get_optimization_roadmap(self) -> List[Dict]:
        roadmap = [
            {
                "phase": 1,
                "duration": "Week 1-2",
                "priority": "CRITICAL",
                "tasks": [
                    "Create high-priority indexes (users.last_login, transactions composite)",
                    "Implement Redis caching for dashboard endpoints",
                    "Add query monitoring and slow query log analysis"
                ],
                "expected_improvement": "30-40% latency reduction"
            },
            {
                "phase": 2,
                "duration": "Week 3-4",
                "priority": "HIGH",
                "tasks": [
                    "Create medium-priority indexes",
                    "Implement materialized views for cohort analysis",
                    "Set up connection pooling",
                    "Optimize alert query performance"
                ],
                "expected_improvement": "50-60% latency reduction"
            },
            {
                "phase": 3,
                "duration": "Week 5-6",
                "priority": "MEDIUM",
                "tasks": [
                    "Deploy read replicas for analytics workload",
                    "Implement table partitioning strategy",
                    "Set up automated index maintenance",
                    "Create archival process for old data"
                ],
                "expected_improvement": "70-80% latency reduction"
            },
            {
                "phase": 4,
                "duration": "Week 7-8",
                "priority": "LOW",
                "tasks": [
                    "Evaluate sharding based on growth metrics",
                    "Implement predictive caching",
                    "Optimize cold-path queries",
                    "Document all optimizations"
                ],
                "expected_improvement": "80-90% latency reduction"
            }
        ]
        return roadmap

    async def estimate_capacity(self) -> Dict:
        estimates = {
            "current_database_size": "2-5 GB",
            "projected_6_months": "5-8 GB",
            "projected_1_year": "10-15 GB",
            "growth_rate": "1.5-2 GB per quarter",
            "retention_impact": {
                "metrics_history_90days": "500 MB - 1 GB",
                "alerts_12months": "100-200 MB",
                "audit_events_12months": "200-400 MB",
                "error_logs_30days": "50-100 MB"
            },
            "scaling_triggers": {
                "database": "When reaching 70% disk usage (~7-8 GB)",
                "connections": "When exceeding 80 active connections",
                "qps": "When reads/writes exceed 5000 QPS",
                "latency": "When p99 latency exceeds 500ms consistently"
            }
        }
        return estimates

    def get_sql_optimization_examples(self) -> Dict[str, Dict]:
        examples = {
            "transaction_metrics_slow": {
                "original": """
                    SELECT COUNT(*), SUM(amount) 
                    FROM transactions 
                    WHERE user_id = 123 AND created_at >= NOW() - INTERVAL 1 HOUR
                """,
                "optimized": """
                    SELECT COUNT(*), SUM(amount) 
                    FROM transactions 
                    WHERE created_at >= NOW() - INTERVAL 1 HOUR 
                    AND user_id = 123
                    -- Index: (created_at, user_id)
                """,
                "improvement": "Index selectivity: 40-50% reduction"
            },
            "active_alerts_slow": {
                "original": """
                    SELECT * FROM alerts 
                    WHERE status IN ('triggered', 'acknowledged')
                    ORDER BY triggered_at DESC
                """,
                "optimized": """
                    SELECT * FROM alerts 
                    WHERE status IN ('triggered', 'acknowledged')
                    AND triggered_at >= NOW() - INTERVAL 24 HOURS
                    ORDER BY triggered_at DESC
                    -- Index: (status, severity, triggered_at)
                """,
                "improvement": "Reduced table scan: 60-70% faster"
            },
            "user_cohort_slow": {
                "original": """
                    SELECT user_id, COUNT(*) as sessions
                    FROM game_results
                    GROUP BY user_id
                    HAVING COUNT(*) > 50
                """,
                "optimized": """
                    -- Use materialized view
                    SELECT user_id, session_count
                    FROM mv_cohort_summary
                    WHERE session_count > 50
                """,
                "improvement": "Materialized view: 70-80% faster"
            }
        }
        return examples

    async def log_query_metric(
        self,
        query: str,
        duration_ms: float,
        rows_affected: int = 0
    ) -> None:
        try:
            is_slow = duration_ms > self.slow_query_threshold_ms
            metric = QueryMetrics(
                query=query[:200],  # Truncate for storage
                duration_ms=duration_ms,
                rows_affected=rows_affected,
                timestamp=datetime.utcnow(),
                is_slow=is_slow
            )
            self.query_metrics.append(metric)
            
            if is_slow:
                logger.warning(f"Slow query: {duration_ms}ms - {query[:100]}")
        except Exception as e:
            logger.error(f"Error logging query metric: {str(e)}")
