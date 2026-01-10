#!/bin/bash

# Initialize infrastructure from scratch
# This script removes all containers, volumes, and rebuilds everything

set -e

echo "⚠️  WARNING: This will remove all containers and volumes!"
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

echo "🔴 Stopping containers..."
docker-compose down

echo "🗑️  Removing volumes..."
docker-compose down -v

echo "🐳 Building fresh containers..."
docker-compose build --no-cache

echo "✅ Pulling latest images..."
docker-compose pull

echo "🚀 Starting fresh infrastructure..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

echo ""
echo "🔍 Checking health status..."
bash scripts/health_check.sh

echo ""
echo "================================"
echo "  Infrastructure Reinitialized!"
echo "================================"
echo ""
echo "Your services are now running:"
echo "- API: http://localhost:8000/api/v1/docs"
echo "- PostgreSQL: localhost:5432"
echo "- Redis: localhost:6379"
echo "- Telegram Bot: running in background"
echo ""
