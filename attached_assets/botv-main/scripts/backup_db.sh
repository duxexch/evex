#!/bin/bash

# Backup script for PostgreSQL database
# Usage: ./backup_db.sh [backup_dir]

set -e

BACKUP_DIR="${1:-.backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/langsense_backup_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📦 Starting database backup..."
echo "Backup file: $BACKUP_FILE"

# Dump database
docker-compose exec -T postgres pg_dump \
    -U langsense \
    -d langsense_db \
    --no-password \
    --verbose \
    | gzip > "$BACKUP_FILE"

echo "✅ Database backup completed successfully"
echo "Size: $(du -h $BACKUP_FILE | cut -f1)"

# Upload to S3 if configured
if [ -n "$AWS_S3_BUCKET" ]; then
    echo "☁️ Uploading backup to S3..."
    aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/"
    echo "✅ S3 upload completed"
fi

# Cleanup old backups (keep only last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "langsense_backup_*.sql.gz" -mtime +7 -delete

echo "✅ Backup process completed"
