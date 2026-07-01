const request = require('supertest');
const app = require('../src/app');

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
