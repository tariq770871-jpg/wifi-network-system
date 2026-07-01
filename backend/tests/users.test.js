const request = require('supertest');
const app = require('../src/app');

describe('Users API', () => {
    describe('GET /api/users', () => {
        test('returns 401 without authentication', async () => {
            const res = await request(app).get('/api/users');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/users/:id', () => {
        test('returns 401 without authentication', async () => {
            const res = await request(app).get('/api/users/1');
            expect(res.status).toBe(401);
        });
    });
});
