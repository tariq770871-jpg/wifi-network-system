const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

describe('Networks API', () => {
    describe('Unauthenticated access', () => {
        test('GET /api/networks returns 401 without token', async () => {
            const res = await request(app).get('/api/networks');
            expect(res.status).toBe(401);
        });

        test('POST /api/networks returns 401 without token', async () => {
            const res = await request(app).post('/api/networks').send({ ssid: 'Net' });
            expect(res.status).toBe(401);
        });
    });

    describe('Authenticated as admin', () => {
        let token;

        beforeAll(async () => {
            ({ token } = await createAuthenticatedUser({ role: 'admin', prefix: 'netadm' }));
        });

        let createdId;

        test('POST creates a 5GHz WPA2 network', async () => {
            const res = await request(app)
                .post('/api/networks')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    ssid: 'Office-5G',
                    band: 5,
                    channel: 36,
                    frequency_mhz: 5180,
                    security_type: 'wpa2',
                    location_lat: 15.35,
                    location_lng: 44.2,
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.ssid).toBe('Office-5G');
            expect(res.body.data.band).toBe(5);
            expect(res.body.data.security_type).toBe('wpa2');
            createdId = res.body.data.id;
        });

        test('POST returns 400 when ssid missing', async () => {
            const res = await request(app)
                .post('/api/networks')
                .set('Authorization', `Bearer ${token}`)
                .send({ band: 2.4 });
            expect(res.status).toBe(400);
        });

        test('GET lists networks with pagination shape', async () => {
            const res = await request(app).get('/api/networks').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data.items)).toBe(true);
            expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
        });

        test('GET ?band=5 filters by band', async () => {
            const res = await request(app)
                .get('/api/networks')
                .query({ band: 5 })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items.every((n) => Number(n.band) === 5)).toBe(true);
        });

        test('GET /:id returns the created network', async () => {
            const res = await request(app).get(`/api/networks/${createdId}`).set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(createdId);
        });

        test('PUT updates status and security', async () => {
            const res = await request(app)
                .put(`/api/networks/${createdId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'planned', security_type: 'wpa3' });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('planned');
            expect(res.body.data.security_type).toBe('wpa3');
        });

        test('PUT with no valid fields returns 400 or no-change safely', async () => {
            const res = await request(app)
                .put(`/api/networks/${createdId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect([200, 400, 404]).toContain(res.status);
        });

        test('DELETE removes the network (admin)', async () => {
            const res = await request(app).delete(`/api/networks/${createdId}`).set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const get = await request(app).get(`/api/networks/${createdId}`).set('Authorization', `Bearer ${token}`);
            expect([404, 500]).toContain(get.status === 404 ? 404 : get.status);
        });
    });

    describe('Permissions', () => {
        test('technician can read but cannot create/update/delete', async () => {
            const { token } = await createAuthenticatedUser({ role: 'technician', prefix: 'nettech' });

            const read = await request(app).get('/api/networks').set('Authorization', `Bearer ${token}`);
            expect(read.status).toBe(200);

            const create = await request(app)
                .post('/api/networks')
                .set('Authorization', `Bearer ${token}`)
                .send({ ssid: 'Rogue' });
            expect(create.status).toBe(403);

            const update = await request(app)
                .put('/api/networks/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'inactive' });
            expect(update.status).toBe(403);

            const del = await request(app).delete('/api/networks/1').set('Authorization', `Bearer ${token}`);
            expect(del.status).toBe(403);
        });

        test('support can create but cannot delete', async () => {
            const { token } = await createAuthenticatedUser({ role: 'support', prefix: 'netsup' });

            const create = await request(app)
                .post('/api/networks')
                .set('Authorization', `Bearer ${token}`)
                .send({ ssid: 'Support-Net' });
            expect(create.status).toBe(201);

            const del = await request(app).delete(`/api/networks/${create.body.data.id}`).set('Authorization', `Bearer ${token}`);
            expect(del.status).toBe(403);
        });
    });
});
