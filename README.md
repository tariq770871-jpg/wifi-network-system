# WiFi Network Management System

نظام إدارة شبكات WiFi - مشروع متكامل

## المكونات

| المكون | التقنية | المسار |
|--------|---------|--------|
| Backend API | Node.js + Express | `/backend` |
| Android App | Flutter | `/android` |
| Web Dashboard | React + Vite | `/web` |

## التشغيل السريع

### Backend
```bash
cd backend
npm install
cp .env.example .env
# عدّل DATABASE_URL
npm run migrate
npm run dev
```

### Android
```bash
cd android
flutter pub get
flutter run
```

### Web
```bash
cd web
npm install
npm run dev
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

## الميزات

- ✅ إدارة البلاغات (CRUD + تعيين + إكمال)
- ✅ التتبع الحي (GPS + الفيتو)
- ✅ مسح WiFi (dBm + خريطة حرارية)
- ✅ نقاط الخريطة (موافقة الإدارة)
- ✅ تقارير وإحصائيات
- ✅ RTL عربي كامل
- ✅ خريطة قمر صناعي + OpenStreetMap

## الترخيص
MIT License
