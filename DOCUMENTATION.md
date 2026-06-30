# وثيقة متكاملة: نظام إدارة شبكات WiFi

## 1. نظرة عامة

### 1.1 اسم المشروع
**WiFi Network Management System** (نظام إدارة شبكات WiFi)

### 1.2 الغرض من المشروع
نظام متكامل لإدارة شبكات WiFi يخدم فريقاً مكوناً من ثلاثة أدوار:
- **الإدارة**: مراقبة الأداء، التقارير، توزيع المهام
- **الدعم الفني**: استقبال البلاغات، التشخيص الأولي، تعيين الفنيين
- **الصيانة الميدانية**: تنفيذ المهام، مسح الإشارة، رفع الصور، تحديث الحالة

### 1.3 نطاق الشبكة
شبكة WiFi واحدة كبيرة تمتد عدة حارات وشوارع وبيوت

### 1.4 اللغة
العربية فقط (RTL كامل)

---

## 2. المعمارية التقنية (Architecture)

### 2.1 نمط المعمارية
**Modular Architecture** (معمارية معيارية)
- كل ميزة = module مستقل
- إضافة ميزة جديدة = 3 خطوات (Backend + Android + Web)
- لا يؤثر على الموجود

### 2.2 المكونات الرئيسية

| المكون | التقنية | الاستضافة | التكلفة |
|--------|---------|-----------|---------|
| Backend API | Node.js + Express | Render.com | مجاني |
| Database | PostgreSQL + PostGIS | Neon.tech | مجاني |
| Web Dashboard | React 19 + Vite | Vercel | مجاني |
| Android App | Flutter (Dart) | APK + Google Play | - |
| Maps | Google Satellite + OpenStreetMap | - | مجاني (Google: $200/شهر) |

---

## 3. Backend (Node.js + Express)

### 3.1 المسار
`wifi_network_app/backend/`

### 3.2 المتطلبات
- Node.js >= 18.0.0
- npm أو yarn

### 3.3 الاعتماديات (Dependencies)

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

### 3.4 هيكل المجلدات

```
backend/
├── src/
│   ├── app.js                          # نقطة الدخول الرئيسية
│   ├── modules/                        # الوحدات المعيارية (9)
│   │   ├── auth/                       # المصادقة
│   │   │   ├── auth.controller.js      # منطق التسجيل والدخول
│   │   │   ├── auth.routes.js          # المسارات
│   │   │   └── index.js                # التصدير
│   │   ├── users/                      # المستخدمين
│   │   │   ├── users.controller.js     # CRUD + التتبع + الفيتو
│   │   │   ├── users.routes.js         # المسارات
│   │   │   └── index.js
│   │   ├── tickets/                    # البلاغات
│   │   │   ├── tickets.controller.js   # CRUD + تعيين + إكمال
│   │   │   ├── tickets.routes.js
│   │   │   └── index.js
│   │   ├── tracking/                   # التتبع الحي
│   │   │   ├── tracking.controller.js  # تسجيل موقع + قراءات إشارة
│   │   │   ├── tracking.routes.js
│   │   │   └── index.js
│   │   ├── map-points/                 # نقاط الخريطة
│   │   │   ├── map-points.controller.js # إضافة + مراجعة
│   │   │   ├── map-points.routes.js
│   │   │   └── index.js
│   │   ├── reports/                    # التقارير
│   │   │   ├── reports.controller.js   # إحصائيات + أداء
│   │   │   ├── reports.routes.js
│   │   │   └── index.js
│   │   ├── signal/                     # إشارة (placeholder)
│   │   ├── networks/                   # شبكات (placeholder)
│   │   └── devices/                    # أجهزة (placeholder)
│   └── shared/                         # مشترك
│       ├── db/
│       │   ├── index.js                # اتصال PostgreSQL (Pool)
│       │   └── migrate.js              # إنشاء الجداول
│       ├── middleware/
│       │   ├── auth.js                 # JWT middleware + authorize
│       │   └── errorHandler.js         # معالج الأخطاء
│       └── utils/
│           └── response.js             # success/error helpers
├── package.json
├── .env.example                        # نموذج المتغيرات
└── README.md
```

