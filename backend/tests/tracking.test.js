const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');
const { query } = require('../src/shared/db');

describe('Tracking API', () => {
    describe('Unauthenticated access', () => {
        test('POST /api/tracking/log returns 401', async () => {
            const res = await request(app)
                .post('/api/tracking/log')
                .send({ lat: 24.7, lng: 46.6 });
            expect(res.status).toBe(401);
        });

        test('GET /api/tracking/live returns 401', async () => {
            const res = await request(app).get('/api/tracking/live');
            expect(res.status).toBe(401);
        });

        test('GET /api/tracking/signal returns 401', async () => {
            const res = await request(app).get('/api/tracking/signal');
            expect(res.status).toBe(401);
        });

        test('GET /api/tracking/status returns 401', async () => {
            const res = await request(app).get('/api/tracking/status');
            expect(res.status).toBe(401);
        });
    });

    describe('GPS save flow — الحفظ مشروط بتفعيل التتبع', () => {
        let techToken;
        let techId;
        let adminToken;

        beforeAll(async () => {
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'gps' });
            techToken = tech.token;
            // جلب id الفني من /me أو الاستعلام المباشر
            const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${techToken}`);
            techId = me.body?.data?.id;
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'gps' });
            adminToken = admin.token;
        });

        test('tracking disabled by default → log rejected 403 with clear message', async () => {
            const res = await request(app)
                .post('/api/tracking/log')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ lat: 24.7136, lng: 46.6753, speed: 0 });
            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            // الرسالة يجب أن تميّز السبب بوضوح (غير مفعّل) — لا تُخفى عن المستخدم
            expect(res.body.error).toMatch(/غير مفعّل/);
        });

        test('GET /tracking/status reports can_track=false + reason before broadcast', async () => {
            const res = await request(app)
                .get('/api/tracking/status')
                .set('Authorization', `Bearer ${techToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.can_track).toBe(false);
            expect(res.body.data.tracking_enabled).toBe(false);
            expect(res.body.data.reason).toContain('غير مفعّل');
        });

        test('admin enables tracking → log succeeds and coordinates are saved', async () => {
            const enable = await request(app)
                .post(`/api/users/${techId}/tracking`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ enabled: true });
            expect([200, 201]).toContain(enable.status);
            expect(enable.body.data.tracking_enabled).toBe(true);

            const res = await request(app)
                .post('/api/tracking/log')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ lat: 24.7136, lng: 46.6753, speed: 12.5 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.lat).toBeCloseTo(24.7136);
            expect(res.body.data.lng).toBeCloseTo(46.6753);

            // التحقق الفعلي من الحفظ في قاعدة البيانات
            const db = await query('SELECT lat, lng FROM tracking_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [techId]);
            expect(db.rows[0].lat).toBeCloseTo(24.7136);
        });

        test('status now reports can_track=true and last_log_at set', async () => {
            const res = await request(app)
                .get('/api/tracking/status')
                .set('Authorization', `Bearer ${techToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.can_track).toBe(true);
            expect(res.body.data.last_log_at).not.toBeNull();
        });

        test('admin sets tracking_veto → log rejected 403 with veto message', async () => {
            const veto = await request(app)
                .post(`/api/users/${techId}/tracking`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ tracking_veto: true });
            expect([200, 201]).toContain(veto.status);
            expect(veto.body.data.tracking_veto).toBe(true);

            const res = await request(app)
                .post('/api/tracking/log')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ lat: 24.7136, lng: 46.6753 });
            expect(res.status).toBe(403);
            // تمييز واضح عن (غير مفعّل): حق الاعتراض
            expect(res.body.error).toMatch(/اعتراض/);

            // الحالة تعكس السبب
            const status = await request(app)
                .get('/api/tracking/status')
                .set('Authorization', `Bearer ${techToken}`);
            expect(status.body.data.can_track).toBe(false);
            expect(status.body.data.tracking_veto).toBe(true);
        });

        test('log returns 400 for out-of-range coordinates', async () => {
            const res = await request(app)
                .post('/api/tracking/log')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ lat: 999, lng: 46.6 });
            expect(res.status).toBe(400);
        });

        test('technician cannot read live locations (admin/support only)', async () => {
            const res = await request(app)
                .get('/api/tracking/live')
                .set('Authorization', `Bearer ${techToken}`);
            expect(res.status).toBe(403);
        });

        test('admin sees technician in live list after successful save', async () => {
            const res = await request(app)
                .get('/api/tracking/live')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            const found = res.body.data.find((t) => t.user_id === techId);
            expect(found).toBeDefined();
            expect(found.lat).toBeCloseTo(24.7136);
        });
    });
});
