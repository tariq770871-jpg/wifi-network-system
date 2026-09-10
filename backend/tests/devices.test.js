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

    describe('Extended device fields (model/serial/MAC/installation/location source)', () => {
        let token;
        let techUserId;

        beforeAll(async () => {
            ({ token } = await createAuthenticatedUser({ role: 'admin', prefix: 'devx' }));
            // فني حقيقي لاختبار اسم المركّب
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'devx' });
            const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tech.token}`);
            techUserId = me.body?.data?.id;
        });

        test('POST creates device with full extended data + GPS location source', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'AP-Campus-North',
                    device_type: 'access_point',
                    model: 'hAP ac²',
                    manufacturer: 'MikroTik',
                    serial_number: 'HEE8-TEST-0001',
                    mac_address: 'AA:BB:CC:DD:EE:FF',
                    ip_address: '10.10.0.5',
                    location_lat: 24.7136,
                    location_lng: 46.6753,
                    coordinate_source: 'gps',
                    gps_accuracy: 8.5,
                    installed_at: '2026-09-01T00:00:00.000Z',
                    installed_by: techUserId,
                    notes: 'تركيب مبنى الشمال',
                });
            expect(res.status).toBe(201);
            const d = res.body.data;
            expect(d.model).toBe('hAP ac²');
            expect(d.manufacturer).toBe('MikroTik');
            expect(d.serial_number).toBe('HEE8-TEST-0001');
            expect(d.mac_address).toBe('AA:BB:CC:DD:EE:FF');
            expect(d.coordinate_source).toBe('gps');
            expect(d.gps_accuracy).toBeCloseTo(8.5);
            expect(d.installed_by).toBe(techUserId);

            // GET /:id يُرجع اسم الفني المركّب
            const one = await request(app)
                .get(`/api/devices/${d.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(one.status).toBe(200);
            expect(one.body.data.installed_by_name).toContain('Test technician');
        });

        test('POST returns 400 for invalid MAC address', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Bad-MAC', mac_address: 'ZZ:BB:CC:DD:EE:FF' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/MAC/);
        });

        test('POST returns 400 for invalid coordinate_source', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Bad-Source', coordinate_source: 'telepathy' });
            expect(res.status).toBe(400);
        });

        test('POST returns 400 for invalid installed_at date', async () => {
            const res = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Bad-Date', installed_at: 'not-a-date' });
            expect(res.status).toBe(400);
        });

        test('coordinate_source defaults to manual without GPS accuracy, gps with it', async () => {
            const manual = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Src-Manual', location_lat: 24.7, location_lng: 46.6 });
            expect(manual.body.data.coordinate_source).toBe('manual');

            const gps = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Src-GPS', location_lat: 24.7, location_lng: 46.6, gps_accuracy: 15 });
            expect(gps.body.data.coordinate_source).toBe('gps');
        });

        test('search finds device by serial number', async () => {
            const res = await request(app)
                .get('/api/devices?search=HEE8-TEST-0001')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data.items.some((d) => d.serial_number === 'HEE8-TEST-0001')).toBe(true);
        });

        test('search finds device by MAC', async () => {
            const res = await request(app)
                .get('/api/devices?search=AA:BB:CC:DD:EE:FF')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items.some((d) => d.name === 'AP-Campus-North')).toBe(true);
        });

        test('coordinate_source filter returns only matching devices', async () => {
            const res = await request(app)
                .get('/api/devices?coordinate_source=gps')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data.items.every((d) => d.coordinate_source === 'gps')).toBe(true);
        });

        test('PUT updates extended fields (model + installed_at)', async () => {
            const created = await request(app)
                .post('/api/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Ext-Update' });
            const id = created.body?.data?.id;
            const res = await request(app)
                .put(`/api/devices/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ model: 'RB4011', installed_at: '2026-08-15T00:00:00.000Z' });
            expect(res.status).toBe(200);
            expect(res.body.data.model).toBe('RB4011');
            expect(new Date(res.body.data.installed_at).getUTCDate()).toBe(15);
        });

        test('list includes installed_by_name for joined installer', async () => {
            const res = await request(app)
                .get('/api/devices?search=AP-Campus-North')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const item = res.body.data.items[0];
            expect(item.installed_by_name).toContain('Test technician');
        });
    });
});

describe('Regression — نموذج الجهاز يرسل null (علّة Invalid value)', () => {
    let token;

    beforeAll(async () => {
        ({ token } = await createAuthenticatedUser({ role: 'admin', prefix: 'nulls' }));
    });

    test('POST with coordinate_source:null + nulls (no location picked) → 201', async () => {
        const res = await request(app)
            .post('/api/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Null-Location-Device',
                coordinate_source: null,
                gps_accuracy: null,
                location_lat: null,
                location_lng: null,
            });
        expect(res.status).toBe(201);
        expect(res.body.data.coordinate_source).toBe('manual');
    });

    test('PUT clearing location with nulls (إزالة الموقع) → 200 and cleared', async () => {
        const created = await request(app)
            .post('/api/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Clear-Loc', location_lat: 24.7, location_lng: 46.6, coordinate_source: 'gps', gps_accuracy: 10 });
        const id = created.body?.data?.id;
        const res = await request(app)
            .put(`/api/devices/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ location_lat: null, location_lng: null, coordinate_source: null, gps_accuracy: null });
        expect(res.status).toBe(200);
        expect(res.body.data.location_lat).toBeNull();
        expect(res.body.data.coordinate_source).toBeNull();
    });
});
