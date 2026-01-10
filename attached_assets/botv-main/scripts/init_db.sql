#!/bin/bash

set -e

# Initialize database
echo "Initializing PostgreSQL database..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Enable JSON extension
    CREATE EXTENSION IF NOT EXISTS "json";
    
    -- Create audit schema
    CREATE SCHEMA IF NOT EXISTS audit;
    
    -- Create audit log function
    CREATE OR REPLACE FUNCTION audit.audit_trigger() RETURNS TRIGGER AS \$\$
    BEGIN
        INSERT INTO audit.logs (table_name, operation, old_data, new_data, user_id, created_at)
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            to_jsonb(OLD),
            to_jsonb(NEW),
            CURRENT_USER,
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    END;
    \$\$ LANGUAGE plpgsql;
    
    -- Create audit logs table
    CREATE TABLE IF NOT EXISTS audit.logs (
        id BIGSERIAL PRIMARY KEY,
        table_name VARCHAR(255),
        operation VARCHAR(10),
        old_data JSONB,
        new_data JSONB,
        user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit.logs(table_name);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit.logs(operation);

EOSQL

echo "Database initialization completed successfully!"
