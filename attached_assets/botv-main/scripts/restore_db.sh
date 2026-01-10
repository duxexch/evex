#!/bin/bash

# Restore script for PostgreSQL database
# Usage: ./restore_db.sh backup_file.sql.gz

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 backup_file.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📥 Starting database restore..."
echo "Backup file: $BACKUP_FILE"

# Decompress and restore
gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql \
    -U langsense \
    -d langsense_db \
    --no-password \
    --verbose

echo "✅ Database restore completed successfully"
