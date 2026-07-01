const jwt = require('jsonwebtoken');
const { query } = require('../db');
const config = require('../config');

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'لم يتم توفير رمز المصادقة' });
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const result = await query(
            'SELECT id, username, full_name, role, tracking_enabled, tracking_veto FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'المستخدم غير موجود' });
        }

        req.user = result.rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'رمز المصادقة غير صالح' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'ليس لديك صلاحية للوصول' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
