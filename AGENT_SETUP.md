# 🤖 دليل إعداد الوكيل الذكي لمشروع VEX Platform

> **نظام مراقبة آمن للغاية - بدون أي تعديلات تلقائية على المشروع**

## 📋 نظرة عامة

هذا الوكيل الذكي مصمم خصيصاً لبيئة **Replit** لمراقبة مشروع VEX Platform بدون أي خطر على استقرار النظام. يعمل في وضع **قراءة فقط** ولا ينفذ أي تعديلات بدون موافقة يدوية صريحة.

---

## 🎯 أهداف الوكيل

1. **المراقبة المستمرة** لحالة النظام والأكواد
2. **الكشف المبكر** عن المشاكل والثغرات الأمنية
3. **التنبيهات الذكية** للقضايا الحرجة فقط
4. **التوصيات** لتحسين الكود (بدون تطبيق تلقائي)
5. **التقارير الدورية** عن حالة المشروع

---

## 🔒 الصلاحيات والقيود

### ✅ العمليات المسموحة

| العملية | الوصف | الخطورة |
|---------|--------|---------|
| **قراءة الملفات** | قراءة أي ملف في المشروع | 🟢 آمن |
| **فحص TypeScript** | تشغيل `tsc --noEmit` للتحقق من الأخطاء | 🟢 آمن |
| **فحص الأمان** | تشغيل `npm audit` للثغرات الأمنية | 🟢 آمن |
| **تحليل السجلات** | قراءة ملفات logs | 🟢 آمن |
| **إنشاء التقارير** | كتابة تقارير في `logs/` | 🟢 آمن |
| **حفظ Snapshots** | حفظ حالة النظام في `.agent-snapshots.json` | 🟢 آمن |
| **فحص الملفات المؤقتة** | البحث عن `*.tmp` و `.DS_Store` | 🟢 آمن |

### ❌ العمليات المحظورة

| العملية | السبب | العقوبة |
|---------|--------|---------|
| **تعديل الكود المصدري** | خطر كسر المشروع | 🔴 إيقاف فوري |
| **حذف ملفات src/** | خطر فقدان البيانات | 🔴 إيقاف فوري |
| **تثبيت التبعيات** | خطر عدم التوافق | 🔴 إيقاف فوري |
| **تعديل package.json** | خطر كسر البناء | 🔴 إيقاف فوري |
| **الوصول لقاعدة البيانات** | خطر فقدان البيانات | 🔴 إيقاف فوري |
| **تعديل ملفات الإعدادات** | خطر عدم الاستقرار | 🔴 إيقاف فوري |
| **إعادة تشغيل الخدمات** | خطر انقطاع الخدمة | 🔴 إيقاف فوري |

---

## 🚀 التشغيل

### 1. التشغيل اليدوي (موصى به)

```bash
# تشغيل الوكيل مرة واحدة
node script/agent-monitor.js
```

### 2. التشغيل الدوري (تلقائي كل ساعتين)

في Replit، أضف هذا إلى ملف `.replit`:

```toml
[env]
AGENT_ENABLED = "true"
AGENT_INTERVAL = "2h"
```

ثم أنشئ cron job يدوياً:

```bash
# أضف إلى crontab (اختياري)
0 */2 * * * cd /workspaces/evex && node script/agent-monitor.js
```

### 3. التشغيل عند الطلب فقط

```bash
# عند الحاجة للفحص السريع
npm run agent:check

