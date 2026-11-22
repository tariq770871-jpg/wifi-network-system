const devicesRoutes = require('./devices.routes');
const discovery = require('./discovery.service');

// FEATURE: بدء المجدول التلقائي لجلب الأجهزة من MikroTik عند إقلاع الخادم
// الفترة تُقرأ من app_settings (الافتراضي 10 دقائق، 0 = موقفة) — لا يعمل في بيئة الاختبار
if (process.env.NODE_ENV !== 'test') {
    discovery.startScheduler().catch((e) =>
        console.warn('[Discovery] تعذر بدء مجدول المزامنة:', e.message)
    );
}

module.exports = { devicesRoutes };