### 3.5 الجداول في قاعدة البيانات

#### users (المستخدمون)
```sql
id SERIAL PRIMARY KEY
username VARCHAR(50) UNIQUE NOT NULL
email VARCHAR(100) UNIQUE
full_name VARCHAR(100) NOT NULL
hashed_password VARCHAR(255) NOT NULL
role VARCHAR(20) DEFAULT 'technician' CHECK ('admin', 'support', 'technician')
phone VARCHAR(20)
is_active BOOLEAN DEFAULT true
tracking_enabled BOOLEAN DEFAULT false
tracking_veto BOOLEAN DEFAULT false
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

#### tickets (البلاغات)
```sql
id SERIAL PRIMARY KEY
title VARCHAR(200) NOT NULL
description TEXT
customer_name VARCHAR(100) NOT NULL
customer_phone VARCHAR(20)
customer_address VARCHAR(255)
location_lat DOUBLE PRECISION
location_lng DOUBLE PRECISION
status VARCHAR(20) DEFAULT 'pending' CHECK ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')
priority VARCHAR(20) DEFAULT 'medium' CHECK ('low', 'medium', 'high', 'urgent')
created_by INTEGER REFERENCES users(id)
assigned_to INTEGER REFERENCES users(id)
created_at TIMESTAMP
created_at TIMESTAMP
started_at TIMESTAMP
completed_at TIMESTAMP
```

#### map_points (نقاط الخريطة)
```sql
id SERIAL PRIMARY KEY
name VARCHAR(200) NOT NULL
note TEXT
location_lat DOUBLE PRECISION NOT NULL
location_lng DOUBLE PRECISION NOT NULL
created_by INTEGER REFERENCES users(id)
reviewed_by INTEGER REFERENCES users(id)
status VARCHAR(20) DEFAULT 'pending' CHECK ('pending', 'approved', 'rejected')
created_at TIMESTAMP
reviewed_at TIMESTAMP
```

#### tracking_logs (سجلات التتبع)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id)
lat DOUBLE PRECISION NOT NULL
lng DOUBLE PRECISION NOT NULL
heading DOUBLE PRECISION
speed DOUBLE PRECISION
battery INTEGER
signal_dbm INTEGER
ticket_id INTEGER REFERENCES tickets(id)
created_at TIMESTAMP
```

#### signal_readings (قراءات الإشارة - للخريطة الحرارية)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id)
ticket_id INTEGER REFERENCES tickets(id)
lat DOUBLE PRECISION NOT NULL
lng DOUBLE PRECISION NOT NULL
signal_dbm INTEGER NOT NULL
ssid VARCHAR(100)
timestamp TIMESTAMP
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
| POST | /api/users/me/veto | الفيتو (إيقاف تتبعي) | technician |

#### Tickets
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| GET | /api/tickets | قائمة البلاغات | أي مستخدم |
| GET | /api/tickets/:id | بلاغ محدد | أي مستخدم |
| POST | /api/tickets | إنشاء بلاغ | admin, support |
| PUT | /api/tickets/:id | تحديث | أي مستخدم |
| POST | /api/tickets/:id/assign | تعيين فني | admin, support |
| POST | /api/tickets/:id/start | بدء العمل | technician |
| POST | /api/tickets/:id/complete | إكمال | technician |
| DELETE | /api/tickets/:id | حذف | admin |

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
| GET | /api/map-points/my-requests | طلباتي | technician |
| GET | /api/map-points/:id | نقطة محددة | أي مستخدم |
| POST | /api/map-points | إضافة نقطة | technician |
| POST | /api/map-points/:id/review | مراجعة | admin, support |
| DELETE | /api/map-points/:id | حذف | admin |

#### Reports
| الطريقة | المسار | الوصف | الصلاحية |
|---------|--------|-------|----------|
| GET | /api/reports/dashboard | إحصائيات الداشبورد | admin |
| GET | /api/reports/technicians | أداء الفنيين | admin |

### 3.7 منطق التتبع (Tracking Logic)

