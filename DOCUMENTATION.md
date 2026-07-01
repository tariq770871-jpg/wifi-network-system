# وثيقة متكاملة: نظام إدارة شبكات WiFi

## 1. نظرة عامة

### 1.1 اسم المشروع
**WiFi Network Management System** (نظام إدارة شبكات WiFi)

### 1.2 الغرض من المشروع
نظام متكامل لإدارة شبكات WiFi يخدم فريقاً مكوناً من ثلاثة أدوار:
- **الإدارة (Admin)**: مراقبة الأداء، التقارير، توزيع المهام
- **الدعم الفني (Support)**: استقبال البلاغات، التشخيص الأولي، تعيين الفنيين
- **الصيانة الميدانية (Technician)**: تنفيذ المهام، مسح الإشارة، رفع الصور، تحديث الحالة

### 1.3 نطاق الشبكة
شبكة WiFi واحدة كبيرة تمتد عدة حارات وشوارع وبيوت

### 1.4 اللغة
العربية فقط (RTL كامل)

---

## 2. المعمارية التقنية (Architecture)

### 2.1 نمط المعمارية
**Modular Architecture** مع **Service Layer Pattern**
- كل ميزة = module مستقل (routes -> controller -> service -> db)
- طبقة خدمة منفصلة عن منطق التحكم
- إضافة ميزة جديدة = اتباع النمط المعياري

### 2.2 هيكل الطبقات

```
Request -> Routes -> Controller -> Service -> Database
                        |
                    Validation
                        |
                    Response (success/error helpers)
```

### 2.3 المكونات الرئيسية

| المكون | التقنية | الاستضافة | التكلفة |
|--------|---------|-----------|---------|
| Backend API | Node.js + Express | Render.com | مجاني |
| Database | PostgreSQL + PostGIS | Neon.tech | مجاني |
| Web Dashboard | React 19 + Vite | Vercel | مجاني |
| Android App | Flutter (Dart) | APK + Google Play | - |
| API Docs | Swagger UI | مدمج مع Backend | - |

---

## 3. Backend (Node.js + Express)

### 3.1 المتطلبات
- Node.js >= 18.0.0
- npm أو yarn

### 3.2 الاعتماديات (Dependencies)

| الحزمة | الإصدار | الغرض |
|--------|---------|-------|
| express | ^4.18.2 | إطار العمل |
| cors | ^2.8.5 | السماح بالطلبات المتقاطعة |
| dotenv | ^16.3.1 | متغيرات البيئة |
| pg | ^8.11.3 | PostgreSQL client |
| bcryptjs | ^2.4.3 | تشفير كلمات المرور |
| jsonwebtoken | ^9.0.2 | JWT tokens |
| express-validator | ^7.0.1 | التحقق من المدخلات |
| helmet | ^7.1.0 | أمان HTTP headers |
| express-rate-limit | ^7.1.5 | تقييد الطلبات |
| morgan | ^1.10.0 | تسجيل الطلبات |
| socket.io | ^4.7.4 | WebSocket (مستقبلاً) |
| multer | ^1.4.5-lts.1 | رفع الملفات |
| uuid | ^9.0.1 | معرفات فريدة |
| swagger-jsdoc | ^6.2.8 | توثيق API تلقائي |
| swagger-ui-express | ^5.0.1 | واجهة توثيق API |

### 3.3 هيكل المجلدات

