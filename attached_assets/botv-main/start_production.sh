#!/bin/bash
# =================================================
# تشغيل بوت LangSense في وضع الإنتاج
# Production Mode - Full Features Enabled
# =================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 LangSense Bot - Production Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# التحقق من Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 غير مثبت"
    exit 1
fi
echo "✅ Python3: $(python3 --version)"

# التحقق من .env
if [ ! -f ".env" ]; then
    echo "❌ ملف .env غير موجود"
    exit 1
fi
echo "✅ ملف .env موجود"

# التحقق من BOT_TOKEN
if ! grep -q "BOT_TOKEN" .env; then
    echo "❌ BOT_TOKEN غير موجود في .env"
    exit 1
fi
echo "✅ BOT_TOKEN محدد"

# التحقق من المتطلبات
echo ""
echo "📦 التحقق من المتطلبات..."
pip3 install -q -r requirements.txt 2>/dev/null || echo "⚠️ تحذير: بعض المكتبات قد تكون مفقودة"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 المميزات المفعلة:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ نظام المحافظ (11 عملة)"
echo "✅ برنامج الإحالة (عمولات تلقائية)"
echo "✅ طرق الدفع (رسوم مرنة)"
echo "✅ لوحة تحكم متقدمة"
echo "✅ إدارة المستخدمين"
echo "✅ إدارة العمولات"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🤖 بدء تشغيل البوت..."
echo ""

# تشغيل البوت
python3 main.py

# في حالة التوقف
EXIT_CODE=$?
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ البوت توقف بشكل طبيعي"
else
    echo "❌ البوت توقف بخطأ (Exit Code: $EXIT_CODE)"
    echo "تحقق من bot.log للتفاصيل"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