```
الإدارة تشغّل التتبع (tracking_enabled = true)
           ↓
الفني يبث موقعه كل 10 ثواني (GPS)
           ↓
الفني يضغط "إيقاف مؤقتاً" (tracking_veto = true)
           ↓
التطبيق يوقف البث
           ↓
الإدارة تشوف "آخر موقع معروف" + علامة ⏸
           ↓
الفني يضغط "استأنف" (tracking_veto = false)
           ↓
يبث مرة أخرى (إذا كان tracking_enabled = true)
```

---

## 4. Android App (Flutter)

### 4.1 المسار
`wifi_network_app/android/`

### 4.2 Flutter SDK
>= 3.0.0 < 4.0.0

### 4.3 الاعتماديات (pubspec.yaml)

| الحزمة | الإصدار | الغرض |
|--------|---------|-------|
| go_router | ^14.8.1 | التنقل |
| flutter_map | ^8.1.1 | الخريطة |
| latlong2 | ^0.9.1 | الإحداثيات |
| flutter_map_tile_caching | ^10.0.0 | تخزين Tiles |
| geolocator | ^13.0.2 | GPS |
| wifi_scan | ^0.4.1 | مسح WiFi |
| network_info_plus | ^6.1.3 | معلومات الشبكة |
| battery_plus | ^6.2.1 | حالة البطارية |
| http | ^1.3.0 | HTTP requests |
| shared_preferences | ^2.5.3 | تخزين محلي |
| sqflite | ^2.4.2 | SQLite محلي |
| path_provider | ^2.1.5 | مسارات الملفات |
| flutter_bloc | ^9.0.0 | State management |
| equatable | ^2.0.7 | المقارنة |
| intl | ^0.20.2 | التعريب |
| permission_handler | ^11.4.0 | الأذونات |
| image_picker | ^1.1.2 | اختيار الصور |
| flutter_local_notifications | ^19.0.0 | الإشعارات |

### 4.4 هيكل المجلدات

```
android/
├── lib/
│   ├── main.dart                          # نقطة الدخول
│   ├── core/
│   │   ├── api_service.dart               # HTTP client + JWT
│   │   ├── app_router.dart                # GoRouter configuration
│   │   ├── constants.dart                 # الثوابت
│   │   └── theme.dart                     # الثيم RTL
│   ├── features/
│   │   ├── auth/
│   │   │   └── screens/
│   │   │       ├── splash_screen.dart     # شاشة البداية + التحقق
│   │   │       └── login_screen.dart      # تسجيل الدخول
│   │   ├── tickets/
│   │   │   └── screens/
│   │   │       ├── tickets_list_screen.dart  # قائمة البلاغات
│   │   │       └── ticket_detail_screen.dart # تفاصيل البلاغ
│   │   ├── tracking/
│   │   │   └── screens/
│   │   │       └── live_map_screen.dart   # خريطة حية + تتبع
│   │   ├── signal_scan/
│   │   │   └── screens/
│   │   │       ├── signal_scan_screen.dart  # مسح WiFi + dBm
│   │   │       └── heatmap_screen.dart      # خريطة حرارية
│   │   └── map_points/
│   │       └── screens/
│   │           └── map_points_screen.dart   # إضافة نقطة (ضغط مطول)
│   └── shared/
│       ├── screens/
│       │   └── main_layout.dart           # BottomNavigationBar RTL
│       ├── widgets/
│       │   ├── loading_widget.dart        # CircularProgressIndicator
│       │   └── error_widget.dart          # رسالة خطأ + إعادة
│       └── utils/
├── assets/
└── pubspec.yaml
```

### 4.5 الميزات

#### 4.5.1 Splash Screen
- يتحقق من JWT token
- إذا موجود → Tickets
- إذا لا → Login

#### 4.5.2 Login Screen
- اسم مستخدم + كلمة مرور
- حفظ token في SharedPreferences
- RTL كامل

#### 4.5.3 Tickets List
- قائمة البلاغات مع الفلترة
- ألوان الحالة: برتقالي/أزرق/بنفسجي/أخضر
- أولوية: منخفض/متوسط/عالي/عاجل
- Pull-to-refresh

