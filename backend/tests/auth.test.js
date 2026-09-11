const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

describe('Auth API', () => {
    describe('POST /api/auth/register — للمدير فقط (التسجيل العام مغلق)', () => {
        test('returns 401 without authentication (كان التسجيل عاماً — ثغرة أُغلقت)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: '123456', full_name: 'test' });
            expect(res.status).toBe(401);
        });

        test('returns 403 for non-admin authenticated user', async () => {
            const { token } = await createAuthenticatedUser({ role: 'technician' });
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: 'testuser', password: '123456', full_name: 'test' });
            expect(res.status).toBe(403);
        });

        test('returns 400 for admin with missing username', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: '123456', full_name: 'test' });
            expect(res.status).toBe(400);
        });

        test('returns 400 for admin with short password', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: 'testuser', password: '12', full_name: 'test' });
            expect(res.status).toBe(400);
        });

        test('returns 201 for admin with valid payload (يُفرض technician)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const username = `reg_tech_${Date.now()}`;
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${token}`)
                .send({ username, password: '123456', full_name: 'test' });
            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('technician');
        });
    });

    describe('POST /api/auth/login', () => {
        test('returns 400 if username is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: '123456' });
            expect(res.status).toBe(400);
        });

        test('returns 400 if password is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin' });
            expect(res.status).toBe(400);
        });

        test('returns 401 for invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nonexistent', password: 'wrong' });
            expect(res.status).toBe(401);
        });

        test('sets HttpOnly session cookie on login', async () => {
            // إنشاء مستخدم حقيقي (بإدراج DB — التسجيل API للمدير فقط) ثم دخول للتحقق من كوكي الجلسة الآمن
            const created = await createAuthenticatedUser({ role: 'technician', prefix: 'cookie_user' });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: created.username, password: 'secret123', remember: false });
            expect(res.status).toBe(200);

            const cookie = res.headers['set-cookie']?.find(c => c.startsWith('token='));
            expect(cookie).toBeDefined();
            expect(cookie).toMatch(/HttpOnly/i);
            expect(cookie).toMatch(/SameSite=Lax/i); // NODE_ENV=test → Lax
            expect(cookie).not.toMatch(/Max-Age/i); // بلا remember = كوكي جلسة

            // الكوكي وحده يكفي للمصادقة (بدون ترويسة Authorization)
            const meRes = await request(app)
                .get('/api/auth/me')
                .set('Cookie', cookie.split(';')[0]);
            expect(meRes.status).toBe(200);
            expect(meRes.body.data.username).toBe(created.username);
        });

        test('logout clears the auth cookie', async () => {
            const res = await request(app).post('/api/auth/logout');
            expect(res.status).toBe(200);
            const cookie = res.headers['set-cookie']?.find(c => c.startsWith('token='));
            expect(cookie).toMatch(/token=;/);
        });
    });

    describe('GET /api/auth/me', () => {
        test('returns 401 without token', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.status).toBe(401);
        });

        test('returns 401 with invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token-here');
            expect(res.status).toBe(401);
        });
    });
});
