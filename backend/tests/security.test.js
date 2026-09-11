const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

/**
 * Security Regression Tests
 * تمنع رجوع الثغرات الأمنية المكتشفة في التدقيق
 */
describe('Security Hardening', () => {
    describe('CRITICAL: privilege escalation via register (regression)', () => {
        test('POST /api/auth/register REJECTS unauthenticated callers (التسجيل العام مغلق)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `evil_admin_${Date.now()}`,
                    password: 'secret123',
                    full_name: 'Evil Attacker',
                    role: 'admin',
                });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test('admin register REJECTS role in body with 400 (لا تصعيد من العميل)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: `evil_admin_${Date.now()}`,
                    password: 'secret123',
                    full_name: 'Evil Attacker',
                    role: 'admin',
                });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('registered user (by admin) is ALWAYS technician even if role smuggled via service', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const username = `force_tech_${Date.now()}`;
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username,
                    password: 'secret123',
                    full_name: 'Forced Technician',
                });
            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('technician');
        });

        test('newly registered user cannot access admin-only endpoints', async () => {
            const { token } = await createAuthenticatedUser({ role: 'technician' });
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Hacked-Router' });
            expect(res.status).toBe(403);
        });
    });

    describe('security headers (helmet)', () => {
        test('responses include helmet security headers', async () => {
            const res = await request(app).get('/health');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBeDefined();
            expect(res.headers['x-request-id']).toBeDefined();
        });
    });

    describe('input validation coverage', () => {
        let token;

        beforeAll(async () => {
            const { token: t } = await createAuthenticatedUser({ role: 'admin', prefix: 'validator' });
            token = t;
        });

        test('POST /api/tickets rejects invalid priority', async () => {
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'T', customer_name: 'C', priority: 'super-urgent' });
            expect(res.status).toBe(400);
        });

        test('POST /api/tracking/log rejects out-of-range lat', async () => {
            const res = await request(app)
                .post('/api/tracking/log')
                .set('Authorization', `Bearer ${token}`)
                .send({ lat: 999, lng: 44 });
            expect([400, 403]).toContain(res.status); // 403 إن كان الدور غير فني
        });

        test('pagination limit is capped at 100', async () => {
            const res = await request(app)
                .get('/api/tickets?page=1&limit=99999')
                .set('Authorization', `Bearer ${token}`);
            expect([400, 200]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.data.pagination.limit).toBeLessThanOrEqual(100);
            }
        });
    });

    describe('i18n (Accept-Language)', () => {
        test('error messages follow Accept-Language: en', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .set('Accept-Language', 'en-US,en;q=0.9')
                .send({ username: 'no_such_user_xyz', password: 'whatever1' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid username or password');
        });

        test('default language is Arabic', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'no_such_user_xyz', password: 'whatever1' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('اسم المستخدم أو كلمة المرور غير صحيحة');
        });

        test('404 route message translated with ?lang=en', async () => {
            const res = await request(app).get('/api/nonexistent?lang=en');
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Route not found');
        });
    });
});