#### 4.5.4 Live Map (الخريطة الحية)
- **Google Satellite** (افتراضي)
- **OpenStreetMap** (زر تبديل)
- GPS يتبع الموقع
- يبث للـ Backend كل 10 ثواني
- زر "موقعي" ينقل للموقع الحالي

#### 4.5.5 Signal Scan (مسح الإشارة)
- زر "ابدأ الفحص"
- يمسح شبكات WiFi المحيطة
- يعرض: SSID + dBm + Frequency
- الألوان: أخضر (>-50) / برتقالي (>-70) / أحمر (<-70)
- يرسل القراءات للـ Backend
- يعمل كل 10 ثواني

#### 4.5.6 Heatmap (الخريطة الحرارية)
- يعرض قراءات الإشارة على الخريطة
- دوائر ملونة: أخضر/أصفر/أحمر
- قمر صناعي خلفية

#### 4.5.7 Map Points (نقاط الخريطة)
- **ضغط مطول** على الخريطة = إضافة نقطة
- نافذة: الاسم (إلزامي) + ملاحظة (اختياري)
- إرسال للـ Backend (status = pending)
- قائمة "طلباتي" مع الحالة
- النقاط المعتمدة تظهر بالأحمر على الخريطة

---

## 5. Web Dashboard (React + Vite)

### 5.1 المسار
`wifi_network_app/web/`

### 5.2 المتطلبات
- Node.js >= 18
- npm

### 5.3 الاعتماديات

| الحزمة | الإصدار | الغرض |
|--------|---------|-------|
| react | ^19.0.0 | UI library |
| react-dom | ^19.0.0 | DOM renderer |
| react-router-dom | ^7.1.0 | التنقل |
| axios | ^1.7.9 | HTTP client |
| react-query | ^3.39.3 | State management + cache |
| zustand | ^5.0.3 | Global state (auth) |
| tailwindcss | ^4.0.0 | CSS framework |
| @tailwindcss/vite | ^4.0.0 | Tailwind Vite plugin |
| recharts | ^2.15.0 | Charts |
| lucide-react | ^0.469.0 | Icons |
| react-hot-toast | ^2.5.1 | Notifications |
| date-fns | ^4.1.0 | Date formatting |
| leaflet | ^1.9.4 | Maps engine |
| react-leaflet | ^5.0.0 | React wrapper for Leaflet |

### 5.4 هيكل المجلدات

```
web/
├── index.html                          # HTML entry (dir="rtl" lang="ar")
├── vite.config.js                      # Vite config + proxy
├── package.json
├── .env                                # VITE_API_URL
├── src/
│   ├── main.jsx                        # React entry + QueryClient
│   ├── App.jsx                         # Routes + Toaster
│   ├── index.css                       # Tailwind CSS imports
│   ├── components/
│   │   ├── Layout.jsx                  # Sidebar + NavigationBar RTL
│   │   ├── ProtectedRoute.jsx          # JWT check
│   │   └── StatCard.jsx                # بطاقة إحصائية
│   ├── pages/
│   │   ├── LoginPage.jsx               # تسجيل الدخول
│   │   ├── Dashboard/
│   │   │   └── DashboardPage.jsx       # إحصائيات + Charts
│   │   ├── Tickets/
│   │   │   └── TicketsPage.jsx         # إدارة البلاغات + تعيين
│   │   ├── Tracking/
│   │   │   └── TrackingPage.jsx        # خريطة حية + فنيين
│   │   ├── MapPoints/
│   │   │   └── MapPointsPage.jsx       # مراجعة + موافقة/رفض
│   │   └── Reports/
│   │       └── ReportsPage.jsx         # تقارير + أداء
│   ├── hooks/
│   │   └── useAuth.js                  # Zustand store (auth)
│   └── services/
│       ├── api.js                      # Axios instance + interceptors
│       ├── auth.service.js             # Auth API
│       ├── tickets.service.js          # Tickets API
│       ├── users.service.js            # Users API
│       ├── tracking.service.js         # Tracking API
│       ├── mapPoints.service.js        # Map Points API
│       └── reports.service.js          # Reports API
└── public/
```

### 5.5 الميزات

