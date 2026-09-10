# WiFi Network Management System

نظام إدارة شبكات WiFi - مشروع متكامل (مع تكامل MikroTik + Docker + CI/CD)

## المكونات

| المكون | التقنية | المسار |
|--------|---------|--------|
| Backend API | Node.js + Express | `/backend` |
| Android App | Flutter | `/android` |
| Web Dashboard | React + Vite | `/web` |

## التشغيل السريع

### ⚡ خيار 1: Docker (الأسهل - كل شيء بأمر واحد)
```bash
docker compose up -d --build
# الواجهة: http://localhost:8080
# API: http://localhost:3000
# Swagger: http://localhost:3000/api-docs
```

### 🔧 خيار 2: يدوي

#### Backend
```bash
cd backend
npm install
cp .env.example .env
# عدّل DATABASE_URL
npm run migrate
npm run dev
```

#### Web
```bash
cd web
npm install
npm run dev
```

#### Android
```bash
cd android
flutter pub get
flutter run
```

## الاختبارات

```bash
cd backend
NODE_ENV=test npx jest --runInBand
```

حالياً: **67 اختباراً في 9 حزم** (auth+كوكيز الجلسة, users, tickets, tracking, map-points, health, devices+MikroTik, security, signal+networks)

### حزمة اختبار Docker بأمر واحد
```bash
./scripts/test.sh
# أو: docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from tests
```
تشغّل PostgreSQL + الترحيلات + كل الاختبارات معزولة ثم تخرج بكود النجاح/الفشل.

### اختبارات E2E (Playwright)
```bash
cd web
npx playwright install chromium   # مرة واحدة
npx playwright test              # يتطلب API على :3000 (أو CI يشغّلها تلقائياً)
```
تغطي: عرض نموذج الدخول، حماية المسارات، الدخول عبر كوكي HttpOnly، رسائل الخطأ، وظيفة إضافة نقطة الخريطة.

## CI/CD

سير عمل GitHub Actions في `.github/workflows/ci.yml`:
1. **backend-lint**: فحص جودة الكود ESLint
2. **backend-tests**: الاختبارات مع PostgreSQL حقيقي + seed smoke test
3. **dependency-audit**: npm audit للـ backend والويب
4. **secret-scan**: كشف الأسرار المضمعة
5. **web-build**: بناء الإنتاج + التحقق من أصول PWA
6. **docker-build**: بناء صور Docker

مع **Dependabot** لتحديث الاعتماديات تلقائياً (backend, web, android, actions)

يعمل تلقائياً عند كل push إلى main/master وعلى كل Pull Request.

## تكامل MikroTik (منقول من مشروع ntsm)

وحدة الأجهزة `/api/devices` تدعم الآن:
- ربط أجهزة MikroTik (IP + منفذ API + مستخدم + كلمة مرور مشفرة AES)
- اختبار الاتصال: `POST /api/devices/:id/test` — يقرأ الهوية والـ SSID
- قراءة الموارد الحية: `GET /api/devices/:id/status` (CPU، الذاكرة، مدة التشغيل)
- حارس مهلة صارم (8 ثوانٍ افتراضياً، قابل للتعديل عبر `MIKROTIK_TIMEOUT_MS`)
- سجل حالة الأجهزة في جدول `device_status_logs`

متغيرات البيئة الإضافية:
```env
MIKROTIK_ENCRYPTION_KEY=مفتاح-تشفير-قوي
MIKROTIK_TIMEOUT_MS=8000
```

## الوثيقة المتكاملة
راجع `DOCUMENTATION.md` للتفاصيل الكاملة.

## الاستضافة

| الخدمة | الاستخدام | التكلفة |
|--------|-----------|---------|
| Render.com | Backend API | مجاني |
| Neon.tech | PostgreSQL | مجاني |
| Vercel | Web Dashboard | مجاني |
| Google Play | Android App | - |

دليل النشر خطوة بخطوة: `DEPLOY_CLOUD.md` | دليل العمليات: `OPERATIONS.md`

## الميزات

- ✅ إدارة البلاغات (CRUD + تعيين + إكمال)
- ✅ التتبع الحي (GPS + الفيتو)
- ✅ مسح WiFi (dBm + خريطة حرارية)
- ✅ نقاط الخريطة (موافقة الإدارة)
- ✅ تقارير وإحصائيات
- ✅ **إدارة الأجهزة + تكامل MikroTik (جديد)**
- ✅ **Docker + docker-compose (جديد)**
- ✅ **CI/CD بـ GitHub Actions (جديد)**
- ✅ **65 اختبار آلي + ESLint نظيف (جديد وموسّع)**
- ✅ **PWA (manifest + offline service worker) (جديد)**
- ✅ **حماية helmet + منع تصعيد الصلاحيات + seed admin (جديد)**
- ✅ **i18n عربي/إنجليزي للـ API (جديد)**
- ✅ **سجلات JSON منظمة + Request-ID correlation (جديد)**
- ✅ **دليل عمليات: نسخ احتياطي، استعادة، rollback (OPERATIONS.md)**
- ✅ RTL عربي كامل
- ✅ خريطة قمر صناعي + OpenStreetMap

## الترخيص
MIT License
