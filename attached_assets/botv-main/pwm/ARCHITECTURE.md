"""PWM API Documentation and Setup Guide"""

# PWM (Project Web Management) - نظام إدارة المشروع

## نظرة عامة
PWM هو نظام متكامل لإدارة المشاريع والمستخدمين والصلاحيات مع لوحة تحكم ويب وAPI احترافي.

## 📋 المميزات الأساسية

### 1. إدارة المستخدمين (User Management)
- تسجيل المستخدمين الجدد
- تسجيل دخول آمن (JWT Authentication)
- إدارة بيانات المستخدم
- تفعيل/تعطيل المستخدمين

### 2. إدارة الأدوار والصلاحيات (RBAC)
- نظام أدوار متقدم (Roles)
- نظام صلاحيات مرن (Permissions)
- ربط الأدوار بالصلاحيات
- فحص الصلاحيات على كل عملية

### 3. إدارة المشاريع (Project Management)
- إنشاء وتعديل المشاريع
- تحديد حالة المشروع
- دعم وصفات مفصلة للمشاريع

### 4. سجل النشاط (Activity Logging)
- تسجيل جميع العمليات المهمة
- تتبع تغييرات المستخدمين
- حفظ الـ IP والمعلومات الأمنية

### 5. لوحة التحكم (Dashboard)
- واجهة ويب حديثة وسهلة الاستخدام
- رسومات تحليلية
- إدارة سريعة للبيانات

## 🔧 البنية التقنية

### الباكند (Backend)
- **Framework**: FastAPI
- **قاعدة البيانات**: PostgreSQL
- **ORM**: SQLAlchemy 2.0
- **الأمان**: JWT + RBAC
- **الهجرات**: Alembic

### الواجهة الأمامية (Frontend)
- **Framework**: Next.js (مقادمة)
- **Styling**: TailwindCSS
- **State Management**: React Hooks
- **API Client**: Axios

## 📊 جداول قاعدة البيانات

### users
- `id`: معرف المستخدم الفريد
- `username`: اسم المستخدم الفريد
- `email`: البريد الإلكتروني
- `full_name`: الاسم الكامل
- `hashed_password`: كلمة المرور المشفرة
- `is_active`: حالة النشاط
- `is_admin`: هل مسؤول النظام
- `role_id`: معرف الدور

### roles
- `id`: معرف الدور الفريد
- `name`: اسم الدور الفريد
- `description`: وصف الدور

### permissions
- `id`: معرف الصلاحية الفريد
- `name`: اسم الصلاحية الفريد
- `description`: وصف الصلاحية
- `resource`: المورد (مثل users, roles)
- `action`: العملية (مثل create, read, update, delete)

### role_permission
- `role_id`: معرف الدور (Foreign Key)
- `permission_id`: معرف الصلاحية (Foreign Key)

### projects
- `id`: معرف المشروع الفريد
- `name`: اسم المشروع
- `slug`: الاسم الموحد (URL-friendly)
- `description`: وصف المشروع
- `is_active`: حالة النشاط

### activity_logs
- `id`: معرف السجل الفريد
- `user_id`: معرف المستخدم (Foreign Key)
- `action`: نوع العملية
- `resource_type`: نوع المورد
- `resource_id`: معرف المورد
- `description`: وصف العملية
- `ip_address`: عنوان IP

## 🔐 الأمان والمصادقة

### JWT (JSON Web Token)
```
Header: Authorization: Bearer <token>
```

### Endpoints المفتوحة
- `POST /auth/login` - تسجيل الدخول
- `POST /auth/register` - التسجيل الجديد
- `GET /health` - فحص صحة الخادم

### Endpoints المحمية
جميع الـ endpoints الأخرى تتطلب JWT صحيح

## 📚 أمثلة الاستخدام

### تسجيل الدخول
```bash
curl -X POST http://localhost:8011/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

### الحصول على المستخدمين
```bash
curl -X GET http://localhost:8011/users/ \
  -H "Authorization: Bearer <token>"
```

### إنشاء مستخدم جديد
```bash
curl -X POST http://localhost:8011/users/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "secure_password",
    "full_name": "New User"
  }'
```

## 🚀 التطوير والاختبارات

### الاختبارات
```bash
pytest pwm/tests/ -v --cov=pwm.backend
```

### إنشاء هجرات جديدة
```bash
alembic -c pwm/database/alembic.ini revision --autogenerate -m "add_new_feature"
```

## 📝 ملاحظات مهمة

1. **الأمان**: غيّر `JWT_SECRET_KEY` في الإنتاج
2. **قاعدة البيانات**: استخدم PostgreSQL في الإنتاج
3. **CORS**: حدّد `CORS_ORIGINS` حسب الحاجة
4. **متغيرات البيئة**: احفظ جميع المفاتيح السرية في `.env.pwm`

---

آخر تحديث: يناير 2026
