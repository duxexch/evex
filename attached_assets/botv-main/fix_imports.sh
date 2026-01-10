#!/bin/bash
# حذف مجلد models/ القديم لأن كل النماذج في models.py

echo "🔧 إصلاح مشكلة الاستيراد..."

# إعادة تسمية مجلد models/ إلى models_old/
if [ -d "models" ]; then
    echo "➡️ نقل مجلد models/ إلى models_old_backup/"
    mv models models_old_backup
    echo "✅ تم النقل"
else
    echo "⚠️ مجلد models/ غير موجود"
fi

# التحقق من models.py
if [ -f "models.py" ]; then
    echo "✅ models.py موجود"
else
    echo "❌ models.py غير موجود!"
    exit 1
fi

echo ""
echo "✅ تم الإصلاح - جرب التشغيل الآن:"
echo "   python3 main.py"
