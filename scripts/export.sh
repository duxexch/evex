#!/bin/bash

# VEX Platform - Export Script
# سكربت تصدير منصة VEX

set -e

echo "=========================================="
echo "   VEX Platform - Export Tool"
echo "   أداة تصدير منصة VEX"
echo "=========================================="

# Create export directory
EXPORT_DIR="vex_export_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"

echo "Checking required tools... / جاري التحقق من الأدوات المطلوبة..."

# Check for required tools
for tool in rsync gzip tar; do
    if ! command -v $tool &> /dev/null; then
        echo "Error: $tool is not installed. Please install it first."
        echo "خطأ: $tool غير مثبت. يرجى تثبيته أولاً."
        exit 1
    fi
done

echo "Exporting project files... / جاري تصدير ملفات المشروع..."

# Copy project files (excluding node_modules and other unnecessary files)
rsync -av --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude '.cache' \
    --exclude '*.log' \
    --exclude '.env' \
    --exclude 'vex_export_*' \
    ./ "$EXPORT_DIR/"

# Export database if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    if command -v pg_dump &> /dev/null; then
        echo "Exporting database... / جاري تصدير قاعدة البيانات..."
        pg_dump "$DATABASE_URL" > "$EXPORT_DIR/database_backup.sql"
        gzip "$EXPORT_DIR/database_backup.sql"
        echo "Database exported to: $EXPORT_DIR/database_backup.sql.gz"
    else
        echo "Warning: pg_dump not found. Skipping database export."
        echo "تحذير: pg_dump غير موجود. تخطي تصدير قاعدة البيانات."
    fi
fi

# Create compressed archive
echo "Creating archive... / جاري إنشاء الأرشيف..."
tar -czvf "${EXPORT_DIR}.tar.gz" "$EXPORT_DIR"

# Calculate size
SIZE=$(du -sh "${EXPORT_DIR}.tar.gz" | cut -f1)

echo "=========================================="
echo "Export complete! / اكتمل التصدير!"
echo "=========================================="
echo ""
echo "Archive: ${EXPORT_DIR}.tar.gz"
echo "Size: $SIZE"
echo ""
echo "To download, use SFTP or SCP:"
echo "scp user@server:$(pwd)/${EXPORT_DIR}.tar.gz ./"

# Cleanup
rm -rf "$EXPORT_DIR"
