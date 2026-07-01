const request = require('supertest');
const app = require('../src/app');

describe('Map Points API', () => {
    describe('Unauthenticated access', () => {
        test('GET /api/map-points returns 401', async () => {
            const res = await request(app).get('/api/map-points');
            expect(res.status).toBe(401);
        });

        test('POST /api/map-points returns 401', async () => {
            const res = await request(app)
                .post('/api/map-points')
                .send({ name: 'test', location_lat: 24.7, location_lng: 46.6 });
            expect(res.status).toBe(401);
        });
    });
});
