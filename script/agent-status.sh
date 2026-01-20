#!/bin/bash

# VEX Platform - Generate Agent Status Report
# توليد تقرير حالة مختصر للوكيل

echo "📊 تقرير حالة الوكيل الذكي"
echo "======================================"
echo ""

# 1. معلومات الإصدار
if [ -f ".agent-replit-config.json" ]; then
  VERSION=$(jq -r '.version // "غير محدد"' .agent-replit-config.json)
  MODE=$(jq -r '.mode // "غير محدد"' .agent-replit-config.json)
  ENABLED=$(jq -r '.monitoring.enabled // false' .agent-replit-config.json)
  
  echo "🔧 الإعدادات:"
  echo "  الإصدار: $VERSION"
  echo "  الوضع: $MODE"
  echo "  مفعّل: $ENABLED"
  echo ""
else
  echo "❌ ملف الإعدادات غير موجود!"
  exit 1
fi

# 2. آخر تقرير
LATEST_REPORT=$(ls -t logs/agent-report-*.json 2>/dev/null | head -1)

if [ -n "$LATEST_REPORT" ]; then
  echo "📄 آخر تقرير: $(basename $LATEST_REPORT)"
  
  HEALTH=$(jq -r '.summary.health' "$LATEST_REPORT")
  TYPESCRIPT=$(jq -r '.summary.typescript' "$LATEST_REPORT")
  SECURITY=$(jq -r '.summary.security' "$LATEST_REPORT")
  
  echo "  حالة النظام: $HEALTH"
  echo "  TypeScript: $TYPESCRIPT"
  echo "  الأمان: $SECURITY"
  echo ""
  
  # التوصيات
  REC_COUNT=$(jq '.recommendations | length' "$LATEST_REPORT")
  if [ "$REC_COUNT" -gt 0 ]; then
    echo "💡 التوصيات: $REC_COUNT توصية"
    jq -r '.recommendations[] | "  [\(.priority)] \(.message)"' "$LATEST_REPORT"
    echo ""
  fi
else
  echo "⚠️  لم يتم إنشاء أي تقارير بعد"
  echo "   شغّل: npm run agent:check"
  echo ""
fi

# 3. الـ Snapshots
if [ -f ".agent-snapshots.json" ]; then
  SNAPSHOT_COUNT=$(jq '.snapshots | length' .agent-snapshots.json)
  LAST_SNAPSHOT=$(jq -r '.lastSnapshot // "لا يوجد"' .agent-snapshots.json)
  
  echo "📸 السناپشوتات:"
  echo "  العدد: $SNAPSHOT_COUNT"
  echo "  آخر واحد: $LAST_SNAPSHOT"
  echo ""
fi

# 4. السجلات
if [ -f "logs/agent-activity.log" ]; then
  LOG_SIZE=$(du -h logs/agent-activity.log | cut -f1)
  LOG_LINES=$(wc -l < logs/agent-activity.log)
  
  echo "📝 السجلات:"
  echo "  الحجم: $LOG_SIZE"
  echo "  الأسطر: $LOG_LINES"
  echo ""
  
  # آخر 3 أسطر
  echo "  آخر الأنشطة:"
  tail -3 logs/agent-activity.log | sed 's/^/    /'
  echo ""
fi

echo "======================================"
echo "✅ انتهى التقرير"
