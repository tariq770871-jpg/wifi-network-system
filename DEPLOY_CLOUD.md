# دليل النشر السحابي

## المتطلبات
- حساب GitHub
- حساب Render.com (مجاني)
- حساب Neon.tech (مجاني)
- حساب Vercel (مجاني)

---

## الخطوة 1: قاعدة البيانات (Neon.tech)

1. ادخل على [neon.tech](https://neon.tech)
2. أنشئ مشروع جديد
3. اختر PostgreSQL
4. انسخ connection string:
   ```
   postgresql://username:password@ep-xxx.neon.tech/wifi_network?sslmode=require
   ```

---

## الخطوة 2: Backend (Render.com)

1. ادخل على [render.com](https://render.com)
2. أنشئ Web Service جديد
3. اربطه بـ GitHub repo
4. املأ الإعدادات:
   - **Name**: wifi-network-api
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. أضف Environment Variables:
   ```
   DATABASE_URL=postgresql://... (من Neon)
   JWT_SECRET=اكتب-64-حرف-عشوائي
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```

6. اضغط Deploy

7. بعد النجاح، انسخ الرابط:
   ```
   https://wifi-network-api.onrender.com
   ```

---

## الخطوة 3: Web Dashboard (Vercel)

1. ادخل على [vercel.com](https://vercel.com)
2. أنشئ مشروع جديد من GitHub
3. اختر المجلد `/web`
4. املأ الإعدادات:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. أضف Environment Variable:
   ```
   VITE_API_URL=https://wifi-network-api.onrender.com/api
   ```

6. اضغط Deploy

7. بعد النجاح، انسخ الرابط:
   ```
   https://your-app.vercel.app
   ```

---

## الخطوة 4: Android

1. افتح `android/lib/core/constants.dart`
2. عدّل `apiBaseUrl`:
   ```dart
   static const String apiBaseUrl = 'https://wifi-network-api.onrender.com/api';
   ```

3. شغّل:
   ```bash
   flutter build apk --release
   ```

4. ارفع APK على Google Play أو شاركه مباشرة

---

## الخطوة 5: إنشاء Admin User (أول مرة)

بعد ما يشتغل الـ Backend، أنشئ أول admin:

```bash
curl -X POST https://wifi-network-api.onrender.com/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "admin",
    "password": "your-strong-password",
    "full_name": "المشرف",
    "role": "admin"
  }'
```

---

## الروابط النهائية

| الخدمة | الرابط |
|--------|--------|
| Backend API | https://wifi-network-api.onrender.com |
| Web Dashboard | https://your-app.vercel.app |
| Database | Neon.tech (داخلي) |
| Android APK | Google Play أو مباشر |

---

## ملاحظات مهمة

1. **Render Free Tier**: ينام بعد 15 دقيقة من عدم الاستخدام
   - الحل: استخدم ping service (مثل UptimeRobot) لإبقائه مستيقظاً

2. **Neon Free Tier**: 10,000 connections/month
   - يكفي للمشاريع الصغيرة

3. **Vercel Free Tier**: لا حدود للـ static sites
   - ممتاز للـ frontend

4. **Google Maps API**: $200/month free tier
   - يكفي لمعظم الاستخدامات

---

## أمر التشغيل السريع (للتجربة فقط)

```bash
# Backend (محلياً - للتطوير فقط)
cd backend
npm install
npm run dev

# Web (محلياً - للتطوير فقط)
cd web
npm install
npm run dev
```

**للإنتاج: استخدم الخطوات أعلاه (Render + Vercel)**
