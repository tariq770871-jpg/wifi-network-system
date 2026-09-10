const request = require('supertest');
const { app } = require('../src/app');

describe('Auth API', () => {
    describe('POST /api/auth/register', () => {
        test('returns 400 if username is missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ password: '123456', full_name: 'test' });
            expect(res.status).toBe(400);
        });

        test('returns 400 if password is too short', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: '12', full_name: 'test' });
            expect(res.status).toBe(400);
        });

        test('returns 400 if full_name is missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: '123456' });
            expect(res.status).toBe(400);
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
            // إنشاء مستخدم حقيقي ثم دخول للتحقق من كوكي الجلسة الآمن
            await request(app)
                .post('/api/auth/register')
                .send({ username: 'cookie_user', password: 'password123', full_name: 'Cookie Test' });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'cookie_user', password: 'password123', remember: false });
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
            expect(meRes.body.data.username).toBe('cookie_user');
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
