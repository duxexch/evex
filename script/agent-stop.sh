#!/bin/bash

# VEX Platform - Emergency Stop
# إيقاف طوارئ للوكيل

echo "🛑 إيقاف الوكيل الذكي..."

# إيقاف جميع عمليات الوكيل
pkill -f "agent-monitor.js" && echo "✅ تم إيقاف agent-monitor" || echo "ℹ️  لا توجد عملية agent-monitor"
pkill -f "agent-runner.sh" && echo "✅ تم إيقاف agent-runner" || echo "ℹ️  لا توجد عملية agent-runner"

# تعطيل الوكيل في الإعدادات
CONFIG_FILE=".agent-replit-config.json"

if [ -f "$CONFIG_FILE" ]; then
  # استخدام jq لتعطيل monitoring
  if command -v jq &> /dev/null; then
    jq '.monitoring.enabled = false' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo "✅ تم تعطيل الوكيل في الإعدادات"
  else
    echo "⚠️  jq غير متاح، لم يتم تحديث الإعدادات"
  fi
fi

echo "✅ تم إيقاف الوكيل بنجاح"
