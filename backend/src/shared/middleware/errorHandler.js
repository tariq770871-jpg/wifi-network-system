/**
 * Central Error Handler - معالج الأخطاء المركزي
 * ---------------------------------------------
 * - يدعم i18n عبر err.messageKey (يترجم حسب req.lang)
 * - يخفي stack في الإنتاج
 * - يسجل عبر الـ logger المنظم مع request-id
 */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.messageKey && req.t
        ? req.t(err.messageKey, err.messageParams)
        : (err.message || (req.t ? req.t('SERVER_ERROR') : 'حدث خطأ في الخادم'));

    logger.error('Request failed', {
        request_id: req.id,
        method: req.method,
        url: req.originalUrl,
        status: statusCode,
        error: err.message,
        stack: statusCode >= 500 ? err.stack : undefined,
    });

    const isDevStack = process.env.NODE_ENV === 'development' && err.stack;

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(isDevStack && { stack: err.stack }),
        ...(req.id && { request_id: req.id }),
    });
};

module.exports = errorHandler;
