const request = require('supertest');
const { app } = require('../src/app');
const { query } = require('../src/shared/db');
const { createAuthenticatedUser } = require('./helpers/auth');

const stamp = () => Date.now() + Math.floor(Math.random() * 100000);

describe('Users API', () => {
    describe('GET /api/users', () => {
        test('returns 401 without authentication', async () => {
            const res = await request(app).get('/api/users');
            expect(res.status).toBe(401);
        });

        test('المدير يحصل على قائمة {items, pagination} — الشكل الذي تقرؤه الواجهة', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.items)).toBe(true);
            expect(res.body.data.items.length).toBeGreaterThan(0);
            expect(res.body.data.pagination).toHaveProperty('total');
            // لا تسريب لكلمة المرور
            expect(res.body.data.items[0]).not.toHaveProperty('hashed_password');
        });

        test('الدعم يقرأ القائمة بلا صلاحية تعديل', async () => {
            const { token } = await createAuthenticatedUser({ role: 'support' });
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data.items)).toBe(true);
        });

        test('البحث النصي في الخادم يجد المستخدم عبر كل الصفحات (username/full_name)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const marker = `searchable_${stamp()}`;
            await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: marker, password: 'Strong@123', full_name: 'احمد searchable فريد' });

            // بحث باسم المستخدم
            const byUsername = await request(app)
                .get(`/api/users?search=${marker}`)
                .set('Authorization', `Bearer ${token}`);
            expect(byUsername.status).toBe(200);
            expect(byUsername.body.data.items).toHaveLength(1);
            expect(byUsername.body.data.items[0].username).toBe(marker);
            expect(byUsername.body.data.pagination.total).toBe(1);

            // بحث بالاسم الكامل
            const byName = await request(app)
                .get(`/api/users?search=${encodeURIComponent('احمد searchable')}`)
                .set('Authorization', `Bearer ${token}`);
            expect(byName.status).toBe(200);
            expect(byName.body.data.items.some(u => u.username === marker)).toBe(true);

            // بحث بلا نتائج
            const none = await request(app)
                .get('/api/users?search=no_such_user_zzz_999')
                .set('Authorization', `Bearer ${token}`);
            expect(none.status).toBe(200);
            expect(none.body.data.items).toHaveLength(0);
        });
    });

    describe('GET /api/users/:id', () => {
        test('returns 401 without authentication', async () => {
            const res = await request(app).get('/api/users/1');
            expect(res.status).toBe(401);
        });

        test('يعيد مستخدماً موجوداً و404 لغير الموجود', async () => {
            const { token, id } = await createAuthenticatedUser({ role: 'admin' });
            const ok = await request(app)
                .get(`/api/users/${id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(ok.status).toBe(200);
            expect(ok.body.data.id).toBe(id);

            const missing = await request(app)
                .get('/api/users/99999999')
                .set('Authorization', `Bearer ${token}`);
            expect(missing.status).toBe(404);
        });
    });

    describe('POST /api/users — إنشاء مستخدم بأي دور (مدير فقط)', () => {
        test('المدير ينشئ مستخدماً بدور محدد مباشرة', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const username = `created_support_${stamp()}`;
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username,
                    password: 'Strong@123',
                    full_name: 'مستخدم دعم منشأ',
                    role: 'support',
                    phone: '0500000000',
                    email: `support_${username}@test.local`,
                });
            expect(res.status).toBe(201);
            expect(res.body.data.username).toBe(username);
            expect(res.body.data.role).toBe('support');
            expect(res.body.data).not.toHaveProperty('hashed_password');

            // الدخول بكلمة المرور المحددة يعمل
            const login = await request(app)
                .post('/api/auth/login')
                .send({ username, password: 'Strong@123' });
            expect(login.status).toBe(200);
            expect(login.body.data.user.role).toBe('support');
        });

        test('بدون role يُنشأ فنياً افتراضياً', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `created_tech_${stamp()}`, password: 'Strong@123', full_name: 'فني منشأ' });
            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('technician');
        });

        test('اسم مستخدم مكرر يعيد 409 برسالة عربية', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const username = `dup_user_${stamp()}`;
            await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username, password: 'Strong@123', full_name: 'أول' });
            const dup = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username, password: 'Strong@123', full_name: 'ثانٍ' });
            expect(dup.status).toBe(409);
            expect(dup.body.error).toContain('موجود');
        });

        test('كلمة مرور قصيرة ترفض 400', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `weak_${stamp()}`, password: '123', full_name: 'ضعيف' });
            expect(res.status).toBe(400);
        });

        test('الدعم ممنوع من الإنشاء (403)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'support' });
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `noauth_${stamp()}`, password: 'Strong@123', full_name: 'ممنوع' });
            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /api/users/:id — حذف نهائي (مدير فقط)', () => {
        test('المدير يحذف مستخدماً آخر — يختفي من القائمة ولا يستطيع الدخول', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const victim = await createAuthenticatedUser({ role: 'technician' });

            const del = await request(app)
                .delete(`/api/users/${victim.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(del.status).toBe(200);
            expect(del.body.data.deleted).toBe(true);

            // اختفى من القائمة
            const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
            expect(list.body.data.items.find(u => u.id === victim.id)).toBeUndefined();

            // دخوله أصبح مستحيلاً
            const login = await request(app)
                .post('/api/auth/login')
                .send({ username: victim.username, password: 'secret123' });
            expect(login.status).toBe(401);
        });

        test('لا يمكن حذف حسابك الخاص (400)', async () => {
            const admin = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .delete(`/api/users/${admin.id}`)
                .set('Authorization', `Bearer ${admin.token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('حسابك');
        });

        test('لا يمكن حذف آخر مدير نشط (400) — الحارس على مستوى الخدمة', async () => {
            // عبر API لا يمكن الوصول لهذه الحالة: المدير المُرسل نفسه يُحسب مديراً نشطاً
            // في عدّاد الحارس — لذا نختبر منطق الحارس مباشرة على الخدمة (نفس ما يستدعيه المسار)
            const UsersService = require('../src/modules/users/users.service');
            const victim = await createAuthenticatedUser({ role: 'admin' });

            // اجعل الضحية المدير النشط الوحيد مؤقتاً (نزّل البقية عبر DB ثم استعدهم)
            const admins = await query("SELECT id FROM users WHERE role = 'admin' AND is_active <> false AND id <> $1", [victim.id]);
            await query("UPDATE users SET role = 'support' WHERE role = 'admin' AND id <> $1", [victim.id]);

            try {
                await UsersService.remove(victim.id, 999999); // مُرسل مختلف عن الضحية
                throw new Error('يجب أن يرفض الحارس الحذف — لم يفعل!');
            } catch (e) {
                expect(e.statusCode).toBe(400);
                expect(e.message).toContain('آخر مدير');
            } finally {
                for (const row of admins.rows) {
                    await query("UPDATE users SET role = 'admin' WHERE id = $1", [row.id]);
                }
            }
        });

        test('حذف مستخدم غير موجود يعيد 404', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const res = await request(app)
                .delete('/api/users/99999999')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });

        test('الدعم ممنوع من الحذف (403)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'support' });
            const victim = await createAuthenticatedUser({ role: 'technician' });
            const res = await request(app)
                .delete(`/api/users/${victim.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        test('حذف مستخدم له أثر لا يكسر المراجع — التذاكر تبقى بـ created_by فارغ', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const victim = await createAuthenticatedUser({ role: 'technician' });

            // تذكرة مرتبطة بالضحية (إدراج مباشر — إنشاء التذاكر API للمدير/الدعم فقط)
            const ticketRow = await query(
                `INSERT INTO tickets (title, customer_name, description, priority, status, created_by)
                 VALUES ('تذكرة قبل الحذف', 'عميل اختبار', 'اختبار المراجع', 'low', 'pending', $1)
                 RETURNING id`,
                [victim.id]
            );
            const ticketId = ticketRow.rows[0].id;

            const del = await request(app)
                .delete(`/api/users/${victim.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(del.status).toBe(200);

            // التذكرة ما زالت موجودة (created_by صار NULL عبر SET NULL)
            const check = await query('SELECT title, created_by FROM tickets WHERE id = $1', [ticketId]);
            expect(check.rows.length).toBe(1);
            expect(check.rows[0].created_by).toBeNull();
        });
    });

    describe('PUT /api/users/:id/password — إعادة تعيين كلمة المرور (مدير فقط)', () => {
        test('المدير يعيد تعيين كلمة مرور مستخدم — الدخول بالجديدة يعمل والقديمة تفشل', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const target = await createAuthenticatedUser({ role: 'technician' });

            const res = await request(app)
                .put(`/api/users/${target.id}/password`)
                .set('Authorization', `Bearer ${token}`)
                .send({ new_password: 'NewPass@456' });
            expect(res.status).toBe(200);

            const oldLogin = await request(app)
                .post('/api/auth/login')
                .send({ username: target.username, password: 'secret123' });
            expect(oldLogin.status).toBe(401);

            const newLogin = await request(app)
                .post('/api/auth/login')
                .send({ username: target.username, password: 'NewPass@456' });
            expect(newLogin.status).toBe(200);
        });

        test('كلمة مرور قصيرة ترفض 400', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const target = await createAuthenticatedUser({ role: 'technician' });
            const res = await request(app)
                .put(`/api/users/${target.id}/password`)
                .set('Authorization', `Bearer ${token}`)
                .send({ new_password: '123' });
            expect(res.status).toBe(400);
        });

        test('الدعم ممنوع من إعادة التعيين (403)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'support' });
            const target = await createAuthenticatedUser({ role: 'technician' });
            const res = await request(app)
                .put(`/api/users/${target.id}/password`)
                .set('Authorization', `Bearer ${token}`)
                .send({ new_password: 'NewPass@456' });
            expect(res.status).toBe(403);
        });
    });

    describe('PUT /api/users/:id — حارس آخر مدير', () => {
        test('لا يمكن تعطيل آخر مدير نشط (400) — الحارس على مستوى الخدمة', async () => {
            const UsersService = require('../src/modules/users/users.service');
            const victim = await createAuthenticatedUser({ role: 'admin' });

            const admins = await query("SELECT id FROM users WHERE role = 'admin' AND is_active <> false AND id <> $1", [victim.id]);
            await query("UPDATE users SET role = 'support' WHERE role = 'admin' AND id <> $1", [victim.id]);

            try {
                await UsersService.update(victim.id, { is_active: false });
                throw new Error('يجب أن يرفض الحارس التعطيل — لم يفعل!');
            } catch (e) {
                expect(e.statusCode).toBe(400);
                expect(e.message).toContain('آخر مدير');
            } finally {
                for (const row of admins.rows) {
                    await query("UPDATE users SET role = 'admin' WHERE id = $1", [row.id]);
                }
            }
        });

        test('لا يمكن تنزيل دور آخر مدير نشط (400) — الحارس على مستوى الخدمة', async () => {
            const UsersService = require('../src/modules/users/users.service');
            const victim = await createAuthenticatedUser({ role: 'admin' });

            const admins = await query("SELECT id FROM users WHERE role = 'admin' AND is_active <> false AND id <> $1", [victim.id]);
            await query("UPDATE users SET role = 'support' WHERE role = 'admin' AND id <> $1", [victim.id]);

            try {
                await UsersService.update(victim.id, { role: 'technician' });
                throw new Error('يجب أن يرفض الحارس تنزيل الدور — لم يفعل!');
            } catch (e) {
                expect(e.statusCode).toBe(400);
                expect(e.message).toContain('آخر مدير');
            } finally {
                for (const row of admins.rows) {
                    await query("UPDATE users SET role = 'admin' WHERE id = $1", [row.id]);
                }
            }
        });

        test('تعديل عادي لمستخدم عبر API يعمل (المدير)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const target = await createAuthenticatedUser({ role: 'technician' });
            const res = await request(app)
                .put(`/api/users/${target.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ full_name: 'اسم معدّل', phone: '0511111111' });
            expect(res.status).toBe(200);
            expect(res.body.data.full_name).toBe('اسم معدّل');
        });
    });

    describe('البريد/الهاتف الفارغان والمكرر — علّة الفهرس الفريد', () => {
        test("إنشاء مستخدمين ببريد فارغ ('') ينجح للاثنين — يُخزنان NULL لا ''", async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const s = stamp();
            const a = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `empty_email_a_${s}`, password: 'Strong@123', full_name: 'أول فارغ', phone: '', email: '' });
            expect(a.status).toBe(201);
            expect(a.body.data.email).toBeNull();

            const b = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `empty_email_b_${s}`, password: 'Strong@123', full_name: 'ثانٍ فارغ', phone: '', email: '' });
            expect(b.status).toBe(201);
            expect(b.body.data.email).toBeNull();
        });

        test('بريد مكرر مع حساب موجود يعيد 409 برسالة عربية (لا 500)', async () => {
            const { token } = await createAuthenticatedUser({ role: 'admin' });
            const s = stamp();
            await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `email_dup_a_${s}`, password: 'Strong@123', full_name: 'أول', email: `dup_${s}@test.local` });
            const dup = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: `email_dup_b_${s}`, password: 'Strong@123', full_name: 'ثانٍ', email: `dup_${s}@test.local` });
            expect(dup.status).toBe(409);
            expect(dup.body.error).toContain('مستخدم مسبقاً');
        });
    });
});
