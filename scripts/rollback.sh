#!/bin/bash
set -e
cd /var/www/vex
mkdir -p backups

echo "========================================"
echo "🔄 VEX Platform - Rollback Script"
echo "========================================"
echo ""

if [ ! -f backups/pre-deploy-commit.txt ]; then
    echo "❌ Error: No backup commit found"
    echo "   Make sure you ran the backup before deployment"
    exit 1
fi

PREV_COMMIT=$(cat backups/pre-deploy-commit.txt)
LATEST_BACKUP=$(ls -t backups/pre-deploy-*.sql 2>/dev/null | head -1)

echo "📋 Rollback Information:"
echo "   Previous commit: $PREV_COMMIT"
echo "   Latest DB backup: ${LATEST_BACKUP:-None found}"
echo ""

read -p "Proceed with code rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "📦 Rolling back code..."
git checkout $PREV_COMMIT

echo "📦 Reinstalling dependencies..."
npm ci --production=false
npm run build
npm prune --production

if [ -n "$LATEST_BACKUP" ]; then
    echo ""
    read -p "Rollback database too? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "⏳ Stopping application..."
        pm2 stop vex-platform
        
        echo "📦 Restoring database..."
        psql $DATABASE_URL < $LATEST_BACKUP
        
        echo "✅ Database restored from: $LATEST_BACKUP"
    fi
fi

echo ""
echo "🔄 Reloading PM2..."
pm2 reload vex-platform

echo ""
echo "⏳ Waiting for application to start..."
sleep 5

echo ""
echo "🏥 Checking health..."
HEALTH=$(curl -sf http://localhost:5050/api/health 2>/dev/null || echo "FAILED")

if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Application is healthy!"
else
    echo "⚠️  Health check failed. Check logs with: pm2 logs vex-platform"
fi

echo ""
echo "========================================"
echo "✅ Rollback complete!"
echo "========================================"
