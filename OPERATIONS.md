# Runbook العمليات التشغيلية
# ============================
## دليل تشغيل وإدارة النظام في الإنتاج (criterion 11 + 20)

---

## 1. النسخ الاحتياطي Backup

### نسخة يدوية
```bash
# استخراج نسخة كاملة من قاعدة البيانات (Neon أو أي PostgreSQL)
pg_dump "$DATABASE_URL" --format=custom --file=backup_$(date +%Y%m%d_%H%M).dump

# أو عبر Docker على VPS
docker compose exec -T db pg_dump -U wifi wifi_network | gzip > backup_$(date +%Y%m%d_%H%M).sql.gz
```

### نسخ تلقائي يومي (VPS — crontab)
```bash
# crontab -e  |  يومياً 3 فجراً + الاحتفاظ 7 أيام
0 3 * * * cd /path/to/wifi-network-system && docker compose exec -T db pg_dump -U wifi wifi_network | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz && find /backups -name "*.sql.gz" -mtime +7 -delete
```

### الاستعادة Restore
```bash
# من نسخة custom format
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backup_20260910.dump

# من نسخة sql.gz
gunzip -c backup_20260910.sql.gz | docker compose exec -T db psql -U wifi wifi_network
```

**جدولة مقترحة**: يومية للنسخ، أسبوعية لاختبار الاستعادة، شهرياً لمراجعة الصلاحيات.

---

## 2. التراجع Rollback

### نشر تطبيقي (Render/Vercel)
1. افتح Deployments في لوحة الخدمة
2. اختر النسخة السابقة السليمة → **Redeploy**
3. الـ rollback يستغرق 2-5 دقائق دون فترة انقطاع تُذكر

### قاعدة البيانات
- الترحيلات كلها `CREATE TABLE IF NOT EXISTS` — آمنة إعادة التشغيل
- لا يوجد migrations هادفة أسفل (destructive) — أي حذف أعمدة مستقبلاً يجب أن يمر بخطوتين (إضافة → ترحيل → حذف)
- عند طوارئ: استعد آخر backup (القسم 1)

### Docker على VPS
```bash
# التراجع لصورة سابقة
docker compose down api
docker tag wifi-network-api:previous wifi-network-api:latest
docker compose up -d api
```

---

## 3. فحوص الدخول Smoke Tests (بعد كل نشر)

```bash
BASE=https://your-api-host

# 1. الصحة (يجب أن يعيد db: ok)
curl -s "$BASE/health" | grep -o '"db":"ok"'

# 2. أمان الهيدرز
curl -sI "$BASE/health" | grep -i "x-content-type-options"

# 3. الضغط مفعّل
curl -sI -H "Accept-Encoding: gzip" "$BASE/health" | grep -i content-encoding

# 4. حماية تسجيل admin (يجب أن يفشل بـ 400)
curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"intruder","password":"123456","full_name":"x","role":"admin"}'

# 5. المصادقة تعمل (يجب 401)
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/tickets"
```

---

## 4. الاستجابة للحوادث Incident Response

| الحالة | الإجراء الفوري |
|--------|----------------|
| API لا يستجيب | افحص `/health` → لوحات Render → سجلات `docker compose logs api` |
| DB degraded | `/health` يعرض `db:degraded` → افحص Neon status / اتصالات VPS |
| تسجيل دخول مشبوه | غيّر `JWT_SECRET` (يُبطل كل التوكنات فوراً) + أعد نشر الـ API |
| تسريب سر | دوّر السر في المصدر + حدّث متغيرات البيئة + أعد النشر |
| فني يبث موقعاً دون علمه | الآلية مدمجة: `tracking_enabled` + `tracking_veto` لكل مستخدم — عطّلها من /users |

### مفاتيح الإبطال الطارئ
```bash
# إبطال جميع الجلسات (JWT): غيّر السر وأعد النشر
JWT_SECRET=<قيمة-جديدة-عشوائية-32+>

# إيقاف كل شيء فوراً (VPS)
docker compose down
```

---

## 5. المراقبة اليومية

- **كل صباح**: `/health` + عداد البلاغات المعلقة
- **أسبوعياً**: `npm audit` في CI + مراجعة سجلات Render
- **شهرية**: مراجعة مستخدمين/صلاحيات + اختبار استعادة نسخة احتياطية + تحديث اعتماديات Dependabot

### رفع مستوى المراقبة لاحقاً (اختياري)
- UptimeRobot / Better Stack على `/health` (تنبيهات فورية مجانية)
- Sentry (متغير `SENTRY_DSN` جاهز في الإعدادات عند الحاجة)
