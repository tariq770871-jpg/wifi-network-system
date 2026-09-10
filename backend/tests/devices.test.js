const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

describe('Devices API (MikroTik integration)', () => {
    describe('Unauthenticated access', () => {
        test('GET /api/devices returns 401 without token', async () => {
            const res = await request(app).get('/api/devices');
            expect(res.status).toBe(401);
        });

        test('POST /api/devices returns 401 without token', async () => {
            const res = await request(app)
                .post('/api/devices')
                .send({ name: 'Router-1' });
            expect(res.status).toBe(401);
        });

        test('POST /api/devices/1/test returns 401 without token', async () => {
            const res = await request(app).post('/api/devices/1/test');
            expect(res.status).toBe(401);
        });

        test('GET /api/devices/1/status returns 401 without token', async () => {
            const res = await request(app).get('/api/devices/1/status');
            expect(res.status).toBe(401);
        });
    });

    describe('Authenticated as admin', () => {
        let token;

        beforeAll(async () => {
            ({ token } = await createAuthenticatedUser({ role: 'admin', prefix: 'dev' }));
        });

        test('POST /api/devices creates a MikroTik-linked device', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Router-Main-01',
                    device_type: 'router',
                    ip_address: '192.168.88.1',
                    is_mikrotik_linked: true,
                    mikrotik_username: 'monitor',
                    mikrotik_api_port: 8728,
                    mikrotik_password: 'routerpass',
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Router-Main-01');
            expect(res.body.data.is_mikrotik_linked).toBe(true);
            // كلمة المرور يجب ألا تُعاد أبداً
            expect(res.body.data.mikrotik_password_encrypted).toBeUndefined();
        });

        test('POST /api/devices returns 400 when name missing', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ device_type: 'router' });
            expect(res.status).toBe(400);
        });

        test('POST /api/devices returns 400 for invalid IP', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'BadIP', ip_address: 'not-an-ip' });
            expect(res.status).toBe(400);
        });

        test('POST /api/devices returns 400 when MikroTik linked without IP', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'NoIP', is_mikrotik_linked: true });
            expect(res.status).toBe(400);
        });

        test('GET /api/devices lists devices paginated without passwords', async () => {
            const res = await request(app)
                .get('/api/devices?page=1&limit=10')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.items)).toBe(true);
            expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 10 });
            const hasSecret = res.body.data.items.some((d) => 'mikrotik_password_encrypted' in d);
            expect(hasSecret).toBe(false);
        });

        test('GET /api/devices supports status filter', async () => {
            const res = await request(app)
                .get('/api/devices?status=offline')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const allOffline = res.body.data.items.every((d) => d.status === 'offline');
            expect(allOffline).toBe(true);
        });

        test('GET /api/devices returns 400 for invalid query params', async () => {
            const res = await request(app)
                .get('/api/devices?status=bananas')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
        });

        test('GET /api/devices/999999 returns 404', async () => {
            const res = await request(app)
                .get('/api/devices/999999')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });

        test('POST /api/devices/:id/test reports connection failure gracefully', async () => {
            // إنشاء جهاز مرتبط بعنوان غير قابل للوصول
            const created = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Router-Unreachable',
                    ip_address: '10.255.255.1',
                    is_mikrotik_linked: true,
                    mikrotik_password: 'x',
                });
            const id = created.body?.data?.id;
            const res = await request(app)
                .post(`/api/devices/${id}/test`)
                .set('Authorization', `Bearer ${token}`);
            expect([200, 502, 504]).toContain(res.status);
            // الفشل يُعاد كاستجابة منظمة وليس انهيار
            expect(res.body).toHaveProperty('success');
        }, 30000);

        test('PUT /api/devices/:id updates device', async () => {
            const created = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Old-Name', device_type: 'switch' });
            const id = created.body?.data?.id;
            const res = await request(app)
                .put(`/api/devices/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New-Name', status: 'maintenance' });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('New-Name');
            expect(res.body.data.status).toBe('maintenance');
        });

        test('DELETE /api/devices/:id deletes device', async () => {
            const created = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'To-Delete' });
            const id = created.body?.data?.id;
            const res = await request(app)
                .delete(`/api/devices/${id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });

        test('technician cannot create or delete devices (RBAC)', async () => {
            const { token: techToken } = await createAuthenticatedUser({ role: 'technician', prefix: 'dev' });
            const createRes = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ name: 'Should-Fail' });
            expect(createRes.status).toBe(403);

            const deleteRes = await request(app)
                .delete('/api/devices/1')
                .set('Authorization', `Bearer ${techToken}`);
            expect(deleteRes.status).toBe(403);
        });
    });
});
