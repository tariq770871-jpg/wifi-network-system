const request = require('supertest');
const app = require('../src/app');

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
    });
});
