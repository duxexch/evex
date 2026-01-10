-- Phase 9.1: Post-Deployment Observability & Continuous Risk Monitoring
-- Migration: 003_add_observability_tables.sql

BEGIN;

-- Table: alerts
-- Real-time alert tracking and management
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    
    rule_name VARCHAR(255) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    
    value DECIMAL(15,2) NOT NULL,
    threshold DECIMAL(15,2) NOT NULL,
    
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
    status VARCHAR(20) NOT NULL DEFAULT 'triggered' CHECK (status IN (
        'triggered',
        'acknowledged',
        'resolved',
        'escalated'
    )),
    
    message TEXT,
    details JSONB,
    
    triggered_at TIMESTAMP NOT NULL,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    escalation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_severity (severity),
    INDEX idx_triggered_at (triggered_at),
    INDEX idx_rule (rule_name)
);

-- Table: metrics_history
-- Time-series metric data for graphing and analysis
CREATE TABLE IF NOT EXISTS metrics_history (
    id SERIAL PRIMARY KEY,
    
    metric_type VARCHAR(100) NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    tags JSONB,
    
    timestamp TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_type (metric_type),
    INDEX idx_timestamp (timestamp),
    INDEX idx_metric_timestamp (metric_type, timestamp)
);

-- Table: error_logs
-- Error tracking and analytics
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    
    service_name VARCHAR(100),
    endpoint VARCHAR(255),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'fatal')),
    
    context JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_error_type (error_type),
    INDEX idx_service (service_name),
    INDEX idx_created_at (created_at),
    INDEX idx_severity (severity)
);

-- Table: audit_events
-- Detailed audit trail for all operations
CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'create', 'read', 'update', 'delete',
        'approve', 'reject', 'approve_admin', 'reject_admin',
        'alert_triggered', 'alert_acknowledged', 'alert_resolved'
    )),
    
    details JSONB,
    changes JSONB,
    
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_admin_id (admin_id),
    INDEX idx_event_type (event_type),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Table: health_checks
-- Periodic health check results
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    
    latency_ms INTEGER,
    error_message TEXT,
    
    checked_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_component (component),
    INDEX idx_status (status),
    INDEX idx_checked_at (checked_at)
);

-- Table: performance_metrics
-- Performance tracking per endpoint/service
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    
    request_count INTEGER NOT NULL,
    total_duration_ms INTEGER NOT NULL,
    avg_duration_ms DECIMAL(10,2) NOT NULL,
    min_duration_ms INTEGER NOT NULL,
    max_duration_ms INTEGER NOT NULL,
    p50_ms DECIMAL(10,2),
    p95_ms DECIMAL(10,2),
    p99_ms DECIMAL(10,2),
    
    error_count INTEGER DEFAULT 0,
    error_rate DECIMAL(5,2) DEFAULT 0,
    
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_endpoint (endpoint),
    INDEX idx_period (period_start, period_end)
);

-- Table: compliance_events
-- Track compliance-related events
CREATE TABLE IF NOT EXISTS compliance_events (
    id SERIAL PRIMARY KEY,
    
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
        'kyc_submitted',
        'kyc_verified',
        'kyc_failed',
        'aml_flagged',
        'self_excluded',
        'exclusion_expired',
        'limit_exceeded',
        'limit_reset'
    )),
    
    details JSONB,
    
    triggered_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_triggered_at (triggered_at)
);

-- Table: risk_scores_history
-- Historical risk scores for users
CREATE TABLE IF NOT EXISTS risk_scores_history (
    id SERIAL PRIMARY KEY,
    
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    transaction_risk INTEGER,
    fraud_risk INTEGER,
    compliance_risk INTEGER,
    
    recommendation VARCHAR(50) CHECK (recommendation IN (
        'allow',
        'monitor',
        'restrict',
        'block'
    )),
    
    calculated_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_score (overall_score),
    INDEX idx_calculated_at (calculated_at)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_metrics_5min ON metrics_history(metric_type, timestamp) 
WHERE timestamp >= NOW() - INTERVAL '5 minutes';
CREATE INDEX IF NOT EXISTS idx_errors_recent ON error_logs(created_at) 
WHERE created_at >= NOW() - INTERVAL '24 hours';
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_events(admin_id, created_at);

COMMIT;
