#!/bin/bash

# VEX Platform - Agent Auto Runner
# تشغيل تلقائي للوكيل مع الجدولة

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_SCRIPT="$SCRIPT_DIR/agent-monitor.js"
CONFIG_FILE="$ROOT_DIR/.agent-replit-config.json"
LOG_FILE="$ROOT_DIR/logs/agent-runner.log"

# إنشاء مجلد logs إذا لم يكن موجوداً
mkdir -p "$ROOT_DIR/logs"

# دالة للتسجيل
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# التحقق من تفعيل الوكيل
if [ ! -f "$CONFIG_FILE" ]; then
  log "⚠️  ملف الإعدادات غير موجود: $CONFIG_FILE"
  exit 1
fi

# قراءة الإعدادات
ENABLED=$(jq -r '.monitoring.enabled // true' "$CONFIG_FILE")
INTERVAL=$(jq -r '.monitoring.interval // "2h"' "$CONFIG_FILE")

if [ "$ENABLED" != "true" ]; then
  log "ℹ️  الوكيل معطل في الإعدادات"
  exit 0
fi

log "🚀 بدء تشغيل الوكيل التلقائي"
log "📊 الفترة الزمنية: $INTERVAL"

# تحويل الفترة إلى ثواني
case $INTERVAL in
  *h)
    hours=${INTERVAL%h}
    seconds=$((hours * 3600))
    ;;
  *m)
    minutes=${INTERVAL%m}
    seconds=$((minutes * 60))
    ;;
  *)
    log "❌ فترة زمنية غير صحيحة: $INTERVAL"
    exit 1
    ;;
esac

# حلقة التشغيل
while true; do
  log "▶️  تشغيل الوكيل..."
  
  if node "$AGENT_SCRIPT"; then
    log "✅ اكتمل الفحص بنجاح"
  else
    log "❌ فشل الفحص"
  fi
  
  log "⏳ انتظار $INTERVAL قبل الفحص التالي..."
  sleep $seconds
done
