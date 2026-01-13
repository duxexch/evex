#!/bin/sh
# VEX Platform - Docker Entrypoint Script
# Handles database migrations and startup

set -e

echo "========================================"
echo "🚀 VEX Platform - Starting Up"
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
echo "✅ SESSION_SECRET is set"

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

# Run database migrations using drizzle-kit
echo ""
echo "📦 Running database migrations..."

# Check if drizzle-kit is available
if ! command -v npx >/dev/null 2>&1; then
    echo "❌ ERROR: npx is not available"
    exit 1
fi

# Run migrations with visible output
if npx drizzle-kit push --force 2>&1; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed!"
    echo "   Check your schema and database connection"
    echo "   You may need to run migrations manually"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ All startup tasks completed!"
echo "🎮 Starting VEX Platform server..."
echo "========================================"
echo ""

# Start the application
exec node dist/index.cjs
