const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

describe('Signal API (WiFi heatmap)', () => {
    let token;

    beforeAll(async () => {
        ({ token } = await createAuthenticatedUser({ role: 'admin', prefix: 'sig' }));
    });

    test('POST /api/signal/readings records a reading', async () => {
        const res = await request(app)
            .post('/api/signal/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({ lat: 15.3547, lng: 44.2066, signal_dbm: -55, ssid: 'Net-Home' });
        expect(res.status).toBe(201);
        expect(res.body.data.signal_dbm).toBe(-55);
    });

    test('POST /api/signal/readings rejects out-of-range dbm', async () => {
        const res = await request(app)
            .post('/api/signal/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({ lat: 15.35, lng: 44.20, signal_dbm: -5 });
        expect(res.status).toBe(400);
    });

    test('POST /api/signal/readings rejects missing coordinates', async () => {
        const res = await request(app)
            .post('/api/signal/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({ signal_dbm: -55 });
        expect(res.status).toBe(400);
    });

    test('GET /api/signal/heatmap returns aggregated cells', async () => {
        const res = await request(app)
            .get('/api/signal/heatmap')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.cells)).toBe(true);
        if (res.body.data.cells.length > 0) {
            expect(res.body.data.cells[0]).toHaveProperty('avg_dbm');
            expect(res.body.data.cells[0]).toHaveProperty('readings');
        }
    });

    test('GET /api/signal/heatmap supports bbox filter', async () => {
        const res = await request(app)
            .get('/api/signal/heatmap?min_lat=15.3&max_lat=15.4&min_lng=44.1&max_lng=44.3')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.cells)).toBe(true);
    });

    test('GET /api/signal/coverage returns stats', async () => {
        const res = await request(app)
            .get('/api/signal/coverage')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('total_readings');
        expect(res.body.data).toHaveProperty('avg_dbm');
    });

    test('GET /api/signal/readings returns paginated list', async () => {
        const res = await request(app)
            .get('/api/signal/readings?page=1&limit=5')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.items)).toBe(true);
        expect(res.body.data.pagination.limit).toBe(5);
    });

    test('unauthenticated access returns 401', async () => {
        const res = await request(app).get('/api/signal/heatmap');
        expect(res.status).toBe(401);
    });
});

describe('Networks API (WiFi networks management)', () => {
    let adminToken;
    let techToken;
    let networkId;

    beforeAll(async () => {
        ({ token: adminToken } = await createAuthenticatedUser({ role: 'admin', prefix: 'net' }));
        ({ token: techToken } = await createAuthenticatedUser({ role: 'technician', prefix: 'net' }));
    });

    test('POST /api/networks creates network (admin)', async () => {
        const res = await request(app)
            .post('/api/networks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                ssid: 'HomeNet-5G',
                band: 5,
                channel: 36,
                security_type: 'wpa2',
                location_lat: 15.3547,
                location_lng: 44.2066,
            });
        expect(res.status).toBe(201);
        expect(res.body.data.ssid).toBe('HomeNet-5G');
        networkId = res.body.data.id;
    });

    test('POST /api/networks rejects invalid band', async () => {
        const res = await request(app)
            .post('/api/networks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ssid: 'Bad-Band', band: 9 });
        expect(res.status).toBe(400);
    });

    test('POST /api/networks rejects missing ssid', async () => {
        const res = await request(app)
            .post('/api/networks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ band: 5 });
        expect(res.status).toBe(400);
    });

    test('GET /api/networks lists networks paginated', async () => {
        const res = await request(app)
            .get('/api/networks?page=1&limit=10')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.items)).toBe(true);
        expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 10 });
    });

    test('GET /api/networks supports band filter', async () => {
        const res = await request(app)
            .get('/api/networks?band=5')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        const allBand5 = res.body.data.items.every((n) => Number(n.band) === 5);
        expect(allBand5).toBe(true);
    });

    test('GET /api/networks/:id returns single network', async () => {
        const res = await request(app)
            .get(`/api/networks/${networkId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(networkId);
    });

    test('PUT /api/networks/:id updates network', async () => {
        const res = await request(app)
            .put(`/api/networks/${networkId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'inactive', notes: 'تحديث اختباري' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('inactive');
    });

    test('technician cannot create networks (RBAC)', async () => {
        const res = await request(app)
            .post('/api/networks')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ ssid: 'Tech-Net' });
        expect(res.status).toBe(403);
    });

    test('DELETE /api/networks/:id deletes network (admin)', async () => {
        const res = await request(app)
            .delete(`/api/networks/${networkId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('GET /api/networks/999999 returns 404', async () => {
        const res = await request(app)
            .get('/api/networks/999999')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
    });
});
