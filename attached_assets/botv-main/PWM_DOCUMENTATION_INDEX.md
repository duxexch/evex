# 📚 PWM Documentation Index

## نظام إدارة المشروع - مؤشر التوثيق الكامل

---

## 📖 الملفات الرئيسية

### 📝 ملفات التوثيق

1. **[PWM_SETUP_COMPLETED.md](PWM_SETUP_COMPLETED.md)** ✅
   - ملخص المرحلة الأولى
   - قائمة ما تم إنجازه
   - الحالة الحالية للمشروع

2. **[PWM_DEPLOYMENT_GUIDE.md](PWM_DEPLOYMENT_GUIDE.md)** 🚀
   - دليل النشر على الإنتاج
   - إعدادات Docker
   - إعدادات Nginx
   - الأمان والمراقبة

3. **[pwm/README.md](pwm/README.md)** 📖
   - دليل البدء السريع
   - شرح الهيكل
   - قائمة الـ Endpoints
   - أمثلة الاستخدام

4. **[pwm/ARCHITECTURE.md](pwm/ARCHITECTURE.md)** 🏗️
   - وثائق العمارة
   - شرح جداول قاعدة البيانات
   - نماذج الأمان
   - أمثلة مفصلة

---

## 🛠️ ملفات الإعداد والتكوين

### البيئة والإعدادات
- **pwm/.env.pwm** - متغيرات البيئة الأساسية
- **pwm/.env.pwm.example** - قالب متغيرات البيئة
- **pwm/requirements.txt** - متطلبات Python
- **pwm/.gitignore** - ملف git ignore

### التشغيل والتطوير
- **pwm/run.py** - سكريبت تشغيل الـ API
- **pwm/setup.sh** - سكريبت إعداد المشروع
- **pwm/migrate.sh** - سكريبت الهجرات
- **pwm_quickstart.sh** - دليل البدء السريع
- **pwm_health_check.sh** - فحص صحة المشروع

### Docker والنشر
- **pwm/Dockerfile.pwm** - صورة Docker للـ Backend
- **pwm/frontend/Dockerfile** - صورة Docker للـ Frontend
- **docker-compose.prod.yml** - ملف Docker Compose (محدّث)
- **nginx.conf** - إعدادات Nginx (محدّث)

---

## 📁 هيكل مشروع PWM

```
pwm/
├── backend/
│   ├── main.py              # نقطة الدخول الرئيسية
│   ├── core/                # الإعدادات والأمان
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── models/              # نماذج قاعدة البيانات
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── role.py
│   │   ├── permission.py
│   │   ├── project.py
│   │   └── activity_log.py
│   ├── schemas/             # Pydantic Schemas
│   │   └── schemas.py
│   ├── routers/             # API Routes
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── roles.py
│   │   └── projects.py
│   ├── services/            # Business Logic
│   │   ├── user_service.py
│   │   └── role_service.py
│   └── utils/               # Utilities
├── frontend/                # Next.js Frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── postcss.config.js
├── database/                # Alembic Migrations
│   ├── env.py
│   ├── alembic.ini
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_migration.py
├── tests/                   # Unit Tests
│   └── test_api.py
├── requirements.txt
├── .env.pwm
├── .env.pwm.example
├── .gitignore
├── Dockerfile.pwm
├── run.py
├── setup.sh
├── migrate.sh
├── README.md
└── ARCHITECTURE.md
```

---

## 🚀 البدء السريع

### 1. الإعداد الأولي

```bash
# تشغيل سكريبت البدء السريع
bash pwm_quickstart.sh

# أو يدويًا
cd pwm
pip install -r requirements.txt
```

### 2. إعداد قاعدة البيانات

```bash
# تطبيق الهجرات
bash migrate.sh upgrade

# أو
cd pwm
alembic -c database/alembic.ini upgrade head
```

### 3. تشغيل الـ API

```bash
cd pwm
python run.py

# سيكون متاحًا على:
# http://localhost:8011
# http://localhost:8011/docs (Swagger)
```