#### 5.5.1 Login Page
- تصميم حديث (gradient background)
- JWT token → localStorage
- توجيه تلقائي

#### 5.5.2 Layout (Sidebar RTL)
- Sidebar قابل للطي
- Navigation items: الرئيسية، البلاغات، التتبع، النقاط، التقارير
- معلومات المستخدم + logout

#### 5.5.3 Dashboard
- 4 بطاقات إحصائية: إجمالي/معلق/قيد التنفيذ/مكتمل
- رسم بياني: البلاغات اليومية (BarChart)
- رسم دائري: توزيع الحالات (PieChart)

#### 5.5.4 Tickets
- جدول البلاغات مع الفلترة
- تعيين فني (dropdown)
- حالات ملونة
- أولويات

#### 5.5.5 Tracking (Live)
- **قائمة الفنيين** (يسار): الاسم + الحالة + البطارية + السرعة
- **خريطة** (يمين): Leaflet + Google Satellite
- تحديث تلقائي كل 5/10/30 ثانية
- Popup معلومات

#### 5.5.6 Map Points (Review)
- إحصائيات: معلقة/معتمدة/مرفوضة
- فلترة حسب الحالة
- زر "موافقة" (أخضر) / "رفض" (أحمر)
- خريطة تظهر النقاط المعتمدة فقط

#### 5.5.7 Reports
- بطاقات إحصائية
- BarChart: البلاغات اليومية
- PieChart: توزيع الحالات
- جدول أداء الفنيين مع شريط التقدم

---

## 6. الخريطة (Maps)

### 6.1 Android (Flutter)
| الطبقة | المصدر | التخزين |
|--------|--------|---------|
| قمر صناعي | Google Satellite | NetworkTileProvider |
| عادية | OpenStreetMap | flutter_map_tile_caching (كاش 30 يوم) |

### 6.2 Web (React)
| الطبقة | المصدر |
|--------|--------|
| قمر صناعي | Google Satellite (Leaflet TileLayer) |

### 6.3 التخزين المؤقت (Android)
```
1. أول مرة: تحميل Tiles من الإنترنت
2. المرات التالية: قراءة من الكاش المحلي
3. حذف تلقائي بعد 30 يوم
4. مجلد الكاش: /storage/emulated/0/Android/data/[package]/cache/tiles/
```

---

## 7. التتبع الحي (Live Tracking)

### 7.1 البيانات المُرسلة (كل 10 ثواني)
```json
{
  "user_id": 1,
  "lat": 24.7136,
  "lng": 46.6753,
  "heading": 45.0,
  "speed": 12.5,
  "battery": 78,
  "signal_dbm": -65,
  "ticket_id": 123,
  "created_at": "2026-06-26T05:27:00Z"
}
```

### 7.2 حالات الفني على الخريطة
| الحالة | الأيقونة | اللون |
|--------|----------|-------|
| يبث حياً | 👷 | أخضر |
| موقوف يدوياً (فيتو) | 👷⏸ | أصفر |
| غير متصل | 👷❌ | رمادي |
| انتهى البلاغ | 👷✅ | أزرق |

### 7.3 تحكم الإدارة
- تفعيل/إيقاف تتبع فني محدد
- تفعيل/إيقاف الكل
- مدة محددة (اختياري)
- سجل الأوامر

---

## 8. نقاط الخريطة (Map Points)

### 8.1 القواعد
- الاسم: **إلزامي**
- الملاحظة: **اختياري**
- موافقة الإدارة: **إلزامية**
- لا تصنيف (لا تغطية/تركيب)
- لا منع تكرار

### 8.2 سير العمل
```
الفني (Android)
  ↓
ضغط مطول على الخريطة
  ↓
إدخال الاسم + ملاحظة
  ↓
إرسال الطلب (status = pending)
  ↓
قائمة "بانتظار الموافقة"
  ↓
الإدارة (Web) تشوف الطلب
  ↓
  ├─ ✅ موافقة → تظهر على الخريطة للجميع
  └─ ❌ رفض → تختفي من قائمة الانتظار
```

---

## 9. الأمان

