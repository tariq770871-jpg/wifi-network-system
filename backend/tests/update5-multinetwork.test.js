/**
 * MULTI-NETWORK smoke tests — Update 5
 * يغطي: فلترة site_id=0 (غير المرتبطة) في البلاغات/الأجهزة/الداشبورد،
 * ربط وإزالة ربط البلاغ بشبكة + حماية الصلاحيات، وفلترة الأجهزة بالشبكة.
 */
const request = require('supertest');
const { app } = require('../src/app');
const { query, pool } = require('../src/shared/db');
const { createAuthenticatedUser } = require('./helpers/auth');

async function mkUser(role) {
    return createAuthenticatedUser({ role, prefix: `smoke_${role}` });
}

describe('Update 5 — MULTI-NETWORK (site_id=0 وربط البلاغات)', () => {
    let adminToken, techToken, A, T, id1, id2, tIds = [], dIds = [];
    let uncBefore, devUncBefore;

    beforeAll(async () => {
        const admin = await mkUser('admin');
        const tech = await mkUser('technician');
        adminToken = admin.token;
        techToken = tech.token;
        A = { Authorization: `Bearer ${adminToken}` };
        T = { Authorization: `Bearer ${techToken}` };

        // عدّاد ما قبل الاختبار (قاعدة مشتركة مع باقي الاختبارات)
        uncBefore = (await query('SELECT COUNT(*)::int AS c FROM tickets WHERE site_id IS NULL')).rows[0].c;
        devUncBefore = (await query('SELECT COUNT(*)::int AS c FROM devices WHERE site_id IS NULL')).rows[0].c;

        const s1 = await request(app).post('/api/sites').set(A).send({ name: `شبكة-دخان-1-${Date.now()}` });
        const s2 = await request(app).post('/api/sites').set(A).send({ name: `شبكة-دخان-2-${Date.now()}` });
        id1 = s1.body?.data?.id;
        id2 = s2.body?.data?.id;

        const t1 = await request(app).post('/api/tickets').set(A).send({ title: 'بلاغ مرتبط', customer_name: 'عميل-أ', site_id: id1 });
        const t2 = await request(app).post('/api/tickets').set(A).send({ title: 'بلاغ غير مرتبط 1', customer_name: 'عميل-ب' });
        const t3 = await request(app).post('/api/tickets').set(A).send({ title: 'بلاغ غير مرتبط 2', customer_name: 'عميل-ج' });
        tIds = [t1.body.data.id, t2.body.data.id, t3.body.data.id];

        const d1 = await request(app).post('/api/devices').set(A).send({ name: 'جهاز-مرتبط', site_id: id1, ip_address: '10.0.0.9' });
        const d2 = await request(app).post('/api/devices').set(A).send({ name: 'جهاز-غير-مرتبط' });
        dIds = [d1.body.data.id, d2.body.data.id];
    });

    afterAll(async () => {
        // تنظف ما أنشأه الاختبار كي لا يؤثر على عدّادات بقية الحزم
        await query('DELETE FROM devices WHERE id = ANY($1)', [dIds]).catch(() => {});
        await query('DELETE FROM tickets WHERE id = ANY($1)', [tIds]).catch(() => {});
        await query('DELETE FROM sites WHERE id = ANY($1)', [[id1, id2]]).catch(() => {});
        await pool.end().catch(() => {});
    });

    test('إنشاء بلاغ مع site_id يحفظ الشبكة مباشرة', async () => {
        const row = (await query('SELECT site_id FROM tickets WHERE id = $1', [tIds[0]])).rows[0];
        expect(row.site_id).toBe(id1);
    });

    test('GET /tickets?site_id=0 يُرجع غير المرتبطين فقط (قبل + 2)', async () => {
        const res = await request(app).get('/api/tickets?site_id=0&page=1&limit=100').set(A);
        expect(res.status).toBe(200);
        const items = res.body?.data?.items || [];
        expect(items.length).toBe(uncBefore + 2);
        expect(items.every((x) => x.site_id == null)).toBe(true);
        expect(items.some((x) => x.id === tIds[1])).toBe(true);
        expect(items.some((x) => x.id === tIds[2])).toBe(true);
    });

    test('GET /tickets?site_id=N يُرجع الشبكة المحددة فقط', async () => {
        const res = await request(app).get(`/api/tickets?site_id=${id1}&page=1&limit=100`).set(A);
        expect(res.status).toBe(200);
        const items = res.body?.data?.items || [];
        expect(items.length).toBe(1);
        expect(items[0].id).toBe(tIds[0]);
    });

    test('GET /tickets?site_id غير صالح → 400', async () => {
        const res = await request(app).get('/api/tickets?site_id=abc&page=1').set(A);
        expect(res.status).toBe(400);
    });

    test('POST /tickets/:id/site يربط البلاغ (أدمن) وnull يزيل الربط', async () => {
        const link = await request(app).post(`/api/tickets/${tIds[1]}/site`).set(A).send({ site_id: id2 });
        expect(link.status).toBe(200);
        expect(link.body?.data?.site_id).toBe(id2);
        const unlink = await request(app).post(`/api/tickets/${tIds[1]}/site`).set(A).send({ site_id: null });
        expect(unlink.status).toBe(200);
        expect(unlink.body?.data?.site_id).toBeNull();
    });

    test('POST /tickets/:id/site ممنوع للفني → 403، وشبكة غير موجودة → 404', async () => {
        const techLink = await request(app).post(`/api/tickets/${tIds[2]}/site`).set(T).send({ site_id: id1 });
        expect(techLink.status).toBe(403);
        const bad = await request(app).post(`/api/tickets/${tIds[2]}/site`).set(A).send({ site_id: 999999 });
        expect(bad.status).toBe(404);
    });

    test('GET /devices?site_id=0 يُرجع غير المرتبطة فقط (قبل + 1) وsite_id=N الشبكة فقط', async () => {
        const unc = await request(app).get('/api/devices?site_id=0&page=1&limit=100').set(A);
        expect(unc.status).toBe(200);
        const uncItems = unc.body?.data?.items || [];
        expect(uncItems.length).toBe(devUncBefore + 1);
        expect(uncItems.some((x) => x.id === dIds[1])).toBe(true);

        const f1 = await request(app).get(`/api/devices?site_id=${id1}&page=1&limit=100`).set(A);
        expect(f1.status).toBe(200);
        const f1Items = f1.body?.data?.items || [];
        expect(f1Items.length).toBe(1);
        expect(f1Items[0].id).toBe(dIds[0]);
    });

    test('الداشبورد site_id=0/N يحصر إحصائيات البلاغات والأجهزة في الشبكة', async () => {
        const d0 = await request(app).get('/api/reports/dashboard?site_id=0').set(A);
        expect(d0.status).toBe(200);
        const total0 = (d0.body?.data?.tickets || []).reduce((a, r) => a + Number(r.count), 0);
        expect(total0).toBe(uncBefore + 2);
        expect(Number(d0.body?.data?.devices?.total)).toBe(devUncBefore + 1);

        const d1 = await request(app).get(`/api/reports/dashboard?site_id=${id1}`).set(A);
        expect(d1.status).toBe(200);
        const total1 = (d1.body?.data?.tickets || []).reduce((a, r) => a + Number(r.count), 0);
        expect(total1).toBe(1);
        expect(Number(d1.body?.data?.devices?.total)).toBe(1);
    });
});