# أو مباشرة
node script/agent-monitor.js
```

---

## 📊 فهم التقارير

### مستويات الخطورة

| المستوى | الرمز | الوصف | الإجراء المطلوب |
|---------|------|--------|-----------------|
| **CRITICAL** | 🔴 | مشكلة حرجة تؤثر على الإنتاج | فوري (خلال ساعة) |
| **HIGH** | 🟠 | مشكلة خطيرة تحتاج اهتمام | عاجل (خلال يوم) |
| **MEDIUM** | 🟡 | مشكلة متوسطة يُنصح بحلها | عادي (خلال أسبوع) |
| **LOW** | 🟢 | تحسين أو ملاحظة | اختياري |
| **INFO** | 🔵 | معلومات فقط | لا إجراء |

### مثال على التقرير

```json
{
  "timestamp": "2026-01-18T10:00:00Z",
  "summary": {
    "health": "healthy",
    "typescript": "ok",
    "security": "vulnerabilities"
  },
  "recommendations": [
    {
      "priority": "high",
      "message": "يوجد 3 ثغرات أمنية عالية الخطورة"
    }
  ]
}
```

---

## 🔍 الفحوصات المتاحة

### 1. فحص الصحة (Health Check)

يتحقق من:
- ✅ وجود `package.json`
- ✅ وجود `tsconfig.json`
- ✅ وجود ملفات الإعدادات (`vite.config.ts`, `drizzle.config.ts`, etc.)
- ✅ صحة بنية المشروع

### 2. فحص TypeScript

```bash
# يُشغل تلقائياً:
npx tsc --noEmit --pretty false
```

يكشف:
- أخطاء الأنواع (Type errors)
- أخطاء بناء الجمل (Syntax errors)
- مشاكل التوافق

### 3. فحص الأمان

```bash
# يُشغل تلقائياً:
npm audit --json
```

يكشف:
- الثغرات الأمنية المعروفة (CVEs)
- التبعيات القديمة الخطرة
- مشاكل الترخيص

### 4. تنظيف الملفات المؤقتة (فحص فقط)

يبحث عن:
- `*.tmp`
- `.DS_Store`
- `Thumbs.db`
- `*.log.old`

**ملاحظة:** لا يحذف شيئاً تلقائياً، فقط يعرض القائمة.

---

## ⚙️ الإعدادات

### ملف `.agent-replit-config.json`

```json
{
  "mode": "read-only-monitoring",
  "monitoring": {
    "enabled": true,
    "interval": "2h",
    "checkTypeScript": true,
    "checkSecurity": true
  },
  "notifications": {
    "critical": {
      "enabled": true,
      "events": ["build_failed", "security_critical", "service_down"]
    }
  }
}
```

### تخصيص الإعدادات

#### تعطيل فحص TypeScript (لتوفير الموارد)

```json
{
  "monitoring": {
    "checkTypeScript": false
  }
}
```

#### تغيير فترة المراقبة

```json
{
  "monitoring": {
    "interval": "4h"
  }
}
```

#### تعطيل الإخطارات غير الحرجة

```json
{
  "notifications": {
    "warning": {
      "enabled": false
    }
  }
}
```

---

## 📁 بنية الملفات

```
/workspaces/evex/
├── .agent-replit-config.json    # إعدادات الوكيل
├── .agent-snapshots.json        # سجل حالات النظام
├── script/
│   └── agent-monitor.js         # السكريبت الرئيسي
├── logs/
│   ├── agent-activity.log       # سجل أنشطة الوكيل
│   └── agent-report-*.json      # التقارير اليومية
└── AGENT_SETUP.md              # هذا الملف
```

---

## 🔧 استكشاف الأخطاء

### المشكلة: الوكيل لا يعمل

```bash
# تحقق من الإعدادات
cat .agent-replit-config.json

# تحقق من السجلات
cat logs/agent-activity.log

# تشغيل يدوي مع تفاصيل
NODE_ENV=development node script/agent-monitor.js
```

### المشكلة: فحص TypeScript يستغرق وقتاً طويلاً

عطّل الفحص مؤقتاً في `.agent-replit-config.json`:

```json
{
  "monitoring": {
    "checkTypeScript": false
  }
}
```

### المشكلة: الوكيل يستهلك موارد كثيرة

1. زِد الفترة الزمنية بين الفحوصات:
   ```json
   { "monitoring": { "interval": "6h" } }
   ```

2. عطّل الفحوصات غير الضرورية:
   ```json
   {
     "monitoring": {
       "checkSecurity": false
     }
   }
   ```

---

## 📈 أمثلة الاستخدام

### مثال 1: فحص يومي روتيني

```bash
# كل صباح، شغّل:
node script/agent-monitor.js

# راجع التقرير:
cat logs/agent-report-$(date +%Y-%m-%d).json
```

### مثال 2: قبل النشر (Deployment)

```bash
# تحقق من عدم وجود مشاكل:
node script/agent-monitor.js