### 9.1 JWT Authentication
- Header: `Authorization: Bearer <token>`
- مدة الصلاحية: 24 ساعة
- التشفير: HS256

### 9.2 الصلاحيات (Roles)
| الدور | الصلاحيات |
|-------|-----------|
| admin | كل شيء |
| support | البلاغات + التتبع + النقاط (بدون حذف) |
| technician | البلاغات المخصصة له + التتبع + المسح + النقاط |

### 9.3 الحماية
- helmet (HTTP headers)
- rate limiting (100 request / 15 min)
- CORS
- SQL injection protection (parameterized queries)
- Password hashing (bcrypt)

---

## 10. النشر (Deployment)

### 10.1 Backend (Render.com)
```bash
# 1. Push to GitHub
# 2. Connect Render.com to repo
# 3. Set environment variables (DATABASE_URL, JWT_SECRET)
# 4. Build command: npm install
# 5. Start command: npm start
# 6. Free tier: sleeps after 15 min inactivity
```

### 10.2 Database (Neon.tech)
```bash
# 1. Create project on neon.tech
# 2. Get connection string
# 3. Add to DATABASE_URL
# 4. Run: npm run migrate
```

### 10.3 Web (Vercel)
```bash
# 1. Push to GitHub
# 2. Connect Vercel to repo
# 3. Set VITE_API_URL
# 4. Framework: Vite
# 5. Build command: npm run build
# 6. Output directory: dist
```

### 10.4 Android (Google Play)
```bash
# 1. flutter build apk --release
# 2. flutter build appbundle --release
# 3. Upload to Google Play Console
```

---

## 11. المتغيرات البيئة

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/wifi_network?sslmode=require
JWT_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://your-render-app.onrender.com
```

### Web (.env)
```
VITE_API_URL=https://your-render-app.onrender.com/api
```

---

## 12. الأوامر المهمة

### Backend
```bash
npm install          # تثبيت الاعتماديات
npm run dev          # تشغيل التطوير (nodemon)
npm start            # تشغيل الإنتاج
npm run migrate      # إنشاء الجداول
npm test             # تشغيل الاختبارات
```

### Android
```bash
flutter pub get      # تثبيت الاعتماديات
flutter run          # تشغيل على الجهاز
flutter build apk    # بناء APK
flutter build appbundle  # بناء AAB
```

### Web
```bash
npm install          # تثبيت الاعتماديات
npm run dev          # تشغيل التطوير (localhost:5173)
npm run build        # بناء الإنتاج
npm run preview      # معاينة البناء
```

---

## 13. المشاكل المعروفة والحلول

| المشكلة | الحل |
|---------|------|
| Android لا يعطي dBm للشبكات الأخرى | استخدام wifi_scan package |
| Google Maps API Key | إنشاء مشروع في Google Cloud Console |
| Render.com sleeps after 15 min | Upgrade أو استخدام ping service |
| Neon.tech connection limit | Free tier: 10 connections |
| Flutter map tiles كبيرة | تحديد zoom (15-18) + كاش |

---

## 14. التوسع المستقبلي (Placeholder Modules)

| الوحدة | الوصف |
|--------|-------|
| signal | تحليل إشارة متقدم |
| networks | إدارة الشبكات |
| devices | إدارة الأجهزة (Access Points) |
| chat | دردشة بين الفريق |
| notifications | Push notifications |
| offline_mode | العمل بدون إنترنت |
| multi_language | لغات إضافية |

---

## 15. إحصائيات المشروع

| المقياس | القيمة |
|---------|--------|
| إجمالي الملفات | 78 |
| Backend files | 36 |
| Android files | 17 |
| Web files | 25 |
| Backend modules | 9 |
| Android features | 5 |
| Web pages | 5 |
| Database tables | 5 |
| API endpoints | 35+ |

---

## 16. المسؤوليات حسب الدور

### 👨‍💼 الإدارة (Admin)
- داشبورد إحصائي
- تقارير وأداء الفنيين
- تفعيل/إيقاف تتبع الفنيين
- مراجعة نقاط الخريطة (موافقة/رفض)
- إدارة المستخدمين

### 👨‍💻 الدعم الفني (Support)
- استقبال البلاغات
- تعيين فني للبلاغ
- متابعة حالة البلاغات
- مراجعة نقاط الخريطة
- مشاهدة التتبع الحي

### 👨‍🔧 الفني الميداني (Technician)
- استلام المهام
- التنقل للموقع (GPS)
- مسح الإشارة (WiFi scan)
- رفع صور/ملاحظات
- تحديث حالة البلاغ
- إضافة نقاط خريطة
- التحكم في التتبع (فيتو)

---

## 17. سير العمل الكامل (Workflow)

```
1. العميل يبلّغ عن مشكلة (واتساب/اتصال)
   ↓
