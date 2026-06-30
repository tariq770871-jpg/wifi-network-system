const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'لم يتم توفير رمز المصادقة' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await query('SELECT id, username, full_name, role, tracking_enabled, tracking_veto FROM users WHERE id = $1', [decoded.userId]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'المستخدم غير موجود' });
        }

        req.user = result.rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ error: 'رمز المصادقة غير صالح' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
        }
        next();
    };
};

module.exports = { authenticate, authorize, JWT_SECRET };