```
backend/
├── src/
│   ├── app.js                              # نقطة الدخول + Swagger + CORS
│   ├── modules/                            # الوحدات المعيارية (9)
│   │   ├── auth/
│   │   │   ├── auth.controller.js          # تحكم (يتصل بالـ service)
│   │   │   ├── auth.service.js             # منطق الأعمال (جديد)
│   │   │   ├── auth.routes.js              # مسارات + validation
│   │   │   └── index.js
│   │   ├── users/
│   │   │   ├── users.controller.js
│   │   │   ├── users.service.js            # (جديد)
│   │   │   ├── users.routes.js
│   │   │   └── index.js
│   │   ├── tickets/
│   │   │   ├── tickets.controller.js       # محسّن: error handling موحد
│   │   │   ├── tickets.routes.js           # محسّن: auth guards
│   │   │   └── index.js
│   │   ├── tracking/
│   │   ├── map-points/
│   │   ├── reports/
│   │   ├── signal/
│   │   ├── networks/
│   │   └── devices/
│   └── shared/
│       ├── config/
│       │   └── index.js                    # إعدادات مركزية (جديد)
│       ├── db/
│       │   ├── index.js                    # اتصال PostgreSQL (يستخدم config)
│       │   └── migrate.js                  # إنشاء الجداول
│       ├── middleware/
│       │   ├── auth.js                     # JWT + authorize (يستخدم config)
│       │   ├── errorHandler.js
│       │   └── validate.js                 # validation middleware (جديد)
│       ├── swagger.js                      # إعدادات Swagger (جديد)
│       └── utils/
│           └── response.js                 # success/error helpers
├── tests/
│   ├── health.test.js                      # اختبار الصحة
│   ├── auth.test.js                        # اختبارات المصادقة
│   └── users.test.js                       # اختبارات المستخدمين
├── jest.config.js                          # إعدادات Jest
├── .env.example                            # نموذج المتغيرات (جديد)
├── package.json
└── README.md
```

### 3.4 ما الجديد في هذا التحديث؟

| التحسين | التفاصيل |
|---------|----------|
| **`.env.example`** | نموذج متغيرات البيئة لسهولة الإعداد |
| **`shared/config`** | إعدادات مركزية بدل التشتت |
| **CORS صارم** | لا يوجد fallback لـ `*`، يجب تحديد الأصول صراحة |
| **Swagger API Docs** | توثيق API تفاعلي على `/api-docs` |
| **Service Layer** | طبقة خدمة لـ auth و users (فصل منطق الأعمال) |
| **Validation** | `express-validator` على مسارات auth |
| **Tests** | 3 ملفات اختبار حقيقية (health, auth, users) |
| **Error Handling** | موحد في جميع الـ controllers |
| **Graceful Shutdown** | إغلاق أنيق لاتصالات قاعدة البيانات |
| **Security** | JWT_SECRET من config فقط، لا قيم افتراضية في الإنتاج |