### 4. تشغيل عبر Docker

```bash
docker compose -f docker-compose.prod.yml up pwm-api pwm-web
```

---

## 📚 API Endpoints

### Authentication
```
POST   /auth/login      - تسجيل الدخول
POST   /auth/register   - التسجيل الجديد
```

### Users
```
GET    /users/          - الحصول على جميع المستخدمين
GET    /users/{id}      - الحصول على مستخدم
POST   /users/          - إنشاء مستخدم جديد
PUT    /users/{id}      - تعديل مستخدم
DELETE /users/{id}      - حذف مستخدم
```

### Roles
```
GET    /roles/          - الحصول على جميع الأدوار
GET    /roles/{id}      - الحصول على دور
POST   /roles/          - إنشاء دور جديد
PUT    /roles/{id}      - تعديل دور
DELETE /roles/{id}      - حذف دور
```

### Projects
```
GET    /projects/       - الحصول على جميع المشاريع
GET    /projects/{id}   - الحصول على مشروع
POST   /projects/       - إنشاء مشروع جديد
PUT    /projects/{id}   - تعديل مشروع
DELETE /projects/{id}   - حذف مشروع
```

### Health
```
GET    /health          - فحص صحة الخادم
```

---

## 🧪 الاختبارات

```bash
# تشغيل جميع الاختبارات
pytest pwm/tests/ -v

# مع تغطية الكود
pytest pwm/tests/ --cov=pwm.backend

# اختبار محدد
pytest pwm/tests/test_api.py::test_health_check -v
```

---

## 🔐 الأمان

- ✅ JWT Authentication
- ✅ Bcrypt Password Hashing
- ✅ RBAC (Role-Based Access Control)
- ✅ CORS Protection
- ✅ SQL Injection Prevention (SQLAlchemy ORM)
- ✅ Health Check Monitoring

---

## 📊 قاعدة البيانات

### الجداول الرئيسية

| الجدول | الوصف |
|---------|-------|
| users | المستخدمون |
| roles | الأدوار |
| permissions | الصلاحيات |
| role_permission | الربط بين الأدوار والصلاحيات |
| projects | المشاريع |
| activity_logs | سجل النشاط |

---

## 🆘 استكشاف الأخطاء

### فحص صحة المشروع

```bash
bash pwm_health_check.sh
```

### مشاكل شائعة

| المشكلة | الحل |
|--------|------|
| لا يمكن الاتصال بـ PostgreSQL | تأكد من تشغيل قاعدة البيانات وتحديث credentials |
| `ModuleNotFoundError` | شغّل `pip install -r requirements.txt` |
| Port already in use | غيّر `PWM_API_PORT` في `.env.pwm` |
| CORS errors | حدّث `PWM_CORS_ORIGINS` في `.env.pwm` |

---

## 📈 المراحل القادمة

- [ ] المرحلة 2: تطوير الـ Frontend الكامل
- [ ] المرحلة 3: تكامل أعمق مع النظام الأساسي
- [ ] المرحلة 4: إضافة مميزات متقدمة
- [ ] المرحلة 5: الأمان والاختبارات الشاملة
- [ ] المرحلة 6: النشر والإطلاق

---

## 💡 نصائح مهمة

1. **غيّر JWT_SECRET_KEY في الإنتاج**
2. **استخدم PostgreSQL في الإنتاج (ليس SQLite)**
3. **فعّل HTTPS/SSL**
4. **عمل نسخ احتياطية منتظمة**
5. **مراقبة السجلات والأداء**

---

## 📞 الدعم والمساهمة

- الأسئلة والمشاكل: افتح Issue
- المساهمات: أنشئ Pull Request
- التوثيق: حدّث الملفات المناسبة

---

## 📄 الترخيص

MIT License

---

**آخر تحديث**: يناير 7، 2026

للمزيد من المعلومات، راجع الملفات المرتبطة أعلاه.
