const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../shared/db');
const { JWT_SECRET } = require('../../shared/middleware/auth');
const { success, error } = require('../../shared/utils/response');

const register = async (req, res) => {
    try {
        const { username, password, full_name, role, phone, email } = req.body;

        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return error(res, 'اسم المستخدم موجود مسبقاً', 409);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (username, hashed_password, full_name, role, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, role',
            [username, hashedPassword, full_name, role || 'technician', phone, email]
        );

        success(res, result.rows[0], 'تم إنشاء الحساب بنجاح');
    } catch (err) {
        error(res, err.message, 500);
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await query(
            'SELECT id, username, full_name, role, hashed_password, tracking_enabled, tracking_veto FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return error(res, 'اسم المستخدم أو كلمة المرور غير صحيحة', 401);
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.hashed_password);

        if (!validPassword) {
            return error(res, 'اسم المستخدم أو كلمة المرور غير صحيحة', 401);
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        delete user.hashed_password;
        success(res, { token, user }, 'تم تسجيل الدخول بنجاح');
    } catch (err) {
        error(res, err.message, 500);
    }
};

const me = async (req, res) => {
    try {
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, tracking_enabled, tracking_veto FROM users WHERE id = $1',
            [req.user.id]
        );
        success(res, result.rows[0]);
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { register, login, me };
