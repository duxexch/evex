# دليل الاختبار السريع - نظام بدء اللعبة

## ✅ التحقق من أن كل شيء يعمل

### الخطوة 1: التحقق من صحة التطبيق

```bash
curl -s http://localhost:5000/api/health | jq .
```

**النتيجة المتوقعة**:
```json
{
  "status": "healthy",
  "database": { "status": "connected" },
  "uptime": "...",
  "timestamp": "..."
}
```

### الخطوة 2: التحقق من قاعدة البيانات

```bash
docker exec vex-db psql -U vex_user -d vex_db -c "
  SELECT COUNT(*) as challenges FROM challenges;
  SELECT COUNT(*) as sessions FROM live_game_sessions;
"
```

**النتيجة المتوقعة**:
- challenges: عدة صفوف
- sessions: عدة صفوف

### الخطوة 3: التحقق من المسارات الجديدة

```bash
# التحقق من أن المسار موجود
docker exec vex-app grep -r "game-start/status" /app/server/routes/

# يجب أن تظهر:
# /app/server/routes/game-start-status.ts
```

---

## 🧪 اختبار التدفق الكامل (يدويّ)

### من خلال الواجهة الرسومية

1. **افتح الموقع**: http://localhost:5000
2. **سجّل دخول** (أو اشترك)
3. **انتقل إلى "التحديات"**
4. **اضغط على تحدٍ متاح** → "قبول التحدي"
5. **انتظر الـ Modal**:
   - ✅ يجب أن يظهر modal بـ "بدأت المباراة!"
   - ✅ عد للخلف 5 ثوانٍ تلقائياً
   - ✅ اضغط "ابدأ اللعبة الآن" للانتقال فوراً

### من خلال WebSocket (متقدم)

```bash
# 1. اتصل بـ WebSocket
websocat ws://localhost:5000/ws

# 2. أرسل رسالة auth
{"type": "auth", "token": "YOUR_JWT_TOKEN"}

# 3. انتظر الاستجابة
{"type": "auth_success", "userId": "..."}

# 4. قبول تحدٍ من متصفح آخر سيؤدي لـ:
{"type": "game_start", "payload": {...}}
```

---

## 🔍 التحقق من الـ Logs

### Backend Logs

```bash
# عرض السجلات الأخيرة
docker logs vex-app --tail 100 -f

# ابحث عن:
# [GameStartManager] Starting game initiation
# [GameStartManager] ✓ Player 1 broadcast successful
# [GameStartManager] Sending to Player 2
```

### Frontend Browser Console

```javascript
// في DevTools (F12)
- [WebSocket] Connected
- [WebSocket] message received: game_start
- [GameStartWatcher] ✓ Game is ready!
```

---

## 🐛 الأخطاء الشائعة والحلول

### ❌ "اللعبة لا تفتح تلقائياً"

**الحل**:
1. تحقق من WebSocket في DevTools
2. فتح الـ Console واشف الأخطاء
3. تحقق من أن `game_start` الرسالة تصل
4. جرّب Refresh الصفحة

### ❌ "Modal لا تظهر"

**الحل**:
1. تحقق من أن gameStartEvent موجود
2. تحقق من أن showGameStartModal = true
3. تحقق من أن Modal component مرفوع على الصفحة

### ❌ "الـ endpoints لا تعمل"

**الحل**:
1. تحقق من أن الملفات تم نسخها: `docker exec vex-app ls /app/server/routes/game-start-status.ts`
2. أعد تشغيل التطبيق: `docker-compose restart app`
3. تحقق من الأخطاء: `docker logs vex-app -f`

---

## 📊 حالات الاختبار

| حالة | الخطوات | النتيجة المتوقعة |
|------|--------|------------------|
| **A: اتصال ممتاز** | افتح متصفحين، قبول من الثاني | Modal يظهر فوراً |
| **B: تأخير الشبكة** | فقطع الإنترنت مؤقتاً | Polling يعيد المحاولة |
| **C: إعادة تحديث الصفحة** | اضغط Ctrl+R بعد القبول | Modal يظهر من polling |
| **D: علامة تبويب متعددة** | افتح نفس الحساب مرتين | Modal يظهر في كلا التبويبات |

---

## ✅ قائمة التحقق

- [ ] البناء بنجاح: `npm run build`
- [ ] لا توجد أخطاء TypeScript: `npm run check`
- [ ] التطبيق يبدأ: `npm run dev` أو `docker-compose up`
- [ ] الـ health endpoint يرد: `curl .../api/health`
- [ ] WebSocket متصل: DevTools → Network → WS
- [ ] Modal تظهر بعد القبول (5 ثوانٍ أقصى)
- [ ] اللعبة تفتح بعد Countdown
- [ ] Polling يعمل عند فقد WebSocket

---

**ملاحظة**: إذا واجهت أي مشاكل، راجع `SOLUTION_DOCUMENTATION.md` للمزيد من التفاصيل.
