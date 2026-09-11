// GLOBAL TEST SETUP: يضمن وجود المخطط قبل أي اختبار — قاعدة الاختبار
// قد تكون جديدة تماماً (CI/حاوية نظيفة). يتخطى التشغيل إن كان المخطط موجوداً
// (CREATE TABLE IF NOT EXISTS يجعل التشغيل idempotent بأمان)
module.exports = async function globalSetup() {
    if (!process.env.DATABASE_URL || /file:/.test(process.env.DATABASE_URL)) {
        console.log('[global-setup] DATABASE_URL غير مضبوط على PostgreSQL — تخطي إنشاء المخطط');
        return;
    }
    const { migrate } = require('../src/shared/db/migrate');
    const { pool } = require('../src/shared/db/index');
    try {
        await migrate();
        console.log('[global-setup] المخطط جاهز على قاعدة الاختبار');
    } catch (err) {
        console.error('[global-setup] فشل إعداد المخطط:', err.message);
        throw err;
    } finally {
        // نغلق الاتصالات كي لا تعيق jest --runInBand أو تسرّب مقابض
        await pool.end().catch(() => {});
    }
};
