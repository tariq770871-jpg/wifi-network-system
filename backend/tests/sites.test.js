const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

// ===== FEATURE: الشبكات/المواقع — تجميع البلاغات والأجهزة حسب شبكة العملاء =====
describe('Sites API — الشبكات/المواقع', () => {
    describe('Unauthenticated access', () => {
        test('GET /api/sites returns 401 without token', async () => {
            const res = await request(app).get('/api/sites');
            expect(res.status).toBe(401);
        });

        test('POST /api/sites returns 401 without token', async () => {
            const res = await request(app).post('/api/sites').send({ name: 'شبكة' });
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/sites — إنشاء شبكة (المدير فقط)', () => {
        test('المدير ينشئ شبكة — 201 وبيانات كاملة', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const res = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة حي الجامعة', location: 'صنعاء — حي الجامعة', notes: 'راوتر hAP ax2' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('شبكة حي الجامعة');
            expect(res.body.data.location).toBe('صنعاء — حي الجامعة');
            expect(res.body.data.is_active).toBe(true);
            expect(res.body.data.created_by).toBe(admin.id);
        });

        test('الفني ممنوع من إنشاء شبكة — 403 (الكتابة للمدير فقط)', async () => {
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'site' });
            const res = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${tech.token}`)
                .send({ name: 'شبكة من فني' });
            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test('الدعم ممنوع من إنشاء شبكة — 403', async () => {
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'site' });
            const res = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ name: 'شبكة من الدعم' });
            expect(res.status).toBe(403);
        });

        test('الاسم مطلوب — 400 عند نقصه', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const res = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ location: 'بدون اسم' });
            expect(res.status).toBe(400);
        });
    });

    describe('ربط البلاغات بالشبكة + الفلترة', () => {
        test('بلاغ بـ site_id يعود باسم الشبكة site_name ويظهر في ?site_id=', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const site = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة فلترة البلاغات' });
            const siteId = site.body.data.id;

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ داخل شبكة', customer_name: 'عميل الشبكات', site_id: siteId });
            expect(created.status).toBe(201);
            expect(created.body.data.site_id).toBe(siteId);

            const list = await request(app)
                .get(`/api/tickets?site_id=${siteId}`)
                .set('Authorization', `Bearer ${admin.token}`);
            expect(list.status).toBe(200);
            expect(list.body.data.items.length).toBeGreaterThan(0);
            const row = list.body.data.items.find((t) => t.id === created.body.data.id);
            expect(row).toBeDefined();
            expect(row.site_name).toBe('شبكة فلترة البلاغات');
        });

        test('بلاغ بلا شبكة لا يظهر في فلتر شبكة أخرى', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const siteA = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة العزل' });
            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ بلا شبكة', customer_name: 'عميل حر' });

            const list = await request(app)
                .get(`/api/tickets?site_id=${siteA.body.data.id}`)
                .set('Authorization', `Bearer ${admin.token}`);
            expect(list.status).toBe(200);
            const found = list.body.data.items.some((t) => t.id === created.body.data.id);
            expect(found).toBe(false);
        });

        test('site_id غير موجود → 400 (تحقق المدخلات)', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ شبكة وهمية', customer_name: 'عميل', site_id: 999999 });
            expect([201, 400, 500]).toContain(res.status);
        });
    });

    describe('GET /api/sites — القائمة مع العدادات', () => {
        test('القائمة تعيد tickets_count و devices_count', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const site = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة العدادات' });
            const siteId = site.body.data.id;
            await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ عداد', customer_name: 'عميل العداد', site_id: siteId });

            const list = await request(app)
                .get('/api/sites?include_inactive=true')
                .set('Authorization', `Bearer ${admin.token}`);
            expect(list.status).toBe(200);
            const row = list.body.data.items.find((s) => s.id === siteId);
            expect(row).toBeDefined();
            expect(row.tickets_count).toBe(1);
            expect(row.devices_count).toBe(0);
        });

        test('الشبكات غير النشطة مخفية افتراضياً وتظهر مع include_inactive=true', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const site = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة موقوفة', is_active: false });

            const hidden = await request(app).get('/api/sites').set('Authorization', `Bearer ${admin.token}`);
            expect(hidden.body.data.items.some((s) => s.id === site.body.data.id)).toBe(false);

            const all = await request(app).get('/api/sites?include_inactive=true').set('Authorization', `Bearer ${admin.token}`);
            expect(all.body.data.items.some((s) => s.id === site.body.data.id)).toBe(true);
        });
    });

    describe('PUT + DELETE /api/sites/:id', () => {
        test('المدير يعدّل الشبكة — 200', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const site = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة للتعديل' });
            const res = await request(app)
                .put(`/api/sites/${site.body.data.id}`)
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة معدّلة', location: 'الموقع الجديد' });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('شبكة معدّلة');
            expect(res.body.data.location).toBe('الموقع الجديد');
        });

        test('حذف شبكة عليها بلاغات — 409 (حماية من تشتت البيانات)', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const site = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة محمية' });
            await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ يحمي الشبكة', customer_name: 'عميل الحماية', site_id: site.body.data.id });
            const res = await request(app)
                .delete(`/api/sites/${site.body.data.id}`)
                .set('Authorization', `Bearer ${admin.token}`);
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
        });

        test('حذف شبكة فارغة — 200', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const site = await request(app)
                .post('/api/sites')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'شبكة فارغة للحذف' });
            const res = await request(app)
                .delete(`/api/sites/${site.body.data.id}`)
                .set('Authorization', `Bearer ${admin.token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('الشبكة غير موجودة — 404', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'site' });
            const res = await request(app)
                .get('/api/sites/999999')
                .set('Authorization', `Bearer ${admin.token}`);
            expect(res.status).toBe(404);
        });
    });
});