# إذا كانت النتيجة "healthy" + لا أخطاء، انشر بأمان
```

### مثال 3: بعد تحديث التبعيات

```bash
# بعد npm install أو npm update:
node script/agent-monitor.js

# تأكد من:
# - لا أخطاء TypeScript جديدة
# - لا ثغرات أمنية حرجة
```

---

## 🛡️ أفضل الممارسات

### 1. المراجعة اليدوية دائماً

❌ **خطأ:**
```bash
# السماح للوكيل بالتحديث التلقائي
agent --auto-update
```

✅ **صحيح:**
```bash
# مراجعة التقرير أولاً
node script/agent-monitor.js
cat logs/agent-report-*.json
# ثم اتخاذ القرار يدوياً
```

### 2. الفحص قبل الإنتاج

```bash
# دائماً قبل git push:
node script/agent-monitor.js
npm run check  # TypeScript check
npm run build  # Test build
```

### 3. الاحتفاظ بالسجلات

```bash
# أرشفة التقارير الشهرية:
mkdir -p logs/archive/$(date +%Y-%m)
mv logs/agent-report-*.json logs/archive/$(date +%Y-%m)/
```

### 4. المراقبة الدورية

أضف تذكيراً أسبوعياً:
- الاثنين: فحص كامل + مراجعة التقارير
- الأربعاء: فحص أمان سريع
- الجمعة: فحص قبل عطلة نهاية الأسبوع

---

## 🚨 إجراءات الطوارئ

### إذا اكتشف الوكيل ثغرة حرجة

1. **لا تتجاهل التنبيه!**
2. راجع التفاصيل في التقرير
3. تحقق من `npm audit` يدوياً:
   ```bash
   npm audit
   npm audit fix --dry-run  # معاينة الإصلاح
   ```
4. إذا كان آمناً:
   ```bash
   npm audit fix
   npm run check
   npm run build
   ```

### إذا فشل البناء (Build Failed)

1. راجع السجلات:
   ```bash
   cat logs/agent-activity.log | grep ERROR
   ```
2. تحقق من آخر تغيير:
   ```bash
   git log -1
   git diff HEAD~1
   ```
3. تراجع إذا لزم الأمر:
   ```bash
   git revert HEAD
   ```

---

## 📝 ملخص سريع

| الأمر | متى تستخدمه |
|-------|-------------|
| `node script/agent-monitor.js` | فحص يومي أو قبل النشر |
| `.agent-replit-config.json` | تخصيص سلوك الوكيل |
| `logs/agent-report-*.json` | مراجعة التقارير |
| `logs/agent-activity.log` | استكشاف الأخطاء |
| `.agent-snapshots.json` | مقارنة التغييرات |

---

## 🎓 التعليمات والأسئلة الشائعة

### س: هل الوكيل يعدل الكود؟
**ج:** لا، أبداً! وضع `read-only-monitoring` يمنع أي تعديلات.

### س: هل آمن تشغيله على الإنتاج؟
**ج:** نعم، تماماً. يقرأ فقط ولا يكتب على ملفات المصدر.

### س: كم يستهلك من الموارد؟
**ج:** قليل جداً (~50MB RAM, ~30 ثانية لكل فحص).

### س: ماذا لو أردت تعطيله؟
**ج:** ببساطة لا تشغله! أو غيّر `enabled: false` في الإعدادات.

### س: هل يحتاج صلاحيات خاصة؟
**ج:** لا، يعمل مع صلاحيات المستخدم العادي.

---

## 📞 الدعم والمساعدة

إذا واجهت مشكلة:
1. راجع السجلات: `logs/agent-activity.log`
2. تأكد من الإعدادات: `.agent-replit-config.json`
3. شغّل يدوياً مع verbose: `NODE_ENV=development node script/agent-monitor.js`

---

## 🔄 التحديثات المستقبلية

الميزات المخطط إضافتها:
- [ ] دعم إشعارات Slack/Discord
- [ ] لوحة تحكم ويب للمراقبة
- [ ] تحليل أداء الكود
- [ ] اقتراحات تحسين تلقائية
- [ ] دعم CI/CD integration

---

**آخر تحديث:** 18 يناير 2026  
**الإصدار:** 1.0.0  
**الترخيص:** خاص بمشروع VEX Platform
