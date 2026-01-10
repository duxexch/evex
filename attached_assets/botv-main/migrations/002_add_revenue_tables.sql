-- Phase 8: Business-Critical Hardening & Revenue Protection
-- Migration: 002_add_revenue_tables.sql

BEGIN;

-- Table: user_limits
-- Stores per-user configured limits for responsible gaming
CREATE TABLE IF NOT EXISTS user_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Deposit limits
    daily_deposit_limit DECIMAL(15,2) NOT NULL DEFAULT 10000,
    weekly_deposit_limit DECIMAL(15,2) NOT NULL DEFAULT 50000,
    
    -- Loss limits
    daily_loss_limit DECIMAL(15,2) NOT NULL DEFAULT 500,
    weekly_loss_limit DECIMAL(15,2) NOT NULL DEFAULT 2000,
    monthly_loss_limit DECIMAL(15,2) NOT NULL DEFAULT 5000,
    
    -- Betting limits
    max_bet_amount DECIMAL(15,2) NOT NULL DEFAULT 1000,
    max_payout_amount DECIMAL(15,2) NOT NULL DEFAULT 100000,
    
    -- Time limits
    session_timeout_minutes INTEGER NOT NULL DEFAULT 120,
    withdrawal_cooldown_seconds INTEGER NOT NULL DEFAULT 86400,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- Table: self_exclusions
-- Self-exclusion records for responsible gaming
CREATE TABLE IF NOT EXISTS self_exclusions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    exclusion_type VARCHAR(20) NOT NULL CHECK (exclusion_type IN ('temporary', 'extended', 'permanent')),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_active (is_active),
    UNIQUE(user_id, is_active)
);

-- Table: fraud_flags
-- Fraud detection anomaly records
CREATE TABLE IF NOT EXISTS fraud_flags (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN (
        'impossible_outcome',
        'velocity_spike',
        'pattern_abuse',
        'account_link',
        'winning_streak',
        'large_win',
        'rapid_withdrawal'
    )),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    details JSONB,
    
    flagged_at TIMESTAMP NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_score (score),
    INDEX idx_resolved (resolved)
);

-- Table: payments
-- Payment processing records
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    provider VARCHAR(50) NOT NULL CHECK (provider IN (
        'stripe',
        'paypal',
        'crypto',
        'wire_transfer',
        'card'
    )),
    
    status VARCHAR(30) NOT NULL DEFAULT 'initiated' CHECK (status IN (
        'initiated',
        'processing',
        'completed',
        'failed',
        'pending_review',
        'cancelled'
    )),
    
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    provider_confirmation VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_transaction_id (transaction_id)
);

-- Table: financial_snapshots
-- Point-in-time financial metrics
CREATE TABLE IF NOT EXISTS financial_snapshots (
    id SERIAL PRIMARY KEY,
    
    snapshot_date DATE NOT NULL UNIQUE,
    
    -- Aggregated metrics
    total_deposits DECIMAL(15,2) DEFAULT 0,
    total_payouts DECIMAL(15,2) DEFAULT 0,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_withdrawals DECIMAL(15,2) DEFAULT 0,
    
    net_revenue DECIMAL(15,2) DEFAULT 0,
    gross_revenue DECIMAL(15,2) DEFAULT 0,
    
    user_count INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_balance DECIMAL(15,2) DEFAULT 0,
    
    avg_bet DECIMAL(15,2) DEFAULT 0,
    house_edge_pct DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (snapshot_date)
);

-- Table: settlement_batches
-- Payment settlement batches
CREATE TABLE IF NOT EXISTS settlement_batches (
    id SERIAL PRIMARY KEY,
    
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'batched',
        'submitted',
        'completed',
        'failed'
    )),
    
    total_amount DECIMAL(15,2) NOT NULL,
    payment_count INTEGER NOT NULL,
    
    batch_reference VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    INDEX idx_provider (provider),
    INDEX idx_status (status)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_games_user_created ON games(user_id, created_at);

-- Update users table if needed (add missing fields)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS kyc_data JSONB,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(30) DEFAULT 'pending' CHECK (compliance_status IN ('verified', 'pending', 'failed', 'self_excluded', 'suspended'));

COMMIT;
