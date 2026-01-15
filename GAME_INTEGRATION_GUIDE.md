# دليل إضافة الألعاب الشامل لمنصة VEX
# Complete Game Integration Guide for VEX Platform

---

## 📑 جدول المحتويات / Table of Contents

1. [مقدمة](#-مقدمة)
2. [اختيار اللعبة المناسبة](#-اختيار-اللعبة-المناسبة)
3. [مصادر الألعاب المجانية](#-مصادر-الألعاب-المجانية)
4. [طرق تشغيل الألعاب](#-طرق-تشغيل-الألعاب)
5. [إضافة لعبة iframe (الأسهل)](#-إضافة-لعبة-iframe-الأسهل)
6. [إضافة لعبة HTML5 مفتوحة المصدر](#-إضافة-لعبة-html5-مفتوحة-المصدر)
7. [بناء لعبة مخصصة من الصفر](#-بناء-لعبة-مخصصة-من-الصفر)
8. [تحسين الأداء والسرعة](#-تحسين-الأداء-والسرعة)
9. [التعامل مع عدد كبير من المستخدمين](#-التعامل-مع-عدد-كبير-من-المستخدمين)
10. [تشغيل اللعبة على سيرفر منفصل](#-تشغيل-اللعبة-على-سيرفر-منفصل)
11. [إصلاح الأخطاء الشائعة](#-إصلاح-الأخطاء-الشائعة)
12. [قائمة التحقق النهائية](#-قائمة-التحقق-النهائية)

---

## 📌 مقدمة

هذا الدليل يشرح بالتفصيل كيفية إضافة ألعاب إلى منصة VEX بثلاث طرق مختلفة، مع التركيز على:
- الأداء العالي
- دعم عدد كبير من المستخدمين
- الاستقرار والموثوقية
- سهولة الصيانة

---

## ⚠️ تنبيهات مهمة قبل البدء

### 1. الأمثلة توضيحية وليست جاهزة للنسخ
```
الأكواد في هذا الدليل هي أمثلة توضيحية تحتاج تعديل لتتناسب مع:
- هيكل مشروعك الفعلي (schema.ts, storage.ts)
- مكونات shadcn/ui المستخدمة في المشروع
- أنماط التحقق باستخدام Zod
```

### 2. أمان الألعاب المالية (مهم جداً!)
```
⚠️ تحذير أمني:
- لا تثق أبداً بالعميل (Client) في تحديد الأرباح
- كل العمليات المالية يجب أن تتم على السيرفر
- اللعبة يجب أن تُحسب نتائجها على السيرفر وليس المتصفح
- استخدم RNG (Random Number Generator) على السيرفر فقط

مثال سيء (غير آمن):
  - العميل يقول "ربحت 1000$" ← السيرفر يضيف 1000$

مثال جيد (آمن):
  - العميل يقول "أريد الدوران" ← السيرفر يحسب النتيجة ← السيرفر يحدد الربح
```

### 3. الخطوات الفعلية للإضافة
```
لإضافة لعبة فعلياً يجب:
1. إضافة الجداول في shared/schema.ts
2. إضافة دوال التخزين في server/storage.ts
3. إضافة Routes في server/routes.ts
4. إضافة الصفحات في client/src/pages/
5. اختبار كل شيء قبل الإنتاج
```

---

## 🎯 اختيار اللعبة المناسبة

### معايير اختيار اللعبة:

| المعيار | الأهمية | الوصف |
|---------|---------|-------|
| **الترخيص** | حرجة | MIT, Apache 2.0, أو مجانية تجارياً |
| **الحجم** | عالية | أقل من 5MB للتحميل السريع |
| **التقنية** | عالية | HTML5/Canvas/WebGL (لا Flash) |
| **التوافق** | عالية | يعمل على الموبايل والديسكتوب |
| **التوثيق** | متوسطة | وجود شرح أو أمثلة |
| **الصيانة** | متوسطة | آخر تحديث أقل من سنة |

### أنواع الألعاب حسب التعقيد:

```
┌─────────────────────────────────────────────────────────────┐
│  المستوى 1: ألعاب iframe (جاهزة للتضمين)                   │
│  ├── الصعوبة: سهلة جداً                                     │
│  ├── الوقت: 30 دقيقة                                        │
│  ├── مثال: ألعاب Gamezop, GamePix                          │
│  └── مناسبة لـ: البدء السريع                                │
├─────────────────────────────────────────────────────────────┤
│  المستوى 2: ألعاب HTML5 مفتوحة المصدر                       │
│  ├── الصعوبة: متوسطة                                        │
│  ├── الوقت: 2-4 ساعات                                       │
│  ├── مثال: ألعاب GitHub, itch.io                           │
│  └── مناسبة لـ: تخصيص محدود                                 │
├─────────────────────────────────────────────────────────────┤
│  المستوى 3: ألعاب مخصصة (من الصفر)                         │
│  ├── الصعوبة: صعبة                                          │
│  ├── الوقت: 10-40 ساعة                                      │
│  ├── مثال: شطرنج، طرنيب، بلوت                              │
│  └── مناسبة لـ: تحكم كامل + ميزات متقدمة                   │
└─────────────────────────────────────────────────────────────┘
```

### جدول مقارنة الطرق:

| الميزة | iframe | مفتوحة المصدر | مخصصة |
|--------|--------|---------------|-------|
| السرعة في التنفيذ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| التحكم الكامل | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| التخصيص | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Multiplayer | ❌ | ⚠️ | ⭐⭐⭐ |
| الشات والصوت | ❌ | ❌ | ⭐⭐⭐ |
| المشاهدين | ❌ | ❌ | ⭐⭐⭐ |
| التكلفة | منخفضة | متوسطة | عالية |

---

## 📦 مصادر الألعاب المجانية

### 1. منصات التضمين (iframe)

#### Gamezop (الأفضل للبدء)
```
🔗 الرابط: https://business.gamezop.com
📊 الألعاب: 300+
💰 النموذج: مشاركة أرباح الإعلانات
✅ المميزات:
   - API جاهز
   - White-label متاح
   - لوحة تحكم للإحصائيات
   
📝 خطوات التسجيل:
   1. اذهب إلى business.gamezop.com
   2. سجل حساب جديد
   3. أضف موقعك للموافقة
   4. احصل على رمز التضمين
```

#### GamePix (الأكثر تنوعاً)
```
🔗 الرابط: https://partners.gamepix.com/publishers
📊 الألعاب: 1000+
💰 النموذج: Affiliate + إعلانات
✅ المميزات:
   - JSON API
   - ألعاب جديدة أسبوعياً
   - تصنيفات متعددة

📝 خطوات التسجيل:
   1. اذهب إلى partners.gamepix.com
   2. انقر "Become a Publisher"
   3. املأ بيانات موقعك
   4. انتظر الموافقة (1-3 أيام)
```

#### PlayPager (بدون إعلانات)
```
🔗 الرابط: https://playpager.com/embed-games/
📊 الألعاب: 50+
💰 النموذج: مجاني تماماً
✅ المميزات:
   - بدون إعلانات
   - كود تضمين جاهز
   - لا يحتاج تسجيل
```

### 2. مصادر GitHub (مفتوحة المصدر)

#### ألعاب الكازينو/السلوتس
```bash
# 1. HTML5 Slot Machine (الأفضل)
git clone https://github.com/johakr/html5-slot-machine.git

# 2. Casino Slot Game
git clone https://github.com/1stake/slot-machine-online-casino-game.git

# 3. Open Source Casino
git clone https://github.com/gamingdotme/opensource-casino-v10.git
```

#### ألعاب الطاولة
```bash
# 1. Chess.js (محرك الشطرنج)
npm install chess.js chessboard

# 2. Phaser (Framework للألعاب)
npm install phaser
```

#### روابط مباشرة للتصفح
```
🔗 ألعاب HTML5: https://github.com/topics/html5-game
🔗 ألعاب الكازينو: https://github.com/topics/casino-game
🔗 ألعاب الورق: https://github.com/topics/card-game
🔗 ألعاب اللوحة: https://github.com/topics/board-game
```

### 3. مصادر أخرى

#### itch.io (ألعاب مستقلة)
```
🔗 الرابط: https://itch.io/games/html5
📊 الألعاب: آلاف
💰 النموذج: مختلط (مجاني/مدفوع)
⚠️ تحقق من الترخيص لكل لعبة!
```

#### CodeCanyon (مدفوعة بجودة عالية)
```
🔗 الرابط: https://codecanyon.net/category/html5/games
📊 الألعاب: 500+
💰 النموذج: $19-$99 لكل لعبة
✅ المميزات:
   - كود نظيف
   - توثيق كامل
   - دعم فني
```

---

## 🎮 طرق تشغيل الألعاب

### الطريقة 1: تضمين مباشر (iframe)

```
┌──────────────────────────────────────────────────────────────┐
│                        VEX Platform                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │     ┌──────────────────────────────────────────┐      │  │
│  │     │         <iframe src="game.com">         │      │  │
│  │     │                                          │      │  │
│  │     │           اللعبة من سيرفر خارجي          │      │  │
│  │     │                                          │      │  │
│  │     └──────────────────────────────────────────┘      │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

✅ المميزات:
   - لا يستهلك موارد سيرفرك
   - تحديثات تلقائية
   - سهل جداً

❌ العيوب:
   - لا تتحكم في اللعبة
   - لا يمكن إضافة Multiplayer
   - معتمد على سيرفر خارجي
```

### الطريقة 2: استضافة محلية (Self-hosted)

```
┌──────────────────────────────────────────────────────────────┐
│                        VEX Platform                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │     ┌──────────────────────────────────────────┐      │  │
│  │     │         /public/games/chess/             │      │  │
│  │     │                                          │      │  │
│  │     │           ملفات اللعبة على سيرفرك        │      │  │
│  │     │                                          │      │  │
│  │     └──────────────────────────────────────────┘      │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

✅ المميزات:
   - تحكم كامل
   - يمكن التعديل
   - لا تعتمد على خدمة خارجية

❌ العيوب:
   - يستهلك مساحة تخزين
   - تحتاج تحديث يدوي
```

### الطريقة 3: سيرفر ألعاب منفصل

```
┌─────────────────────┐         ┌─────────────────────┐
│    VEX Platform     │         │   Game Server       │
│    (Main Server)    │◄───────►│   (Separate VPS)    │
│                     │   API   │                     │
│  - Users            │         │  - Game Logic       │
│  - Authentication   │         │  - WebSocket        │
│  - Payments         │         │  - Matchmaking      │
└─────────────────────┘         └─────────────────────┘

✅ المميزات:
   - أداء أفضل (موارد منفصلة)
   - قابلية توسع عالية
   - عزل المشاكل

❌ العيوب:
   - تكلفة سيرفر إضافي
   - إدارة أكثر تعقيداً
```

---

## 🖼️ إضافة لعبة iframe (الأسهل)

### الخطوة 1: اختيار اللعبة من Gamezop

```
1. اذهب إلى: https://www.gamezop.com/games
2. اختر لعبة (مثل: Ludo King)
3. انسخ رابط اللعبة
```

### الخطوة 2: إضافة اللعبة في قاعدة البيانات

```sql
-- أضف اللعبة في جدول games
INSERT INTO games (
  name,
  slug,
  description,
  category,
  player_count,
  game_type,
  is_active,
  external_url
) VALUES (
  'Ludo King',
  'ludo-king',
  'لعبة ليدو الكلاسيكية للعب مع الأصدقاء',
  'board',
  4,
  'iframe',
  true,
  'https://games.gamezop.com/ludo-king'
);
```

### الخطوة 3: إنشاء مكون اللعبة

```typescript
// client/src/components/games/IframeGame.tsx

interface IframeGameProps {
  gameUrl: string;
  gameName: string;
}

export function IframeGame({ gameUrl, gameName }: IframeGameProps) {
  return (
    <div className="w-full h-full min-h-[600px] relative">
      {/* رأس اللعبة */}
      <div className="bg-card p-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{gameName}</h2>
        <button 
          onClick={() => window.location.reload()}
          className="btn btn-ghost"
        >
          إعادة تحميل
        </button>
      </div>
      
      {/* إطار اللعبة */}
      <iframe
        src={gameUrl}
        title={gameName}
        className="w-full h-[calc(100vh-200px)] border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
```

### الخطوة 4: إضافة صفحة اللعبة

```typescript
// client/src/pages/games/[slug].tsx

import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { IframeGame } from '@/components/games/IframeGame';

export default function GamePage() {
  const { slug } = useParams();
  
  const { data: game, isLoading } = useQuery({
    queryKey: ['/api/games', slug],
  });
  
  if (isLoading) return <div>جاري التحميل...</div>;
  if (!game) return <div>اللعبة غير موجودة</div>;
  
  if (game.gameType === 'iframe') {
    return <IframeGame gameUrl={game.externalUrl} gameName={game.name} />;
  }
  
  // أنواع أخرى من الألعاب...
  return <div>نوع اللعبة غير مدعوم</div>;
}
```

### الخطوة 5: إضافة API endpoint

```typescript
// server/routes.ts

app.get('/api/games/:slug', async (req, res) => {
  const { slug } = req.params;
  
  const game = await db.query.games.findFirst({
    where: eq(games.slug, slug),
  });
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(game);
});

app.get('/api/games', async (req, res) => {
  const allGames = await db.query.games.findMany({
    where: eq(games.isActive, true),
    orderBy: [desc(games.createdAt)],
  });
  
  res.json(allGames);
});
```

---

## 🎲 إضافة لعبة HTML5 مفتوحة المصدر

### مثال: إضافة لعبة Slot Machine من GitHub

### الخطوة 1: تحميل اللعبة

```bash
# 1. اذهب لمجلد المشروع
cd /var/www/vex

# 2. أنشئ مجلد للألعاب
mkdir -p public/games

# 3. حمّل اللعبة
cd public/games
git clone https://github.com/johakr/html5-slot-machine.git slot-machine

# 4. أو حمّلها كـ ZIP
wget https://github.com/johakr/html5-slot-machine/archive/refs/heads/master.zip
unzip master.zip
mv html5-slot-machine-master slot-machine
```

### الخطوة 2: فحص ملفات اللعبة

```bash
# شوف محتويات المجلد
ls -la public/games/slot-machine/

# الملفات المهمة:
# ├── index.html      # الصفحة الرئيسية
# ├── assets/         # الصور والأصوات
# │   ├── css/
# │   ├── js/
# │   └── images/
# └── README.md       # التوثيق
```

### الخطوة 3: تعديل اللعبة (اختياري)

```javascript
// public/games/slot-machine/assets/js/config.js

const GAME_CONFIG = {
  // إعدادات الرهان
  minBet: 1,
  maxBet: 1000,
  defaultBet: 10,
  
  // إعدادات الرصيد
  startingBalance: 1000,
  
  // إعدادات العرض
  language: 'ar',
  currency: 'USD',
  
  // ربط مع VEX API
  apiEndpoint: '/api/games/slot-machine',
  
  // إعدادات الصوت
  soundEnabled: true,
  musicVolume: 0.5,
  effectsVolume: 0.8,
};
```

### الخطوة 4: ربط اللعبة مع رصيد المستخدم

```javascript
// public/games/slot-machine/assets/js/vex-integration.js

class VexIntegration {
  constructor() {
    this.apiBase = '/api';
    this.userId = null;
    this.balance = 0;
  }
  
  // تحميل بيانات المستخدم
  async loadUser() {
    try {
      const response = await fetch(`${this.apiBase}/user/me`, {
        credentials: 'include'
      });
      const data = await response.json();
      this.userId = data.id;
      this.balance = parseFloat(data.balance);
      return data;
    } catch (error) {
      console.error('Failed to load user:', error);
      throw error;
    }
  }
  
  // خصم رصيد (عند الرهان)
  async placeBet(amount) {
    const response = await fetch(`${this.apiBase}/games/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        gameId: 'slot-machine',
        amount: amount
      })
    });
    
    if (!response.ok) {
      throw new Error('Insufficient balance');
    }
    
    const data = await response.json();
    this.balance = parseFloat(data.newBalance);
    return data;
  }
  
  // إضافة أرباح
  async addWinnings(amount) {
    const response = await fetch(`${this.apiBase}/games/win`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        gameId: 'slot-machine',
        amount: amount
      })
    });
    
    const data = await response.json();
    this.balance = parseFloat(data.newBalance);
    return data;
  }
  
  // الحصول على الرصيد الحالي
  getBalance() {
    return this.balance;
  }
}

// تصدير للاستخدام
window.VexIntegration = VexIntegration;
```

### الخطوة 5: إضافة Backend API

```typescript
// server/routes/games.ts

import { Router } from 'express';
import { db } from '../db';
import { users, gameTransactions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const router = Router();

// تسجيل رهان
router.post('/games/bet', async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { gameId, amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  try {
    // جلب رصيد المستخدم
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    if (!user || parseFloat(user.balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // خصم الرصيد
    await db.update(users)
      .set({
        balance: sql`${users.balance} - ${amount}`
      })
      .where(eq(users.id, userId));
    
    // تسجيل المعاملة
    await db.insert(gameTransactions).values({
      userId,
      gameId,
      type: 'bet',
      amount: -amount,
      createdAt: new Date()
    });
    
    // جلب الرصيد الجديد
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    res.json({
      success: true,
      newBalance: updatedUser?.balance
    });
  } catch (error) {
    console.error('Bet error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

// تسجيل فوز
router.post('/games/win', async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { gameId, amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  try {
    // إضافة الرصيد
    await db.update(users)
      .set({
        balance: sql`${users.balance} + ${amount}`
      })
      .where(eq(users.id, userId));
    
    // تسجيل المعاملة
    await db.insert(gameTransactions).values({
      userId,
      gameId,
      type: 'win',
      amount: amount,
      createdAt: new Date()
    });
    
    // جلب الرصيد الجديد
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    res.json({
      success: true,
      newBalance: updatedUser?.balance
    });
  } catch (error) {
    console.error('Win error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

export default router;
```

### الخطوة 6: إضافة اللعبة في لوحة التحكم

```typescript
// client/src/pages/admin/games/new.tsx

import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function NewGamePage() {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      category: 'casino',
      playerCount: 1,
      gameType: 'self-hosted',
      gamePath: '',
      externalUrl: '',
      minBet: 1,
      maxBet: 1000,
      isActive: true,
    }
  });
  
  const mutation = useMutation({
    mutationFn: (data) => apiRequest('/api/admin/games', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/games'] });
      // redirect to games list
    }
  });
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">إضافة لعبة جديدة</h1>
      
      <form onSubmit={form.handleSubmit(mutation.mutate)} className="space-y-4">
        {/* اسم اللعبة */}
        <div>
          <label>اسم اللعبة</label>
          <input {...form.register('name')} className="input" />
        </div>
        
        {/* Slug */}
        <div>
          <label>Slug (للرابط)</label>
          <input {...form.register('slug')} className="input" />
        </div>
        
        {/* نوع اللعبة */}
        <div>
          <label>نوع اللعبة</label>
          <select {...form.register('gameType')} className="select">
            <option value="iframe">iframe (رابط خارجي)</option>
            <option value="self-hosted">Self-hosted (مستضافة)</option>
            <option value="custom">مخصصة (React)</option>
          </select>
        </div>
        
        {/* مسار اللعبة */}
        <div>
          <label>مسار/رابط اللعبة</label>
          <input 
            {...form.register('gamePath')} 
            placeholder="/games/slot-machine/index.html"
            className="input" 
          />
        </div>
        
        {/* إعدادات الرهان */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>الحد الأدنى للرهان</label>
            <input type="number" {...form.register('minBet')} className="input" />
          </div>
          <div>
            <label>الحد الأقصى للرهان</label>
            <input type="number" {...form.register('maxBet')} className="input" />
          </div>
        </div>
        
        <button type="submit" className="btn btn-primary">
          إضافة اللعبة
        </button>
      </form>
    </div>
  );
}
```

---

## 🛠️ بناء لعبة مخصصة من الصفر

### مثال: لعبة شطرنج Multiplayer

### الخطوة 1: تثبيت المكتبات

```bash
npm install chess.js
```

### الخطوة 2: إنشاء منطق اللعبة (Server)

```typescript
// server/games/chess/ChessGame.ts

import { Chess } from 'chess.js';

interface Player {
  id: string;
  color: 'white' | 'black';
  socketId: string;
  timeLeft: number;
}

interface GameState {
  id: string;
  players: Player[];
  spectators: string[];
  chess: Chess;
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  currentTurn: 'white' | 'black';
  moves: string[];
  createdAt: Date;
  timeControl: number; // seconds per player
}

export class ChessGameManager {
  private games: Map<string, GameState> = new Map();
  
  // إنشاء لعبة جديدة
  createGame(hostId: string, socketId: string, timeControl: number = 600): string {
    const gameId = this.generateGameId();
    
    const game: GameState = {
      id: gameId,
      players: [{
        id: hostId,
        color: 'white',
        socketId,
        timeLeft: timeControl
      }],
      spectators: [],
      chess: new Chess(),
      status: 'waiting',
      currentTurn: 'white',
      moves: [],
      createdAt: new Date(),
      timeControl
    };
    
    this.games.set(gameId, game);
    return gameId;
  }
  
  // الانضمام للعبة
  joinGame(gameId: string, playerId: string, socketId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'waiting' || game.players.length >= 2) {
      return false;
    }
    
    game.players.push({
      id: playerId,
      color: 'black',
      socketId,
      timeLeft: game.timeControl
    });
    
    game.status = 'playing';
    return true;
  }
  
  // الانضمام كمتفرج
  addSpectator(gameId: string, socketId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    game.spectators.push(socketId);
    return true;
  }
  
  // تنفيذ نقلة
  makeMove(gameId: string, playerId: string, move: string): {
    success: boolean;
    newFen?: string;
    isCheckmate?: boolean;
    isDraw?: boolean;
    error?: string;
  } {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') {
      return { success: false, error: 'Game not found or not in progress' };
    }
    
    // تحقق من دور اللاعب
    const player = game.players.find(p => p.id === playerId);
    if (!player || player.color !== game.currentTurn) {
      return { success: false, error: 'Not your turn' };
    }
    
    // تنفيذ النقلة
    try {
      const result = game.chess.move(move);
      if (!result) {
        return { success: false, error: 'Invalid move' };
      }
      
      game.moves.push(move);
      game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
      
      // تحقق من انتهاء اللعبة
      if (game.chess.isCheckmate()) {
        game.status = 'finished';
        game.winner = player.id;
        return {
          success: true,
          newFen: game.chess.fen(),
          isCheckmate: true
        };
      }
      
      if (game.chess.isDraw()) {
        game.status = 'finished';
        return {
          success: true,
          newFen: game.chess.fen(),
          isDraw: true
        };
      }
      
      return {
        success: true,
        newFen: game.chess.fen()
      };
    } catch (error) {
      return { success: false, error: 'Invalid move format' };
    }
  }
  
  // جلب حالة اللعبة
  getGameState(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }
  
  // توليد معرف فريد
  private generateGameId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

export const chessManager = new ChessGameManager();
```

### الخطوة 3: إنشاء WebSocket Handler

```typescript
// server/games/chess/chessSocket.ts

import { WebSocket } from 'ws';
import { chessManager } from './ChessGame';

interface ChessMessage {
  type: 'create' | 'join' | 'move' | 'spectate' | 'chat' | 'resign';
  gameId?: string;
  move?: string;
  message?: string;
  timeControl?: number;
}

export function handleChessConnection(ws: WebSocket, userId: string) {
  let currentGameId: string | null = null;
  
  ws.on('message', (data) => {
    try {
      const msg: ChessMessage = JSON.parse(data.toString());
      
      switch (msg.type) {
        case 'create':
          // إنشاء لعبة جديدة
          const gameId = chessManager.createGame(userId, ws.id, msg.timeControl);
          currentGameId = gameId;
          ws.send(JSON.stringify({
            type: 'game_created',
            gameId,
            color: 'white'
          }));
          break;
          
        case 'join':
          // الانضمام للعبة
          if (msg.gameId) {
            const joined = chessManager.joinGame(msg.gameId, userId, ws.id);
            if (joined) {
              currentGameId = msg.gameId;
              const game = chessManager.getGameState(msg.gameId);
              
              // إرسال للاعب المنضم
              ws.send(JSON.stringify({
                type: 'game_joined',
                gameId: msg.gameId,
                color: 'black',
                fen: game?.chess.fen()
              }));
              
              // إعلام اللاعب الأول
              broadcastToGame(msg.gameId, {
                type: 'opponent_joined',
                gameId: msg.gameId
              }, ws.id);
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Could not join game'
              }));
            }
          }
          break;
          
        case 'spectate':
          // الانضمام كمتفرج
          if (msg.gameId) {
            chessManager.addSpectator(msg.gameId, ws.id);
            const game = chessManager.getGameState(msg.gameId);
            ws.send(JSON.stringify({
              type: 'spectating',
              gameId: msg.gameId,
              fen: game?.chess.fen(),
              moves: game?.moves
            }));
          }
          break;
          
        case 'move':
          // تنفيذ نقلة
          if (currentGameId && msg.move) {
            const result = chessManager.makeMove(currentGameId, userId, msg.move);
            
            if (result.success) {
              // إرسال للجميع في اللعبة
              broadcastToGame(currentGameId, {
                type: 'move_made',
                move: msg.move,
                fen: result.newFen,
                isCheckmate: result.isCheckmate,
                isDraw: result.isDraw
              });
            } else {
              ws.send(JSON.stringify({
                type: 'invalid_move',
                error: result.error
              }));
            }
          }
          break;
          
        case 'chat':
          // رسالة في الشات
          if (currentGameId && msg.message) {
            broadcastToGame(currentGameId, {
              type: 'chat_message',
              userId,
              message: msg.message,
              timestamp: Date.now()
            });
          }
          break;
          
        case 'resign':
          // استسلام
          if (currentGameId) {
            const game = chessManager.getGameState(currentGameId);
            if (game) {
              game.status = 'finished';
              game.winner = game.players.find(p => p.id !== userId)?.id;
              
              broadcastToGame(currentGameId, {
                type: 'game_over',
                reason: 'resign',
                winner: game.winner
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Chess WebSocket error:', error);
    }
  });
  
  ws.on('close', () => {
    // معالجة قطع الاتصال
    if (currentGameId) {
      broadcastToGame(currentGameId, {
        type: 'player_disconnected',
        userId
      });
    }
  });
}

// إرسال رسالة لجميع المتصلين باللعبة
function broadcastToGame(gameId: string, message: any, excludeSocketId?: string) {
  const game = chessManager.getGameState(gameId);
  if (!game) return;
  
  const allSockets = [
    ...game.players.map(p => p.socketId),
    ...game.spectators
  ].filter(id => id !== excludeSocketId);
  
  // هنا تحتاج ربط مع WebSocket server الفعلي
  // هذا مثال مبسط
}
```

### الخطوة 4: إنشاء واجهة اللعبة (React)

```typescript
// client/src/components/games/chess/ChessBoard.tsx

import { useState, useEffect, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';

interface ChessBoardProps {
  gameId: string;
  playerColor: 'white' | 'black';
  onMove: (move: string) => void;
  fen?: string;
}

const PIECES: Record<string, string> = {
  'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟',
};

export function ChessBoard({ gameId, playerColor, onMove, fen }: ChessBoardProps) {
  const [chess] = useState(() => new Chess(fen));
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [board, setBoard] = useState(chess.board());
  
  // تحديث الرقعة عند تغير FEN
  useEffect(() => {
    if (fen) {
      chess.load(fen);
      setBoard(chess.board());
    }
  }, [fen, chess]);
  
  // معالجة النقر على مربع
  const handleSquareClick = useCallback((square: Square) => {
    if (selectedSquare) {
      // محاولة تنفيذ نقلة
      const move = chess.move({
        from: selectedSquare,
        to: square,
        promotion: 'q' // ترقية تلقائية لوزير
      });
      
      if (move) {
        onMove(`${selectedSquare}${square}`);
        setBoard(chess.board());
      }
      
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      // اختيار قطعة
      const piece = chess.get(square);
      if (piece && piece.color === playerColor[0]) {
        setSelectedSquare(square);
        const moves = chess.moves({ square, verbose: true }) as Move[];
        setLegalMoves(moves.map(m => m.to as Square));
      }
    }
  }, [selectedSquare, chess, playerColor, onMove]);
  
  // توليد المربعات
  const renderSquares = () => {
    const squares = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = playerColor === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
    const filesOrder = playerColor === 'white' ? files : [...files].reverse();
    
    for (const rank of ranks) {
      for (const file of filesOrder) {
        const square = `${file}${rank}` as Square;
        const piece = chess.get(square);
        const isLight = (files.indexOf(file) + rank) % 2 === 0;
        const isSelected = square === selectedSquare;
        const isLegalMove = legalMoves.includes(square);
        
        squares.push(
          <div
            key={square}
            data-testid={`square-${square}`}
            onClick={() => handleSquareClick(square)}
            className={`
              aspect-square flex items-center justify-center text-4xl cursor-pointer
              ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
              ${isSelected ? 'ring-4 ring-blue-500' : ''}
              ${isLegalMove ? 'ring-2 ring-green-500' : ''}
            `}
          >
            {piece && PIECES[`${piece.color}${piece.type.toUpperCase()}`]}
          </div>
        );
      }
    }
    
    return squares;
  };
  
  return (
    <div className="w-full max-w-[600px] mx-auto">
      <div className="grid grid-cols-8 border-4 border-amber-900 rounded">
        {renderSquares()}
      </div>
    </div>
  );
}
```

### الخطوة 5: صفحة اللعبة الكاملة

```typescript
// client/src/pages/games/chess/[gameId].tsx

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { ChessBoard } from '@/components/games/chess/ChessBoard';
import { GameChat } from '@/components/games/GameChat';
import { VoiceChat } from '@/components/games/VoiceChat';
import { SpectatorList } from '@/components/games/SpectatorList';

export default function ChessGamePage() {
  const { gameId } = useParams();
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [fen, setFen] = useState<string>();
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  
  // الاتصال بـ WebSocket
  useEffect(() => {
    const ws = new WebSocket(`wss://${window.location.host}/ws/chess/${gameId}`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('Connected to chess game');
    };
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      switch (msg.type) {
        case 'game_state':
          setFen(msg.fen);
          setStatus(msg.status);
          setPlayerColor(msg.yourColor);
          break;
          
        case 'move_made':
          setFen(msg.fen);
          if (msg.isCheckmate || msg.isDraw) {
            setStatus('finished');
          }
          break;
          
        case 'chat_message':
          setChatMessages(prev => [...prev, msg]);
          break;
          
        case 'opponent_joined':
          setStatus('playing');
          break;
      }
    };
    
    return () => {
      ws.close();
    };
  }, [gameId]);
  
  // إرسال نقلة
  const handleMove = (move: string) => {
    wsRef.current?.send(JSON.stringify({
      type: 'move',
      move
    }));
  };
  
  // إرسال رسالة
  const handleSendMessage = (message: string) => {
    wsRef.current?.send(JSON.stringify({
      type: 'chat',
      message
    }));
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* منطقة اللعبة */}
      <div className="flex-1">
        <div className="bg-card rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">شطرنج</h1>
            <span className={`badge ${status === 'playing' ? 'badge-success' : 'badge-warning'}`}>
              {status === 'waiting' ? 'في انتظار الخصم' :
               status === 'playing' ? 'جارية' : 'انتهت'}
            </span>
          </div>
          
          <ChessBoard
            gameId={gameId!}
            playerColor={playerColor}
            onMove={handleMove}
            fen={fen}
          />
        </div>
      </div>
      
      {/* الشريط الجانبي */}
      <div className="w-full lg:w-80 space-y-4">
        {/* الشات */}
        <GameChat
          messages={chatMessages}
          onSendMessage={handleSendMessage}
        />
        
        {/* المكالمة الصوتية */}
        <VoiceChat gameId={gameId!} />
        
        {/* قائمة المتفرجين */}
        <SpectatorList gameId={gameId!} />
      </div>
    </div>
  );
}
```

---

## ⚡ تحسين الأداء والسرعة

### 1. تحسين تحميل الأصول (Assets)

```nginx
# nginx.conf - ضغط وتخزين مؤقت

# تفعيل الضغط
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;

# تخزين مؤقت للأصول الثابتة
location /games/ {
    expires 7d;
    add_header Cache-Control "public, immutable";
    
    # ضغط Brotli (أفضل من gzip)
    brotli on;
    brotli_types text/plain text/css application/json application/javascript;
}

location ~* \.(jpg|jpeg|png|gif|webp|svg|ico)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location ~* \.(js|css)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### 2. تحسين الصور

```bash
# تحويل الصور إلى WebP (أصغر حجماً)
# تثبيت أدوات التحويل
sudo apt install webp

# تحويل كل صور PNG
for file in public/games/*/assets/images/*.png; do
  cwebp -q 80 "$file" -o "${file%.png}.webp"
done

# تحويل كل صور JPG
for file in public/games/*/assets/images/*.jpg; do
  cwebp -q 80 "$file" -o "${file%.jpg}.webp"
done
```

```typescript
// استخدام الصور المحسنة في الكود
// تحقق من دعم WebP
function getImageUrl(basePath: string): string {
  // المتصفحات الحديثة تدعم WebP
  if (document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0) {
    return basePath.replace(/\.(png|jpg|jpeg)$/, '.webp');
  }
  return basePath;
}
```

### 3. Lazy Loading للألعاب

```typescript
// client/src/pages/games/index.tsx

import { lazy, Suspense } from 'react';

// تحميل كسول للألعاب الثقيلة
const ChessGame = lazy(() => import('@/components/games/chess/ChessGame'));
const DominoGame = lazy(() => import('@/components/games/domino/DominoGame'));
const SlotMachine = lazy(() => import('@/components/games/slots/SlotMachine'));

function GameLoader() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

export function GameContainer({ gameType }: { gameType: string }) {
  return (
    <Suspense fallback={<GameLoader />}>
      {gameType === 'chess' && <ChessGame />}
      {gameType === 'domino' && <DominoGame />}
      {gameType === 'slots' && <SlotMachine />}
    </Suspense>
  );
}
```

### 4. تحسين WebSocket

```typescript
// server/websocket/optimized.ts

import { WebSocket, WebSocketServer } from 'ws';
import { createHash } from 'crypto';

interface OptimizedWSS {
  wss: WebSocketServer;
  messageQueue: Map<string, any[]>;
  batchInterval: NodeJS.Timer;
}

export function createOptimizedWSS(server: any): OptimizedWSS {
  const wss = new WebSocketServer({ server });
  const messageQueue = new Map<string, any[]>();
  
  // إرسال الرسائل المجمعة كل 50ms
  const batchInterval = setInterval(() => {
    messageQueue.forEach((messages, socketId) => {
      if (messages.length > 0) {
        const socket = findSocketById(wss, socketId);
        if (socket && socket.readyState === WebSocket.OPEN) {
          // ضغط الرسائل المتعددة في رسالة واحدة
          socket.send(JSON.stringify({
            type: 'batch',
            messages
          }));
        }
        messageQueue.set(socketId, []);
      }
    });
  }, 50);
  
  return { wss, messageQueue, batchInterval };
}

// إضافة رسالة للقائمة بدل إرسالها مباشرة
export function queueMessage(queue: Map<string, any[]>, socketId: string, message: any) {
  if (!queue.has(socketId)) {
    queue.set(socketId, []);
  }
  queue.get(socketId)!.push(message);
}

// ضغط البيانات الكبيرة
export function compressGameState(state: any): string {
  // استخدام Delta Compression
  // فقط أرسل التغييرات بدل الحالة الكاملة
  return JSON.stringify(state);
}
```

### 5. تحسين قاعدة البيانات

```typescript
// إضافة فهارس (Indexes) في schema.ts

// مثال: فهرس على جدول game_sessions
export const gameSessions = pgTable('game_sessions', {
  id: serial('id').primaryKey(),
  gameId: varchar('game_id', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('active'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // فهارس لتسريع الاستعلامات
  gameIdIdx: index('game_sessions_game_id_idx').on(table.gameId),
  statusIdx: index('game_sessions_status_idx').on(table.status),
  createdAtIdx: index('game_sessions_created_at_idx').on(table.createdAt),
}));
```

```sql
-- إضافة الفهارس يدوياً
CREATE INDEX CONCURRENTLY idx_game_sessions_active 
ON game_sessions(status) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_game_transactions_user 
ON game_transactions(user_id, created_at DESC);
```

---

## 👥 التعامل مع عدد كبير من المستخدمين

### 1. معمارية قابلة للتوسع

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │    (nginx)      │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  VEX App 1  │    │  VEX App 2  │    │  VEX App 3  │
   │  Port 5001  │    │  Port 5002  │    │  Port 5003  │
   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
               ┌────▼────┐      ┌─────▼─────┐
               │  Redis  │      │ PostgreSQL│
               │ (Cache) │      │    (DB)   │
               └─────────┘      └───────────┘
```

### 2. إعداد PM2 Cluster Mode

```javascript
// ecosystem.config.js

module.exports = {
  apps: [{
    name: 'vex',
    script: 'dist/index.cjs',
    instances: 'max',  // استخدام كل الـ CPU cores
    exec_mode: 'cluster',
    
    // إعدادات الذاكرة
    max_memory_restart: '500M',
    
    // إعادة تشغيل تلقائية
    autorestart: true,
    watch: false,
    
    // متغيرات البيئة
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    
    // التسجيل
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    
    // صحة التطبيق
    listen_timeout: 8000,
    kill_timeout: 5000,
  }]
};
```

```bash
# تشغيل في Cluster Mode
pm2 start ecosystem.config.js --env production

# عرض الحالة
pm2 status

# إعادة تحميل بدون توقف
pm2 reload vex
```

### 3. إضافة Redis للتخزين المؤقت

```bash
# تثبيت Redis
sudo apt install redis-server

# تشغيل Redis
sudo systemctl start redis
sudo systemctl enable redis
```

```typescript
// server/cache/redis.ts

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// تخزين حالة اللعبة مؤقتاً
export async function cacheGameState(gameId: string, state: any, ttl: number = 300) {
  await redis.setex(`game:${gameId}`, ttl, JSON.stringify(state));
}

export async function getCachedGameState(gameId: string) {
  const cached = await redis.get(`game:${gameId}`);
  return cached ? JSON.parse(cached) : null;
}

// تخزين جلسات WebSocket
export async function addPlayerToGame(gameId: string, playerId: string, socketId: string) {
  await redis.hset(`game:${gameId}:players`, playerId, socketId);
}

export async function getGamePlayers(gameId: string): Promise<Record<string, string>> {
  return await redis.hgetall(`game:${gameId}:players`);
}

// نشر الرسائل بين الـ instances
export async function publishGameEvent(gameId: string, event: any) {
  await redis.publish(`game:${gameId}`, JSON.stringify(event));
}

export function subscribeToGameEvents(gameId: string, callback: (event: any) => void) {
  const subscriber = redis.duplicate();
  subscriber.subscribe(`game:${gameId}`);
  subscriber.on('message', (channel, message) => {
    callback(JSON.parse(message));
  });
  return subscriber;
}
```

### 4. إعداد Load Balancer

```nginx
# /etc/nginx/sites-available/vex

upstream vex_backend {
    # توزيع الحمل بين عدة instances
    least_conn;  # اختيار الأقل اتصالات
    
    server 127.0.0.1:5001 weight=1;
    server 127.0.0.1:5002 weight=1;
    server 127.0.0.1:5003 weight=1;
    
    # صحة السيرفرات
    keepalive 32;
}

upstream vex_websocket {
    # IP Hash للـ WebSocket (نفس المستخدم لنفس السيرفر)
    ip_hash;
    
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name vixo.click;
    
    # SSL
    ssl_certificate /etc/letsencrypt/live/vixo.click/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vixo.click/privkey.pem;
    
    # الطلبات العادية
    location / {
        proxy_pass http://vex_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /ws/ {
        proxy_pass http://vex_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
    
    # الألعاب الثابتة (مخزنة مؤقتاً)
    location /games/ {
        alias /var/www/vex/public/games/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. مراقبة الأداء

```typescript
// server/monitoring/metrics.ts

import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from 'prom-client';

// تجميع المقاييس الافتراضية
collectDefaultMetrics();

// عداد اللاعبين النشطين
export const activePlayersGauge = new Gauge({
  name: 'vex_active_players',
  help: 'Number of active players',
  labelNames: ['game']
});

// عداد الألعاب الجارية
export const activeGamesGauge = new Gauge({
  name: 'vex_active_games',
  help: 'Number of active games',
  labelNames: ['game_type']
});

// عداد الطلبات
export const requestCounter = new Counter({
  name: 'vex_requests_total',
  help: 'Total number of requests',
  labelNames: ['method', 'path', 'status']
});

// وقت الاستجابة
export const responseTimeHistogram = new Histogram({
  name: 'vex_response_time_seconds',
  help: 'Response time in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Endpoint للمقاييس
export async function getMetrics() {
  return await register.metrics();
}
```

```typescript
// إضافة endpoint في routes.ts

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await getMetrics());
});
```

---

## 🖥️ تشغيل اللعبة على سيرفر منفصل

### السيناريو: لديك سيرفر VPS إضافي للألعاب

### الخطوة 1: إعداد سيرفر الألعاب

```bash
# على سيرفر الألعاب (games.vixo.click)

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# إنشاء مجلد المشروع
sudo mkdir -p /var/www/vex-games
cd /var/www/vex-games

# نسخ ملفات الألعاب فقط
# من سيرفر VEX الرئيسي
scp -r user@vixo.click:/var/www/vex/server/games .
scp -r user@vixo.click:/var/www/vex/public/games ./public

# تثبيت المتطلبات
npm init -y
npm install express ws chess.js cors helmet
```

### الخطوة 2: إنشاء سيرفر ألعاب مستقل

```typescript
// /var/www/vex-games/server.ts

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// الأمان
app.use(helmet());
app.use(cors({
  origin: ['https://vixo.click', 'https://www.vixo.click'],
  credentials: true
}));

// الألعاب الثابتة
app.use('/games', express.static('public/games'));

// API للألعاب
app.get('/health', (req, res) => {
  res.json({ status: 'ok', games: getActiveGamesCount() });
});

// WebSocket للألعاب
wss.on('connection', (ws, req) => {
  // التحقق من التوكن
  const token = new URL(req.url!, `wss://${req.headers.host}`).searchParams.get('token');
  
  if (!validateToken(token)) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  
  // معالجة اتصال اللعبة
  handleGameConnection(ws, token);
});

// التحقق من التوكن مع السيرفر الرئيسي
async function validateToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  
  try {
    const response = await fetch('https://vixo.click/api/auth/validate-game-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.INTERNAL_API_KEY!
      },
      body: JSON.stringify({ token })
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
```

### الخطوة 3: ربط السيرفر الرئيسي مع سيرفر الألعاب

```typescript
// server/services/gameServerProxy.ts

const GAME_SERVER_URL = process.env.GAME_SERVER_URL || 'https://games.vixo.click';

// توليد توكن للاتصال بسيرفر الألعاب
export function generateGameToken(userId: string, gameId: string): string {
  const payload = {
    userId,
    gameId,
    exp: Date.now() + 3600000 // صالح لساعة
  };
  
  return jwt.sign(payload, process.env.GAME_SERVER_SECRET!);
}

// الحصول على رابط اللعبة
export function getGameConnectionUrl(gameId: string, token: string): string {
  return `wss://games.vixo.click/ws?token=${token}&game=${gameId}`;
}
```

```typescript
// في الـ frontend - الاتصال بسيرفر الألعاب

async function connectToGame(gameId: string) {
  // جلب التوكن من السيرفر الرئيسي
  const response = await fetch('/api/games/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId })
  });
  
  const { token, wsUrl } = await response.json();
  
  // الاتصال بسيرفر الألعاب
  const ws = new WebSocket(wsUrl);
  
  return ws;
}
```

### الخطوة 4: إعداد DNS

```
# إضافة A Record في Cloudflare/Hostinger

games.vixo.click  →  IP سيرفر الألعاب
```

### الخطوة 5: إعداد nginx على سيرفر الألعاب

```nginx
# /etc/nginx/sites-available/games

server {
    listen 80;
    listen 443 ssl http2;
    server_name games.vixo.click;
    
    ssl_certificate /etc/letsencrypt/live/games.vixo.click/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/games.vixo.click/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
    
    location /games/ {
        alias /var/www/vex-games/public/games/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🔧 إصلاح الأخطاء الشائعة

### 1. اللعبة لا تُحمّل

```
❌ المشكلة: شاشة بيضاء أو خطأ 404

✅ الحل:
1. تحقق من مسار الملفات
   ls -la public/games/slot-machine/
   
2. تحقق من صلاحيات الملفات
   chmod -R 755 public/games/
   
3. تحقق من الـ console في المتصفح
   F12 → Console → شوف الأخطاء
   
4. تحقق من إعدادات nginx
   sudo nginx -t
   sudo systemctl restart nginx
```

### 2. WebSocket لا يتصل

```
❌ المشكلة: اللعبة تعمل لكن Multiplayer لا يعمل

✅ الحل:
1. تحقق من إعداد WebSocket في nginx
   location /ws/ {
       proxy_pass http://127.0.0.1:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }

2. تحقق من SSL
   # يجب أن يكون wss:// وليس ws://
   
3. تحقق من الـ CORS
   # تأكد من إضافة origin في server
```

### 3. اللعبة بطيئة

```
❌ المشكلة: تأخر في الاستجابة

✅ الحل:
1. فعّل الضغط
   gzip on;
   gzip_types text/plain application/javascript;

2. استخدم CDN للأصول
   # Cloudflare مجاني
   
3. حسّن الصور
   # حوّل إلى WebP
   
4. قلل عدد الطلبات
   # ادمج ملفات JS/CSS
```

### 4. خطأ في الذاكرة

```
❌ المشكلة: JavaScript heap out of memory

✅ الحل:
1. زد ذاكرة Node.js
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   
2. أصلح تسرب الذاكرة
   # تأكد من تنظيف الـ listeners
   ws.removeAllListeners();
   
3. استخدم PM2 مع إعادة تشغيل تلقائية
   max_memory_restart: '500M'
```

### 5. المستخدم يفقد الاتصال

```
❌ المشكلة: قطع متكرر أثناء اللعب

✅ الحل:
1. أضف heartbeat
   // كل 30 ثانية
   setInterval(() => {
     if (ws.readyState === WebSocket.OPEN) {
       ws.ping();
     }
   }, 30000);

2. أضف إعادة اتصال تلقائي
   ws.onclose = () => {
     setTimeout(() => {
       reconnect();
     }, 3000);
   };

3. زد timeout في nginx
   proxy_read_timeout 86400;
   proxy_send_timeout 86400;
```

### 6. خطأ CORS

```
❌ المشكلة: CORS policy blocked

✅ الحل:
// في Express
app.use(cors({
  origin: ['https://vixo.click'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// في nginx (بديل)
add_header Access-Control-Allow-Origin "https://vixo.click";
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
add_header Access-Control-Allow-Headers "Content-Type, Authorization";
```

---

## ✅ قائمة التحقق النهائية

### قبل إطلاق اللعبة:

```
□ الترخيص واضح ومناسب
□ اللعبة تعمل على الموبايل
□ اللعبة تعمل على الديسكتوب
□ الأصوات تعمل
□ لا توجد أخطاء في Console
□ الرصيد يُخصم صحيحاً
□ الأرباح تُضاف صحيحاً
□ الشات يعمل (إن وُجد)
□ الصوت/المايك يعمل (إن وُجد)
□ المشاهدين يمكنهم المشاهدة (إن وُجد)
□ اللعبة سريعة (< 3 ثواني تحميل)
□ اللعبة مضافة في لوحة التحكم
□ اللعبة تظهر في قائمة الألعاب
```

### بعد الإطلاق:

```
□ راقب الأخطاء في pm2 logs
□ راقب استخدام الذاكرة
□ راقب عدد الاتصالات
□ خذ نسخ احتياطية دورية
□ حدّث اللعبة عند توفر إصدارات جديدة
```

---

## 📞 المساعدة

إذا واجهت مشكلة:

1. **راجع الأخطاء في:**
   - `pm2 logs vex --lines 100`
   - Console المتصفح (F12)
   - `/var/log/nginx/error.log`

2. **ابحث في:**
   - GitHub Issues للمكتبة
   - Stack Overflow
   - توثيق المكتبة

3. **اطلب مساعدة في:**
   - Discord مجتمع Phaser
   - GitHub Discussions

---

*آخر تحديث: يناير 2026*
*الإصدار: 1.0*
