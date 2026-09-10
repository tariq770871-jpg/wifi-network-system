/**
 * Response Helpers - أدوات الاستجابة الموحدة
 * -------------------------------------------
 * - success: استجابة نجاح موحدة
 * - error: استجابة خطأ موحدة
 * - respondError: معالجة أخطاء الخدمات مع دعم i18n (err.messageKey)
 */
const success = (res, data, message = 'تم بنجاح', statusCode) => {
    const payload = { success: true, message, data };
    if (statusCode) {
        res.status(statusCode).json(payload);
    } else {
        res.json(payload);
    }
};

const error = (res, message, statusCode = 400) => {
    res.status(statusCode).json({ success: false, error: message });
};

/**
 * يستخدم في catch داخل الـ controllers:
 * يترجم err.messageKey حسب req.lang إن توفر، وإلا يستخدم err.message العربية
 */
const respondError = (req, res, err, fallbackStatusCode = 500) => {
    const statusCode = err.statusCode || fallbackStatusCode;
    let message;
    if (err.messageKey && req.t) {
        message = req.t(err.messageKey, err.messageParams);
    } else {
        message = err.message || (req.t ? req.t('SERVER_ERROR') : 'حدث خطأ في الخادم');
    }
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(req.id && { request_id: req.id }),
    });
};

module.exports = { success, error, respondError };
