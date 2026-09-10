/**
 * Test Helper - أدوات مشتركة للاختبارات
 * ---------------------------------------
 * SECURITY NOTE: إنشاء admin في الاختبارات يتم عبر ترقية مباشر في قاعدة
 * البيانات (طريقة الخادم الحقيقية: npm run seed) — لأن API التسجيل
 * يمنع تعيين الأدوار عمداً (ثغرة تصعيد الصلاحيات أُغلقت).
 */
const request = require('supertest');
const { app } = require('../../src/app');
const { query } = require('../../src/shared/db');

/**
 * إنشاء مستخدم بأي دور عبر: تسجيل API + ترقية مباشرة في DB (إن لزم)
 * @returns {{token: string, username: string}}
 */
async function createAuthenticatedUser({ role = 'technician', prefix = 'tuser' } = {}) {
    const suffix = Date.now() + Math.floor(Math.random() * 10000);
    const username = `${prefix}_${role}_${suffix}`;

    // 1) التسجيل عبر API (يُنشئ technician دائماً)
    await request(app)
        .post('/api/auth/register')
        .send({
            username,
            password: 'secret123',
            full_name: `Test ${role}`,
        });

    // 2) ترقية الدور مباشرة في DB (نفس ما يفعله seed.js)
    if (role !== 'technician') {
        await query('UPDATE users SET role = $1 WHERE username = $2', [role, username]);
    }

    // 3) تسجيل الدخول للحصول على token
    const login = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'secret123' });

    return { token: login.body?.data?.token, username };
}

module.exports = { createAuthenticatedUser };
