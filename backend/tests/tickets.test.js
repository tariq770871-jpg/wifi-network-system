const request = require('supertest');
const app = require('../src/app');

describe('Tickets API', () => {
    describe('Unauthenticated access', () => {
        test('GET /api/tickets returns 401 without token', async () => {
            const res = await request(app).get('/api/tickets');
            expect(res.status).toBe(401);
        });

        test('GET /api/tickets/1 returns 401 without token', async () => {
            const res = await request(app).get('/api/tickets/1');
            expect(res.status).toBe(401);
        });

        test('POST /api/tickets returns 401 without token', async () => {
            const res = await request(app)
                .post('/api/tickets')
                .send({ title: 'test', customer_name: 'test' });
            expect(res.status).toBe(401);
        });

        test('DELETE /api/tickets/1 returns 401 without token', async () => {
            const res = await request(app).delete('/api/tickets/1');
            expect(res.status).toBe(401);
        });
    });
});
