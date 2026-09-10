/**
 * Request ID Middleware - معرّف فريد لكل طلب
 * -------------------------------------------
 * - يقرأ X-Request-ID الوارد (من load balancer) أو يولّد جديداً
 * - يعيده للعميل في X-Request-ID
 * - متاح كـ req.id لربط السجلات (correlation)
 */
const crypto = require('crypto');

function requestId(req, res, next) {
    const incoming = req.headers['x-request-id'];
    req.id = (typeof incoming === 'string' && incoming.length >= 8 && incoming.length <= 128)
        ? incoming
        : crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
}

module.exports = { requestId };
