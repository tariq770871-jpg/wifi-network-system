const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

// رسائل افتراضية إنجليزية خام من express-validator — تُستبدل بمكافئ عربي واضح
// (مثال: فشل isIn/isInt على قيمة null قبل إصلاح optional → "Invalid value")
const DEFAULT_MSG_MAP = [
    [/^Invalid value$/i, 'قيمة غير صالحة في أحد الحقول'],
    [/^Invalid param$/i, 'معامل غير صالح في المسار'],
    [/^Invalid query$/i, 'معامل بحث غير صالح'],
];

const translateDefaults = (msg) => {
    for (const [re, ar] of DEFAULT_MSG_MAP) {
        if (re.test(msg)) return ar;
    }
    return msg;
};

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map((e) => translateDefaults(e.msg));
        return error(res, messages.join('، '), 400);
    }
    next();
};

module.exports = { validateRequest };
