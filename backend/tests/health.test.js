const request = require('supertest');
const app = require('../src/app');

describe('Health Check API', () => {
    test('GET /health returns 200 with status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
    });

    test('GET /unknown-path returns 404', async () => {
        const res = await request(app).get('/api/nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});
