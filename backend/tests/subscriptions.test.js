const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

describe('Subscriptions API', () => {
    describe('Unauthenticated access', () => {
        test('GET /api/subscriptions returns 401 without token', async () => {
            const res = await request(app).get('/api/subscriptions');
            expect(res.status).toBe(401);
        });

        test('POST /api/subscriptions returns 401 without token', async () => {
            const res = await request(app)
                .post('/api/subscriptions')
                .send({ customer_name: 'عميل' });
            expect(res.status).toBe(401);
        });
    });

    describe('Authenticated as admin', () => {
        let token;

        beforeAll(async () => {
            ({ token } = await createAuthenticatedUser({ role: 'admin', prefix: 'subadm' }));
        });

        let createdId;
        const today = new Date().toISOString().slice(0, 10);

        test('POST creates an active subscription with defaults (year end date)', async () => {
            const res = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ customer_name: 'عميل تجريبي أ', monthly_price: 25.5, plan: 'standard' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('active');
            expect(res.body.data.plan).toBe('standard');
            expect(parseFloat(res.body.data.monthly_price)).toBe(25.5);
            // سنة افتراضية من اليوم
            expect(res.body.data.end_date.slice(0, 4)).toBe(String(new Date().getFullYear() + 1));
            createdId = res.body.data.id;
        });

        test('POST creates an expired subscription when end_date is past', async () => {
            const res = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    customer_name: 'عميل منتهي',
                    start_date: '2024-01-01',
                    end_date: '2024-02-01',
                });
            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('expired');
        });

        test('POST returns 400 when end_date before start_date', async () => {
            const res = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ customer_name: 'خطأ', start_date: today, end_date: '2020-01-01' });
            expect(res.status).toBe(400);
        });

        test('POST returns 400 for unknown plan', async () => {
            const res = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ customer_name: 'خطأ خطة', plan: 'diamond' });
            expect(res.status).toBe(400);
        });

        test('GET lists subscriptions with pagination shape', async () => {
            const res = await request(app)
                .get('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data.items)).toBe(true);
            expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
        });

        test('GET ?search= finds by customer name (Arabic)', async () => {
            const res = await request(app)
                .get('/api/subscriptions')
                // supertest يرمّز الاستعلام تلقائياً — الترميز اليدوي يعطي ترميزاً مزدوجاً
                .query({ search: 'تجريبي أ' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items.some((s) => s.customer_name === 'عميل تجريبي أ')).toBe(true);
        });

        test('GET ?status=expired filters correctly', async () => {
            const res = await request(app)
                .get('/api/subscriptions')
                .query({ status: 'expired' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.items.every((s) => s.status === 'expired')).toBe(true);
            expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
        });

        test('PUT updates price and plan', async () => {
            const res = await request(app)
                .put(`/api/subscriptions/${createdId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ monthly_price: 40, plan: 'premium' });
            expect(res.status).toBe(200);
            expect(res.body.data.plan).toBe('premium');
            expect(parseFloat(res.body.data.monthly_price)).toBe(40);
        });

        test('POST /:id/renew extends from current end_date and reactivates', async () => {
            // اجعل الاشتراك منتهياً أولاً
            const past = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
            await request(app)
                .put(`/api/subscriptions/${createdId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ end_date: past, status: 'expired' });

            const res = await request(app)
                .post(`/api/subscriptions/${createdId}/renew`)
                .set('Authorization', `Bearer ${token}`)
                .send({ months: 3 });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('active');
            // GREATEST(today, end_date) + 3 months = اليوم + 3 أشهر (لأن end_date ماضية)
            const expected = new Date();
            expected.setMonth(expected.getMonth() + 3);
            const endDate = res.body.data.end_date.slice(0, 10);
            const exp = expected.toISOString().slice(0, 10);
            // نفس اليوم تقريباً (فرق timezone أقصى يوم واحد)
            const diff = Math.abs(new Date(endDate) - new Date(exp)) / 86400000;
            expect(diff).toBeLessThanOrEqual(1);
        });

        test('POST /:id/renew rejects months > 24', async () => {
            const res = await request(app)
                .post(`/api/subscriptions/${createdId}/renew`)
                .set('Authorization', `Bearer ${token}`)
                .send({ months: 60 });
            expect(res.status).toBe(400);
        });

        test('GET dashboard includes subscriptions stats block', async () => {
            const res = await request(app)
                .get('/api/reports/dashboard')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.subscriptions).toBeDefined();
            expect(res.body.data.subscriptions.active).toBeGreaterThanOrEqual(1);
            expect(typeof res.body.data.subscriptions.monthly_revenue).toBe('number');
        });

        test('DELETE removes subscription (admin)', async () => {
            const res = await request(app)
                .delete(`/api/subscriptions/${createdId}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            // تأكيد الاختفاء
            const get = await request(app)
                .get(`/api/subscriptions/${createdId}`)
                .set('Authorization', `Bearer ${token}`);
            expect(get.status).toBe(404);
        });
    });

    describe('Permissions', () => {
        test('technician can read but cannot create', async () => {
            const { token } = await createAuthenticatedUser({ role: 'technician', prefix: 'subtech' });
            const read = await request(app).get('/api/subscriptions').set('Authorization', `Bearer ${token}`);
            expect(read.status).toBe(200);

            const write = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ customer_name: 'مرفوض' });
            expect(write.status).toBe(403);
        });

        test('technician cannot renew or delete', async () => {
            const { token } = await createAuthenticatedUser({ role: 'technician', prefix: 'subtech2' });
            const renew = await request(app)
                .post('/api/subscriptions/1/renew')
                .set('Authorization', `Bearer ${token}`)
                .send({ months: 1 });
            expect(renew.status).toBe(403);

            const del = await request(app).delete('/api/subscriptions/1').set('Authorization', `Bearer ${token}`);
            expect(del.status).toBe(403);
        });

        test('support can create and renew but cannot delete', async () => {
            const { token } = await createAuthenticatedUser({ role: 'support', prefix: 'subsup' });

            const create = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ customer_name: 'عميل دعم' });
            expect(create.status).toBe(201);
            const id = create.body.data.id;

            const renew = await request(app)
                .post(`/api/subscriptions/${id}/renew`)
                .set('Authorization', `Bearer ${token}`)
                .send({ months: 1 });
            expect(renew.status).toBe(200);

            const del = await request(app).delete(`/api/subscriptions/${id}`).set('Authorization', `Bearer ${token}`);
            expect(del.status).toBe(403);
        });
    });

    describe('Tickets update security regression', () => {
        test('PUT /api/tickets/:id returns 403 for technician (was open before)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'technician', prefix: 'ticksec' });
            const res = await request(app)
                .put('/api/tickets/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'اختراق', priority: 'urgent' });
            expect(res.status).toBe(403);
        });
    });

    describe('Users getById security regression', () => {
        test('technician cannot read another user details', async () => {
            const { token, id } = await createAuthenticatedUser({ role: 'technician', prefix: 'usec1' });
            const other = await createAuthenticatedUser({ role: 'support', prefix: 'usec2' });

            // نفسه → مسموح
            const self = await request(app).get(`/api/users/${id}`).set('Authorization', `Bearer ${token}`);
            expect(self.status).toBe(200);

            // غيره → ممنوع
            const otherRes = await request(app)
                .get(`/api/users/${other.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(otherRes.status).toBe(403);
        });
    });
});