### 3.5 المتغيرات البيئية (.env)

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=your-strong-secret-key
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app
```

### 3.6 API Endpoints

#### Auth
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| POST | /api/auth/register | تسجيل مستخدم | - |
| POST | /api/auth/login | تسجيل الدخول | - |
| GET | /api/auth/me | معلوماتي | أي مستخدم |

#### Users
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| GET | /api/users | قائمة المستخدمين | admin, support |
| GET | /api/users/:id | مستخدم محدد | أي مستخدم |
| PUT | /api/users/:id | تحديث | admin |
| POST | /api/users/:id/tracking | تفعيل/إيقاف تتبع | admin |
| POST | /api/users/me/veto | الفيتو | technician |

#### Tickets
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| GET | /api/tickets | قائمة البلاغات | أي مستخدم |
| GET | /api/tickets/:id | بلاغ محدد | أي مستخدم |
| POST | /api/tickets | إنشاء بلاغ | admin, support |
| PUT | /api/tickets/:id | تحديث | أي مستخدم |
| DELETE | /api/tickets/:id | حذف | admin |
| POST | /api/tickets/:id/assign | تعيين فني | admin, support |
| POST | /api/tickets/:id/start | بدء العمل | technician |
| POST | /api/tickets/:id/complete | إكمال | technician |

#### Tracking
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| POST | /api/tracking/log | تسجيل موقع | technician |
| GET | /api/tracking/live | مواقع حية | admin, support |
| GET | /api/tracking/path/:userId | مسار فني | admin, support |
| POST | /api/tracking/signal | تسجيل قراءة إشارة | technician |
| GET | /api/tracking/signal | قراءات الإشارة | أي مستخدم |

#### Map Points
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| GET | /api/map-points | قائمة النقاط | أي مستخدم |
| POST | /api/map-points | إضافة نقطة | technician |
| POST | /api/map-points/:id/review | مراجعة | admin, support |
| DELETE | /api/map-points/:id | حذف | admin |

#### Reports
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| GET | /api/reports/dashboard | إحصائيات الداشبورد | admin |
| GET | /api/reports/technicians | أداء الفنيين | admin |

#### Documentation
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | /api-docs | توثيق Swagger التفاعلي |
| GET | /api-docs.json | مواصفات OpenAPI |

### 3.7 الأمان

- **CORS**: أصول محددة صراحة (لا يوجد wildcard)
- **JWT**: HS256 مع secret من env (بدون fallback في الإنتاج)
- **Helmet**: حماية HTTP headers
- **Rate Limiting**: 100 طلب / 15 دقيقة
- **SQL Injection**: استعلامات parameterized
- **Password Hashing**: bcrypt (10 rounds)
- **Validation**: express-validator على المدخلات

### 3.8 الأوامر

```bash
npm install          # تثبيت الاعتماديات
npm run dev          # تشغيل التطوير (nodemon)
npm start            # تشغيل الإنتاج
npm run migrate      # إنشاء الجداول
npm test             # تشغيل الاختبارات
```

---

## 4. Android App (Flutter)

### 4.1 الاعتماديات الرئيسية

| الحزمة | الغرض |
|--------|-------|
| go_router | التنقل |
| flutter_map + latlong2 | الخريطة |
| geolocator | GPS |
| wifi_scan + network_info_plus | مسح WiFi |
| battery_plus | حالة البطارية |
| http | HTTP requests |
| shared_preferences + sqflite | تخزين محلي |
| flutter_bloc + equatable | State management |
| permission_handler | الأذونات |
| image_picker | اختيار الصور |
| flutter_local_notifications | الإشعارات |

### 4.2 الأوامر

```bash
flutter pub get           # تثبيت الاعتماديات
flutter run               # تشغيل على الجهاز
flutter build apk         # بناء APK
flutter build appbundle   # بناء AAB
```

---

## 5. Web Dashboard (React + Vite)

### 5.1 الاعتماديات الرئيسية

| الحزمة | الغرض |
|--------|-------|
| react 19 + react-dom | UI library |
| react-router-dom 7 | التنقل |
| @tanstack/react-query 5 | Server state |
| zustand 5 | Global state |
| tailwindcss 4 | CSS framework |
| recharts | Charts |
| leaflet + react-leaflet | Maps |
| lucide-react | Icons |
| axios | HTTP client |
| date-fns | Dates |

### 5.2 الأوامر

```bash
npm install      # تثبيت الاعتماديات
npm run dev      # تشغيل التطوير (localhost:5173)
npm run build    # بناء الإنتاج
```

---

## 6. النشر (Deployment)

### 6.1 Backend (Render.com)
1. Push to GitHub
2. Connect Render.com to repo
3. Set environment variables (DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS)
4. Build: `npm install`
5. Start: `npm start`

### 6.2 Database (Neon.tech)
1. Create project on neon.tech
2. Get connection string → `DATABASE_URL`
3. Run: `npm run migrate`

### 6.3 Web (Vercel)
1. Connect Vercel to repo
2. Set `VITE_API_URL`
3. Framework: Vite

### 6.4 Android (Google Play)
1. `flutter build appbundle --release`
2. Upload to Google Play Console

---

## 7. سير العمل الكامل (Workflow)

```
العميل يبلّغ → الدعم يدخل البلاغ → تعيين فني → الفني يستلم
→ يتوجه للموقع (GPS) → يبدأ العمل → يمسح الإشارة → يرفع ملاحظات
→ يكمل البلاغ → الإدارة تشوف التقرير
```
