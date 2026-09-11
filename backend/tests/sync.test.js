/**
 * اختبارات مزامنة التبويبات (Task 16)
 * ------------------------------------
 * يغطي الشكوى الأساسية: "أحفظ جهاز ولا يظهر" — كل مساحة عرض
 * (تبويب الأجهزة / الخريطة / الداشبورد) يجب أن تعكس نفس البيانات.
 */
const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

describe('Cross-tab sync: Devices ↔ Map ↔ Dashboard', () => {
    let adminToken;
    let techToken;
    const suffix = Date.now();

    beforeAll(async () => {
        ({ token: adminToken } = await createAuthenticatedUser({ role: 'admin', prefix: 'sync' }));
        ({ token: techToken } = await createAuthenticatedUser({ role: 'technician', prefix: 'synct' }));
    });

    describe('فلتر has_location (الأجهزة على الخريطة)', () => {
        test('يعيد فقط الأجهزة ذات الإحداثيات ويستبعد غير المواقعية', async () => {
            // جهاز بموقع GPS
            const withLoc = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `SyncGPS-${suffix}`,
                    location_lat: 24.7136,
                    location_lng: 46.6753,
                    coordinate_source: 'gps',
                    gps_accuracy: 12,
                });
            expect(withLoc.status).toBe(201);

            // جهاز بلا موقع
            const noLoc = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: `SyncNoLoc-${suffix}` });
            expect(noLoc.status).toBe(201);

            const res = await request(app)
                .get('/api/devices?has_location=true&limit=500')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            const items = res.body.data.items;
            // كل عنصر معاد يجب أن يحمل إحداثيات
            for (const d of items) {
                expect(d.location_lat).not.toBeNull();
                expect(d.location_lng).not.toBeNull();
            }
            // كلاهما موجودان في القائمة الكاملة (البحث باللاحقة الفريدة لهذا التشغيل)
            const all = await request(app)
                .get(`/api/devices?search=${suffix}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(all.status).toBe(200);
            const names = all.body.data.items.map(d => d.name);
            expect(names).toContain(`SyncGPS-${suffix}`);
            expect(names).toContain(`SyncNoLoc-${suffix}`);
        });

        test('limit=500 مقبول لطلبات الخريطة (كان الحد 100)', async () => {
            const res = await request(app)
                .get('/api/devices?has_location=true&limit=500')
                .set('Authorization', `Bearer ${techToken}`);
            expect(res.status).toBe(200);
        });

        test('limit فوق 500 يرفض 400', async () => {
            const res = await request(app)
                .get('/api/devices?limit=501')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(400);
        });

        test('الفني يقرأ الأجهزة المواقعية (عرض الخريطة لكل الأدوار)', async () => {
            const res = await request(app)
                .get('/api/devices?has_location=true')
                .set('Authorization', `Bearer ${techToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data.items)).toBe(true);
        });
    });

    describe('الداشبورد يعكس الأجهزة والنقاط (مزامنة العدادات)', () => {
        test('إضافة جهاز بموقع ترفع عدادات devices في /reports/dashboard', async () => {
            const before = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(before.status).toBe(200);
            const beforeTotal = before.body.data.devices?.total ?? 0;
            const beforeWithLoc = before.body.data.devices?.with_location ?? 0;

            await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `DashDevice-${suffix}`,
                    device_type: 'router',
                    location_lat: 24.8,
                    location_lng: 46.7,
                    coordinate_source: 'manual',
                    status: 'online',
                });

            const after = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(after.body.data.devices.total).toBe(beforeTotal + 1);
            expect(after.body.data.devices.with_location).toBe(beforeWithLoc + 1);
            expect(after.body.data.devices.online).toBeGreaterThanOrEqual(1);
        });

        test('إضافة نقطة ترفع pending، واعتمادها ينقل العدّاد إلى approved', async () => {
            const before = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);
            const pendBefore = before.body.data.map_points?.find(m => m.status === 'pending')?.count || 0;
            const apprBefore = before.body.data.map_points?.find(m => m.status === 'approved')?.count || 0;

            // الفني يضيف نقطة من الخريطة
            const created = await request(app)
                .post('/api/map-points')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    name: `SyncPoint-${suffix}`,
                    location_lat: 24.75,
                    location_lng: 46.72,
                    note: 'من تدفق الخريطة',
                });
            expect(created.status).toBe(200); // الخادم يعيد 200 الافتراضي عند إنشاء النقاط (سلوك قائم)
            const pointId = created.body.data.id;

            const mid = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);
            const pendMid = mid.body.data.map_points?.find(m => m.status === 'pending')?.count || 0;
            expect(pendMid).toBe(pendBefore + 1);

            // المدير يعتمد → pending يعود، approved يرتفع
            const reviewed = await request(app)
                .post(`/api/map-points/${pointId}/review`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'approved' });
            expect(reviewed.status).toBe(200);

            const after = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);
            const pendAfter = after.body.data.map_points?.find(m => m.status === 'pending')?.count || 0;
            const apprAfter = after.body.data.map_points?.find(m => m.status === 'approved')?.count || 0;
            expect(pendAfter).toBe(pendBefore);
            expect(apprAfter).toBe(apprBefore + 1);
        });

        test('النقطة المعتمدة تبقى نقطة خريطة ولا تتحول لجهاز (فصل واضح للمفاهيم)', async () => {
            const res = await request(app)
                .get(`/api/devices?search=SyncPoint-${suffix}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items).toHaveLength(0);
        });
    });

    describe('صلاحيات الداشبورد المصلحة', () => {
        test('الفني يصل للداشبورد (كان 403 — وهو يرى الصفحة الرئيسية)', async () => {
            const res = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${techToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.devices).toBeDefined();
            expect(res.body.data.map_points).toBeDefined();
        });

        test('بدون توكن → 401 كما هو', async () => {
            const res = await request(app).get('/api/reports/dashboard');
            expect(res.status).toBe(401);
        });

        test('أداء الفنيين التفصيلي يبقى محصوراً بالمدير/الدعم', async () => {
            const techRes = await request(app)
                .get('/api/reports/technicians')
                .set('Authorization', `Bearer ${techToken}`);
            expect(techRes.status).toBe(403);

            const adminRes = await request(app)
                .get('/api/reports/technicians')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(adminRes.status).toBe(200);
        });
    });

    describe('تدفق "حفظ جهاز من الخريطة" (الشكوى الأصلية)', () => {
        test('جهاز محفوظ بإحداثيات من الخريطة يظهر في بحث تبويب الأجهزة فوراً', async () => {
            const created = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `FromMap-${suffix}`,
                    device_type: 'access_point',
                    notes: 'أضيف من نموذج الخريطة',
                    location_lat: 24.77,
                    location_lng: 46.74,
                    coordinate_source: 'manual',
                    status: 'offline',
                });
            expect(created.status).toBe(201);

            // نفس ما يفعله تبويب الأجهزة: بحث بالاسم
            const found = await request(app)
                .get(`/api/devices?search=FromMap-${suffix}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(found.status).toBe(200);
            expect(found.body.data.items).toHaveLength(1);
            expect(found.body.data.items[0].name).toBe(`FromMap-${suffix}`);
            expect(found.body.data.items[0].coordinate_source).toBe('manual');

            // ويظهر ضمن الأجهزة المواقعية على الخريطة
            const onMap = await request(app)
                .get('/api/devices?has_location=true&limit=500')
                .set('Authorization', `Bearer ${adminToken}`);
            const mapNames = onMap.body.data.items.map(d => d.name);
            expect(mapNames).toContain(`FromMap-${suffix}`);
        });
    });
});
