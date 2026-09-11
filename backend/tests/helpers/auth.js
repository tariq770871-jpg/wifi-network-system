/**
 * Test Helper - أدوات مشتركة للاختبارات
 * ---------------------------------------
 * SECURITY NOTE 1: إنشاء admin في الاختبارات يتم عبر ترقية مباشر في قاعدة
 * البيانات (طريقة الخادم الحقيقية: npm run seed) — لأن API التسجيل
 * يمنع تعيين الأدوار عمداً (ثغرة تصعيد الصلاحيات أُغلقت).
 * SECURITY NOTE 2: /auth/register أصبح للمدير فقط (أُغلق التسجيل العام)،
 * لذا تُنشأ حسابات الاختبار بإدراج مباشر في قاعدة البيانات — أسرع ولا
 * تستهلك حد المعدل.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app } = require('../../src/app');
const { query } = require('../../src/shared/db');

/**
 * إنشاء مستخدم بأي دور بإدراج مباشر في قاعدة البيانات ثم تسجيل دخول API
 * @returns {{token: string, username: string, id: number}}
 */
async function createAuthenticatedUser({ role = 'technician', prefix = 'tuser' } = {}) {
    const suffix = Date.now() + Math.floor(Math.random() * 10000);
    const username = `${prefix}_${role}_${suffix}`;
    const hashed = await bcrypt.hash('secret123', 10);

    const inserted = await query(
        `INSERT INTO users (username, hashed_password, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, username, role`,
        [username, hashed, `Test ${role}`, role]
    );

    const login = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'secret123' });

    if (login.status !== 200) {
        throw new Error(`فشل دخول مستخدم الاختبار ${username}: ${JSON.stringify(login.body)}`);
    }

    return { token: login.body?.data?.token, username, id: inserted.rows[0].id };
}

module.exports = { createAuthenticatedUser };
