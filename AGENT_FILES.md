# 📦 ملفات نظام الوكيل الذكي - VEX Platform

## الملفات المُنشأة

### 1. ملفات الإعدادات
- `.agent-replit-config.json` - إعدادات الوكيل الرئيسية
- `.agent-snapshots.json` - سجل حالات النظام التاريخية

### 2. السكريبتات
- `script/agent-monitor.js` - الوكيل الرئيسي (Node.js)
- `script/health-check.sh` - فحص صحة سريع (Bash)
- `script/agent-runner.sh` - تشغيل تلقائي مجدول
- `script/agent-stop.sh` - إيقاف طوارئ

### 3. التوثيق
- `AGENT_SETUP.md` - دليل شامل ومفصل
- `AGENT_QUICK_START.md` - دليل سريع
- `AGENT_FILES.md` - هذا الملف

### 4. السجلات والتقارير
- `logs/.gitkeep` - لحفظ المجلد في Git
- `logs/.gitignore` - لتجاهل السجلات
- `logs/agent-activity.log` - سجل الأنشطة (يُنشأ تلقائياً)
- `logs/agent-report-*.json` - التقارير اليومية (تُنشأ تلقائياً)

### 5. التعديلات على الملفات الموجودة
- `package.json` - إضافة 3 أوامر npm جديدة:
  - `npm run agent:check`
  - `npm run agent:health`
  - `npm run agent:stop`

---

## بنية الملفات

```
/workspaces/evex/
├── .agent-replit-config.json      # إعدادات الوكيل
├── .agent-snapshots.json          # حالات النظام
├── AGENT_SETUP.md                 # توثيق شامل
├── AGENT_QUICK_START.md           # دليل سريع
├── AGENT_FILES.md                 # هذا الملف
├── package.json                   # (مُحدّث)
├── script/
│   ├── agent-monitor.js           # الوكيل الرئيسي
│   ├── health-check.sh            # فحص سريع
│   ├── agent-runner.sh            # تشغيل تلقائي
│   └── agent-stop.sh              # إيقاف طوارئ
└── logs/
    ├── .gitkeep
    ├── .gitignore
    ├── agent-activity.log         # (يُنشأ تلقائياً)
    └── agent-report-*.json        # (يُنشأ تلقائياً)
```

---

## حجم الملفات (تقريبي)

| الملف | الحجم |
|------|-------|
| `.agent-replit-config.json` | ~1 KB |
| `.agent-snapshots.json` | ~1 KB (يزداد تدريجياً) |
| `script/agent-monitor.js` | ~15 KB |
| `script/health-check.sh` | ~2 KB |
| `script/agent-runner.sh` | ~2 KB |
| `script/agent-stop.sh` | ~1 KB |
| `AGENT_SETUP.md` | ~20 KB |
| `AGENT_QUICK_START.md` | ~1 KB |
| **الإجمالي** | **~43 KB** |

استهلاك تخزين ضئيل جداً! ✅

---

## الصلاحيات المطلوبة

- ✅ قراءة جميع الملفات
- ✅ كتابة في `logs/`
- ✅ كتابة على `.agent-snapshots.json`
- ✅ تنفيذ أوامر Shell الأساسية
- ❌ لا يحتاج صلاحيات sudo
- ❌ لا يحتاج وصول قاعدة البيانات

---

## التحديثات المستقبلية

للحفاظ على الوكيل محدثاً:

1. راجع `.agent-replit-config.json` دورياً
2. تحقق من السجلات في `logs/`
3. راجع التقارير اليومية
4. حدّث الإعدادات حسب الحاجة

---

## النسخ الاحتياطي

للحفاظ على إعدادات الوكيل:

```bash
# نسخ احتياطي
cp .agent-replit-config.json .agent-replit-config.backup.json
cp .agent-snapshots.json .agent-snapshots.backup.json

# استرجاع
cp .agent-replit-config.backup.json .agent-replit-config.json
cp .agent-snapshots.backup.json .agent-snapshots.json
```

---

## الحذف (إذا لزم الأمر)

لإزالة نظام الوكيل بالكامل:

```bash
# إيقاف الوكيل أولاً
npm run agent:stop

# حذف الملفات
rm -f .agent-replit-config.json
rm -f .agent-snapshots.json
rm -f script/agent-monitor.js
rm -f script/health-check.sh
rm -f script/agent-runner.sh
rm -f script/agent-stop.sh
rm -rf logs/agent-*
rm -f AGENT_SETUP.md
rm -f AGENT_QUICK_START.md
rm -f AGENT_FILES.md

# إزالة الأوامر من package.json يدوياً
```

---

**تم الإنشاء:** 18 يناير 2026  
**الإصدار:** 1.0.0  
**الحالة:** جاهز للاستخدام ✅
