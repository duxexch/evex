#!/bin/sh
# VEX Platform - Docker Entrypoint Script
# Production-safe database migrations and startup
# آخر تحديث: يناير 2026

set -e

echo "========================================"
echo "🚀 VEX Platform - Starting Up"
echo "   Environment: ${NODE_ENV:-development}"
echo "   Version: 1.0.0"
echo "   Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# Validate required environment variables
echo ""
echo "📋 Validating environment..."

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is required"
    echo "   Please set DATABASE_URL in your .env file or docker-compose.yml"
    exit 1
fi
echo "✅ DATABASE_URL is set"

if [ -z "$SESSION_SECRET" ]; then
    echo "❌ ERROR: SESSION_SECRET environment variable is required"
    echo "   Generate one with: openssl rand -hex 32"
    exit 1
fi

# Validate SESSION_SECRET strength in production
if [ "$NODE_ENV" = "production" ]; then
    SECRET_LENGTH=${#SESSION_SECRET}
    if [ "$SECRET_LENGTH" -lt 32 ]; then
        echo "❌ ERROR: SESSION_SECRET must be at least 32 characters in production"
        echo "   Current length: $SECRET_LENGTH"
        echo "   Generate one with: openssl rand -hex 32"
        exit 1
    fi
fi
echo "✅ SESSION_SECRET is set"

# Validate JWT_SIGNING_KEY (required for user authentication)
if [ -z "$JWT_SIGNING_KEY" ]; then
    echo "❌ ERROR: JWT_SIGNING_KEY environment variable is required"
    echo "   Generate one with: openssl rand -hex 64"
    exit 1
fi
if [ "$NODE_ENV" = "production" ]; then
    JWT_LENGTH=${#JWT_SIGNING_KEY}
    if [ "$JWT_LENGTH" -lt 32 ]; then
        echo "❌ ERROR: JWT_SIGNING_KEY must be at least 32 characters in production"
        echo "   Current length: $JWT_LENGTH"
        echo "   Generate one with: openssl rand -hex 64"
        exit 1
    fi
fi
echo "✅ JWT_SIGNING_KEY is set"

# Validate ADMIN_JWT_SECRET (required for admin authentication)
if [ -z "$ADMIN_JWT_SECRET" ]; then
    echo "❌ ERROR: ADMIN_JWT_SECRET environment variable is required"
    echo "   Generate one with: openssl rand -hex 64"
    exit 1
fi
if [ "$NODE_ENV" = "production" ]; then
    ADMIN_JWT_LENGTH=${#ADMIN_JWT_SECRET}
    if [ "$ADMIN_JWT_LENGTH" -lt 32 ]; then
        echo "❌ ERROR: ADMIN_JWT_SECRET must be at least 32 characters in production"
        echo "   Current length: $ADMIN_JWT_LENGTH"
        echo "   Generate one with: openssl rand -hex 64"
        exit 1
    fi
fi
echo "✅ ADMIN_JWT_SECRET is set"

# Warn about ALLOW_FORCE_MIGRATIONS in production
if [ "$NODE_ENV" = "production" ] && [ "$ALLOW_FORCE_MIGRATIONS" = "true" ]; then
    echo "⚠️  WARNING: ALLOW_FORCE_MIGRATIONS is enabled in production!"
    echo "   This can cause data loss. Only use for initial deployment or"
    echo "   when you understand the schema changes being applied."
    echo "   Continuing in 5 seconds..."
    sleep 5
fi

# Extract database connection info from DATABASE_URL if individual vars not set
if [ -z "$PGHOST" ]; then
    export PGHOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')
    export PGPORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    export PGUSER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    export PGDATABASE=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
fi

# Default port if not extracted
PGPORT="${PGPORT:-5432}"

echo ""
echo "📡 Database Connection Info:"
echo "   Host: $PGHOST"
echo "   Port: $PGPORT"
echo "   Database: $PGDATABASE"

# Wait for database to be ready
echo ""
echo "⏳ Waiting for database connection..."
max_retries=30
counter=0
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" 2>/dev/null; do
    counter=$((counter + 1))
    if [ $counter -gt $max_retries ]; then
        echo "❌ Database connection timeout after $max_retries attempts"
        echo "   Check your DATABASE_URL and ensure PostgreSQL is running"
        exit 1
    fi
    echo "   Attempt $counter/$max_retries - waiting for database..."
    sleep 2
done
echo "✅ Database connection established!"

# Database migration strategy
echo ""
echo "📦 Running database migrations..."

# Check if drizzle-kit is available
if ! command -v npx >/dev/null 2>&1; then
    echo "❌ ERROR: npx is not available"
    exit 1
fi

# Production: Safe migrations only (no --force)
# Development: Allow schema push with force
if [ "$NODE_ENV" = "production" ]; then
    echo "   ⚠️  Production mode: Running safe migrations only"
    echo "   To apply breaking changes, set ALLOW_FORCE_MIGRATIONS=true"
    
    if [ "$ALLOW_FORCE_MIGRATIONS" = "true" ]; then
        echo "   🔓 ALLOW_FORCE_MIGRATIONS enabled - proceeding with force push"
        if npx drizzle-kit push --force 2>&1; then
            echo "✅ Database migrations completed successfully"
        else
            echo "❌ Database migrations failed!"
            echo "   Review the error above and fix schema issues"
            exit 1
        fi
    else
        # Try without force first - will fail on breaking changes
        if npx drizzle-kit push 2>&1; then
            echo "✅ Database migrations completed successfully"
        else
            echo "⚠️  Migration requires manual review (breaking changes detected)"
            echo "   Options:"
            echo "   1. Review changes: npx drizzle-kit generate"
            echo "   2. Force apply (DANGER): Set ALLOW_FORCE_MIGRATIONS=true"
            echo "   3. Apply manually via SQL"
            exit 1
        fi
    fi
else
    # Development: allow force push
    echo "   Development mode: Applying schema changes..."
    if npx drizzle-kit push 2>&1; then
        echo "✅ Database migrations completed successfully"
    else
        echo "⚠️  Standard push failed, trying with --force for development..."
        if npx drizzle-kit push --force 2>&1; then
            echo "✅ Database migrations completed with --force"
        else
            echo "❌ Database migrations failed!"
            exit 1
        fi
    fi
fi

# Run database seeding if enabled
if [ "$SEED_DATABASE" = "true" ]; then
    echo ""
    echo "🌱 Seeding database..."
    # Try compiled JS first, fall back to tsx for TS
    if [ -f "dist/scripts/seed-data.js" ]; then
        if node dist/scripts/seed-data.js 2>&1; then
            echo "✅ Database seeding completed"
        else
            echo "⚠️  Database seeding failed (non-fatal)"
        fi
    elif command -v npx >/dev/null 2>&1; then
        if npx --yes tsx scripts/seed-data.ts 2>&1; then
            echo "✅ Database seeding completed"
        else
            echo "⚠️  Database seeding failed (non-fatal)"
        fi
    else
        echo "⚠️  Skipping seeding: no tsx available and no compiled seed script"
    fi
fi

echo ""
echo "========================================"
echo "✅ All startup tasks completed!"
echo "🎮 Starting VEX Platform server..."
echo "   Port: ${PORT:-5000}"
echo "   Games: Chess, Backgammon, Domino, Tarneeb, Baloot"
echo "   Features: P2P Trading, VIX Coin, Watch & Win"
echo "========================================"
echo ""

# Start the application with proper signal handling
exec node dist/index.cjs
