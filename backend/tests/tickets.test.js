const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');

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

    // ===== الميزة: المدير والدعم الفني يضيفان بلاغاً ليراه الفنيون وينطلقون للإصلاح =====
    describe('POST /api/tickets — إنشاء بلاغ (المدير والدعم فقط)', () => {
        test('المدير ينشئ بلاغاً جديداً — 201 والحالة "قيد الانتظار"', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({
                    title: 'انقطاع إنترنت — حي الجامعة',
                    customer_name: 'أحمد محمد',
                    customer_phone: '0599000111',
                    customer_address: 'حي الجامعة — شارع 5',
                    description: 'العميل يشكو من انقطاع متكرر منذ الصباح',
                    priority: 'high',
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('انقطاع إنترنت — حي الجامعة');
            expect(res.body.data.status).toBe('pending');
            expect(res.body.data.created_by).toBe(admin.id);
        });

        test('الدعم الفني ينشئ بلاغاً جديداً — 201', async () => {
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'tick' });
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ title: 'إشارة ضعيفة — العميل سعيد ك.', customer_name: 'سعيد كريم' });
            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('pending');
            expect(res.body.data.created_by).toBe(support.id);
        });

        test('الفني ممنوع من إنشاء بلاغ — 403 (الإضافة للمدير والدعم فقط)', async () => {
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${tech.token}`)
                .send({ title: 'بلاغ من فني', customer_name: 'عميل' });
            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test('الحقول المطلوبة (العنوان واسم العميل) — 400 عند نقصها', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ description: 'بدون عنوان وبدون اسم عميل' });
            expect(res.status).toBe(400);
        });

        test('إنشاء بلاغ مع تعيين فني مباشرة → الحالة "معيّن" لا "قيد الانتظار"', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });
            const res = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({
                    title: 'بلاغ مع تعيين مباشر',
                    customer_name: 'عميل التعيين المباشر',
                    assigned_to: tech.id,
                });
            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('assigned');
            expect(res.body.data.assigned_to).toBe(tech.id);
        });
    });

    describe('GET /api/tickets — اسم الفني والمنشئ يظهران (JOIN)', () => {
        test('القائمة تعيد technician_name بعد التعيين — ما كانت تعرضه الواجهة فارغاً', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ فحص الأسماء', customer_name: 'عميل الأسماء' });
            const ticketId = created.body.data.id;

            await request(app)
                .post(`/api/tickets/${ticketId}/assign`)
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ assigned_to: tech.id });

            const list = await request(app)
                .get('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`);
            expect(list.status).toBe(200);
            const row = list.body.data.items.find((t) => t.id === ticketId);
            expect(row).toBeDefined();
            expect(row.technician_name).toBe('Test technician');
            expect(row.creator_name).toBe('Test admin');
        });

        test('بلاغ بلا تعيين → technician_name = null دون انهيار', async () => {
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'tick' });
            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ title: 'بلاغ بلا تعيين', customer_name: 'عميل بلا فني' });

            const one = await request(app)
                .get(`/api/tickets/${created.body.data.id}`)
                .set('Authorization', `Bearer ${support.token}`);
            expect(one.status).toBe(200);
            expect(one.body.data.technician_name).toBeNull();
        });

        test('فلترة status تعمل مع الـ JOIN الجديد — نتائج بالحالة المطلوبة فقط', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ فلترة — قيد الانتظار', customer_name: 'عميل الفلترة' });

            const list = await request(app)
                .get('/api/tickets?status=pending')
                .set('Authorization', `Bearer ${admin.token}`);
            expect(list.status).toBe(200);
            expect(list.body.data.items.length).toBeGreaterThan(0);
            for (const t of list.body.data.items) {
                expect(t.status).toBe('pending');
            }
        });
    });

    describe('الفني ينطلق للإصلاح — start/complete على بلاغه فقط', () => {
        test('الفني المعيَّن يبدأ العمل ثم يكمل البلاغ', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({
                    title: 'بلاغ تنفيذ الفني',
                    customer_name: 'عميل التنفيذ',
                    assigned_to: tech.id,
                });
            const ticketId = created.body.data.id;

            const started = await request(app)
                .post(`/api/tickets/${ticketId}/start`)
                .set('Authorization', `Bearer ${tech.token}`);
            expect(started.status).toBe(200);
            expect(started.body.data.status).toBe('in_progress');
            expect(started.body.data.started_at).not.toBeNull();

            const completed = await request(app)
                .post(`/api/tickets/${ticketId}/complete`)
                .set('Authorization', `Bearer ${tech.token}`)
                .send({ notes: 'تم استبدال الراوتر وإعادة ضبط الإشارة' });
            expect(completed.status).toBe(200);
            expect(completed.body.data.status).toBe('completed');
            expect(completed.body.data.completed_at).not.toBeNull();
        });

        test('فني آخر لا يبدأ بلاغاً غير معيَّن له — 403 (حارس المعيَّن له فقط)', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const techA = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });
            const techB = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({
                    title: 'بلاغ فني آخر',
                    customer_name: 'عميل الحارس',
                    assigned_to: techA.id,
                });
            const ticketId = created.body.data.id;

            const res = await request(app)
                .post(`/api/tickets/${ticketId}/start`)
                .set('Authorization', `Bearer ${techB.token}`);
            expect(res.status).toBe(403);
        });
    // ===== FEATURE: تبنّي البلاغ — الفني يتبنّى بلاغاً لم يُعيَّن لأحد فيصبح له =====
    describe('POST /api/tickets/:id/claim — تبنّي البلاغ (الفني فقط)', () => {
        test('الفني يتبنّى بلاغاً غير معيَّن — 200 والحالة "معيّن" ومعيَّن له', async () => {
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'tick' });
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ title: 'بلاغ للتبني', customer_name: 'عميل التبني' });
            const ticketId = created.body.data.id;
            expect(created.body.data.status).toBe('pending');

            const claimed = await request(app)
                .post(`/api/tickets/${ticketId}/claim`)
                .set('Authorization', `Bearer ${tech.token}`);
            expect(claimed.status).toBe(200);
            expect(claimed.body.success).toBe(true);
            expect(claimed.body.data.assigned_to).toBe(tech.id);
            expect(claimed.body.data.status).toBe('assigned');
        });

        test('فني ثانٍ لا يتبنّى نفس البلاغ — 409 (سبق فني آخر)', async () => {
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'tick' });
            const techA = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });
            const techB = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ title: 'بلاغ سباق التبني', customer_name: 'عميل السباق' });
            const ticketId = created.body.data.id;

            const first = await request(app)
                .post(`/api/tickets/${ticketId}/claim`)
                .set('Authorization', `Bearer ${techA.token}`);
            expect(first.status).toBe(200);

            const second = await request(app)
                .post(`/api/tickets/${ticketId}/claim`)
                .set('Authorization', `Bearer ${techB.token}`);
            expect(second.status).toBe(409);
            expect(second.body.success).toBe(false);
        });

        test('بلاغ معيَّن بالفعل لا يمكن تبنّيه — 409', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const techA = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });
            const techB = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ title: 'بلاغ معيَّن مسبقاً', customer_name: 'عميل المعيَّن', assigned_to: techA.id });
            const ticketId = created.body.data.id;

            const res = await request(app)
                .post(`/api/tickets/${ticketId}/claim`)
                .set('Authorization', `Bearer ${techB.token}`);
            expect(res.status).toBe(409);
        });

        test('السلسلة الكاملة: تبنّي ← بدء عمل ← إكمال', async () => {
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'tick' });
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ title: 'بلاغ دورة التبني الكاملة', customer_name: 'عميل الدورة' });
            const ticketId = created.body.data.id;

            const claimed = await request(app)
                .post(`/api/tickets/${ticketId}/claim`)
                .set('Authorization', `Bearer ${tech.token}`);
            expect(claimed.status).toBe(200);

            const started = await request(app)
                .post(`/api/tickets/${ticketId}/start`)
                .set('Authorization', `Bearer ${tech.token}`);
            expect(started.status).toBe(200);
            expect(started.body.data.status).toBe('in_progress');
            expect(started.body.data.started_at).not.toBeNull();

            const completed = await request(app)
                .post(`/api/tickets/${ticketId}/complete`)
                .set('Authorization', `Bearer ${tech.token}`);
            expect(completed.status).toBe(200);
            expect(completed.body.data.status).toBe('completed');
        });

        test('المدير لا يستطيع التبني — 403 (التبني للفني فقط)', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin', prefix: 'tick' });
            const support = await createAuthenticatedUser({ role: 'support', prefix: 'tick' });

            const created = await request(app)
                .post('/api/tickets')
                .set('Authorization', `Bearer ${support.token}`)
                .send({ title: 'بلاغ التبني للمدير', customer_name: 'عميل المدير' });
            const ticketId = created.body.data.id;

            const res = await request(app)
                .post(`/api/tickets/${ticketId}/claim`)
                .set('Authorization', `Bearer ${admin.token}`);
            expect(res.status).toBe(403);
        });

        test('التبني بدون توكن — 401', async () => {
            const res = await request(app).post('/api/tickets/1/claim');
            expect(res.status).toBe(401);
        });

        test('التبني لبلاغ غير موجود — 404', async () => {
            const tech = await createAuthenticatedUser({ role: 'technician', prefix: 'tick' });
            const res = await request(app)
                .post('/api/tickets/999999/claim')
                .set('Authorization', `Bearer ${tech.token}`);
            expect(res.status).toBe(404);
        });
    });
    });
});
