/**
 * Discovery Controller — نقاط النهاية لجلب الأجهزة من MikroTik
 * POST /api/devices/discovery/sync     → جلب الأجهزة الآن (admin)
 * GET  /api/devices/discovery/status   → آخر مزامنة + الإعداد التلقائي (كل الأدوار)
 * PUT  /api/devices/discovery/settings → ضبط فاصل المزامنة التلقائية (admin)
 */
const { success, error, respondError } = require('../../shared/utils/response');
const discovery = require('./discovery.service');

/** POST /api/devices/discovery/sync — المزامنة اليدوية (زر "جلب أجهزة MikroTik") */
const runSync = async (req, res) => {
    try {
        const result = await discovery.syncAllRouters('manual');
        if (result.busy) {
            return error(res, 'توجد مزامنة قيد التنفيذ حالياً — انتظر انتهاءها ثم أعد المحاولة', 409);
        }
        if (result.routers_total === 0) {
            return error(res, 'لا يوجد راوتر مرتبط بـ MikroTik — اربط الراوتر أولاً: عدّل الجهاز وفعّل "ربط MikroTik" (IP + مستخدم + كلمة مرور + منفذ 8728)', 400);
        }
        const message = result.routers_failed > 0
            ? `تم الجلب من ${result.routers_ok} من ${result.routers_total} راوتر — بعض الراوترات لم تستجب`
            : `تم جلب ${result.seen_count} جهاز من ${result.routers_ok} راوتر`;
        success(res, result, message);
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/devices/discovery/status — حالة المزامنة (تُعرض أسفل تبويب الأجهزة) */
const getStatus = async (req, res) => {
    try {
        success(res, await discovery.getDiscoveryStatus(), 'تم جلب حالة المزامنة');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** PUT /api/devices/discovery/settings — ضبط المزامنة التلقائية (interval_minutes = 0 للإيقاف) */
const updateSettings = async (req, res) => {
    try {
        const interval = await discovery.setAutoIntervalMinutes(req.body.interval_minutes);
        success(res, { interval_minutes: interval },
            interval > 0
                ? `تم ضبط المزامنة التلقائية كل ${interval} دقيقة`
                : 'تم إيقاف المزامنة التلقائية');
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = { runSync, getStatus, updateSettings };