2. الدعم يدخل البلاغ في النظام (Web)
   ↓
3. الإدارة/الدعم يعين فني (Web)
   ↓
4. الفني يستلم إشعار (Android)
   ↓
5. الفني يتوجه للموقع (GPS + خريطة قمر صناعي)
   ↓
6. الفني يبدأ العمل (Android)
   ↓
7. الفني يمسح الإشارة (WiFi scan + dBm)
   ↓
8. الفني يرفع صور/ملاحظات (Android)
   ↓
9. الفني يكمل البلاغ (Android)
   ↓
10. الإدارة تشوف التقرير (Web Dashboard)
```

---

## 18. الملفات المُنشأة

### Backend (36 ملف)
- src/app.js
- src/modules/*/index.js (9)
- src/modules/*/*.controller.js (9)
- src/modules/*/*.routes.js (9)
- src/shared/db/index.js
- src/shared/db/migrate.js
- src/shared/middleware/auth.js
- src/shared/middleware/errorHandler.js
- src/shared/utils/response.js
- package.json
- .env.example
- README.md

### Android (17 ملف)
- lib/main.dart
- lib/core/api_service.dart
- lib/core/app_router.dart
- lib/core/constants.dart
- lib/core/theme.dart
- lib/features/auth/screens/splash_screen.dart
- lib/features/auth/screens/login_screen.dart
- lib/features/tickets/screens/tickets_list_screen.dart
- lib/features/tickets/screens/ticket_detail_screen.dart
- lib/features/tracking/screens/live_map_screen.dart
- lib/features/signal_scan/screens/signal_scan_screen.dart
- lib/features/signal_scan/screens/heatmap_screen.dart
- lib/features/map_points/screens/map_points_screen.dart
- lib/shared/screens/main_layout.dart
- lib/shared/widgets/loading_widget.dart
- lib/shared/widgets/error_widget.dart
- pubspec.yaml

### Web (25 ملف)
- index.html
- vite.config.js
- package.json
- .env
- src/main.jsx
- src/App.jsx
- src/index.css
- src/components/Layout.jsx
- src/components/ProtectedRoute.jsx
- src/components/StatCard.jsx
- src/pages/LoginPage.jsx
- src/pages/Dashboard/DashboardPage.jsx
- src/pages/Tickets/TicketsPage.jsx
- src/pages/Tracking/TrackingPage.jsx
- src/pages/MapPoints/MapPointsPage.jsx
- src/pages/Reports/ReportsPage.jsx
- src/hooks/useAuth.js
- src/services/api.js
- src/services/auth.service.js
- src/services/tickets.service.js
- src/services/users.service.js
- src/services/tracking.service.js
- src/services/mapPoints.service.js
- src/services/reports.service.js
- README.md

---

## 19. الخاتمة

هذا المشروع نظام متكامل لإدارة شبكات WiFi يعمل على ثلاث منصات:
- **Backend**: Node.js + Express + PostgreSQL (Neon.tech)
- **Android**: Flutter (Dart)
- **Web**: React 19 + Vite + Tailwind CSS

المعمارية معيارية (Modular) قابلة للتوسع، وكل الميزات الأساسية مُنجزة:
- إدارة البلاغات
- التتبع الحي مع الفيتو
- مسح الإشارة والخريطة الحرارية
- نقاط الخريطة مع موافقة الإدارة
- تقارير وإحصائيات
- RTL كامل بالعربية

جميع الاستضافات مجانية (Render + Neon + Vercel).
