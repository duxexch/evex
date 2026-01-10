# PWM Project Structure README

## نظام إدارة المشروع (Project Web Management - PWM)

PWM هو نظام متكامل لإدارة المشاريع والمستخدمين والصلاحيات مع لوحة تحكم ويب وAPI احترافي.

### 📁 البنية الأساسية

```
pwm/
├── backend/                  # FastAPI Backend
│   ├── main.py             # نقطة الدخول الرئيسية
│   ├── core/               # إعدادات وأمان
│   │   ├── config.py       # تكوين التطبيق
│   │   ├── database.py     # إعدادات قاعدة البيانات
│   │   └── security.py     # JWT وكلمات المرور
│   ├── models/             # نماذج ORM
│   │   ├── base.py         # الفئة الأساسية
│   │   ├── user.py         # نموذج المستخدم
│   │   ├── role.py         # نموذج الدور
│   │   ├── permission.py   # نموذج الصلاحية
│   │   ├── project.py      # نموذج المشروع
│   │   └── activity_log.py # سجل النشاط
│   ├── schemas/            # Pydantic Schemas
│   │   └── schemas.py      # جميع الـ Schemas
│   ├── routers/            # API Routers
│   │   ├── auth.py         # مسارات المصادقة
│   │   ├── users.py        # مسارات المستخدمين
│   │   ├── roles.py        # مسارات الأدوار
│   │   └── projects.py     # مسارات المشاريع
│   ├── services/           # Business Logic
│   │   ├── user_service.py   # خدمات المستخدم
│   │   └── role_service.py   # خدمات الدور
│   └── utils/              # أدوات عامة
├── frontend/               # Next.js Frontend (WIP)
├── database/               # Alembic Migrations
│   ├── env.py             # بيئة Alembic
│   ├── alembic.ini        # إعدادات Alembic
│   ├── script.py.mako     # قالب السكريبت
│   └── versions/          # ملفات الهجرات
│       └── 001_initial_migration.py
├── tests/                 # Unit Tests
│   └── test_api.py        # اختبارات API
├── requirements.txt       # متطلبات Python
├── .env.pwm              # متغيرات البيئة
└── Dockerfile.pwm        # صورة Docker
```

### 🚀 البدء السريع

#### متطلبات:
- Python 3.11+
- PostgreSQL 13+
- Node.js 18+ (للواجهة الأمامية)

#### إعداد الباكند:

```bash
# 1. انتقل إلى مجلد pwm
cd pwm

# 2. أنشئ بيئة افتراضية
python -m venv venv
source venv/bin/activate  # على Linux/Mac
# أو
venv\Scripts\activate  # على Windows

# 3. ثبت المتطلبات
pip install -r requirements.txt

# 4. عيّن متغيرات البيئة
cp .env.pwm .env.pwm  # عدّل القيم حسب الحاجة

# 5. شغّل الهجرات
alembic -c pwm/database/alembic.ini upgrade head

# 6. ابدأ الخادم
python pwm/backend/main.py
```

الـ API ستكون متاحة على: http://localhost:8011

### 📚 API Endpoints

#### المصادقة (Authentication)
- `POST /auth/login` - تسجيل الدخول
- `POST /auth/register` - إنشاء حساب جديد

#### المستخدمين (Users)
- `GET /users/` - الحصول على جميع المستخدمين
- `GET /users/{user_id}` - الحصول على مستخدم
- `POST /users/` - إنشاء مستخدم جديد
- `PUT /users/{user_id}` - تعديل مستخدم
- `DELETE /users/{user_id}` - حذف مستخدم

#### الأدوار (Roles)
- `GET /roles/` - الحصول على جميع الأدوار
- `GET /roles/{role_id}` - الحصول على دور
- `POST /roles/` - إنشاء دور جديد
- `PUT /roles/{role_id}` - تعديل دور
- `DELETE /roles/{role_id}` - حذف دور

#### المشاريع (Projects)
- `GET /projects/` - الحصول على جميع المشاريع
- `GET /projects/{project_id}` - الحصول على مشروع
- `POST /projects/` - إنشاء مشروع جديد
- `PUT /projects/{project_id}` - تعديل مشروع
- `DELETE /projects/{project_id}` - حذف مشروع

#### الصحة (Health)
- `GET /health` - فحص صحة الخادم

### 🔐 الأمان

- **JWT Authentication**: استخدام JWT لتوثيق المستخدمين
- **RBAC**: نظام الأدوار والصلاحيات (Role-Based Access Control)
- **Password Hashing**: استخدام bcrypt لتشفير كلمات المرور
- **CORS**: تفعيل CORS للاتصالات الآمنة

### 📊 قاعدة البيانات

#### الجداول:
- **users**: المستخدمون
- **roles**: الأدوار
- **permissions**: الصلاحيات
- **role_permission**: الربط بين الأدوار والصلاحيات (Many-to-Many)
- **projects**: المشاريع
- **activity_logs**: سجل النشاط

### 🧪 الاختبارات

```bash
# تشغيل جميع الاختبارات
pytest pwm/tests/ -v

# تشغيل اختبار محدد
pytest pwm/tests/test_api.py::test_health_check -v

# مع تغطية الكود
pytest pwm/tests/ --cov=pwm.backend
```

### 📝 الهجرات (Migrations)

```bash
# إنشاء هجرة جديدة
alembic -c pwm/database/alembic.ini revision --autogenerate -m "add_new_column"

# تطبيق الهجرات
alembic -c pwm/database/alembic.ini upgrade head

# الرجوع للإصدار السابق
alembic -c pwm/database/alembic.ini downgrade -1
```

### 🐳 Docker

```bash
# بناء صورة Docker
docker build -f pwm/Dockerfile.pwm -t pwm-api:latest .

# تشغيل الحاوية
docker run -p 8011:8011 --env-file pwm/.env.pwm pwm-api:latest
```

### 📋 متغيرات البيئة (.env.pwm)

```env
# API
PWM_API_PORT=8011
PWM_ENV=development

# Database
PWM_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/pwm_db

# JWT
JWT_SECRET_KEY=your-super-secret-key
JWT_ALGORITHM=HS256

# CORS
PWM_CORS_ORIGINS=["http://localhost:3012"]
```

### 🤝 المساهمة

1. أنشئ فرع جديد (`git checkout -b feature/amazing-feature`)
2. أرسل التغييرات (`git commit -m 'Add amazing feature'`)
3. ادفع الفرع (`git push origin feature/amazing-feature`)
4. افتح Pull Request

### 📄 الترخيص

هذا المشروع مرخص تحت MIT License

---

**آخر تحديث**: يناير 2026
