# WiFi Network Manager - Backend

نظام إدارة شبكات WiFi - Backend API

## المتطلبات
- Node.js 18+
- PostgreSQL (Neon.tech)

## التثبيت

```bash
npm install
```

## الإعداد

1. انسخ `.env.example` إلى `.env`
2. عدّل متغيرات البيئة

## تشغيل قاعدة البيانات

```bash
npm run migrate
```

## التشغيل

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

| المسار | الوصف |
|--------|-------|
| POST /api/auth/register | تسجيل مستخدم جديد |
| POST /api/auth/login | تسجيل الدخول |
| GET /api/auth/me | معلوماتي |
| GET /api/users | قائمة المستخدمين |
| POST /api/users/:id/tracking | تفعيل/إيقاف تتبع |
| POST /api/users/me/veto | الفيتو |
| GET /api/tickets | البلاغات |
| POST /api/tickets | إنشاء بلاغ |
| POST /api/tickets/:id/assign | تعيين فني |
| POST /api/tickets/:id/start | بدء العمل |
| POST /api/tickets/:id/complete | إكمال |
| GET /api/map-points | نقاط الخريطة |
| POST /api/map-points | إضافة نقطة |
| POST /api/map-points/:id/review | مراجعة نقطة |
| POST /api/tracking/log | تسجيل موقع |
| GET /api/tracking/live | مواقع حية |
| GET /api/reports/dashboard | إحصائيات |

## الـ Stack
- Node.js + Express
- PostgreSQL (Neon.tech)
- JWT Authentication
- Modular Architecture
