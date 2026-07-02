const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../shared/db');
const config = require('../../shared/config');

class AuthService {
    /**
     * Register a new user
     */
    static async register({ username, password, full_name, role, phone, email }) {
        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            throw { statusCode: 409, message: 'اسم المستخدم موجود مسبقاً' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (username, hashed_password, full_name, role, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, role, phone, email, created_at',
            [username, hashedPassword, full_name, role || 'technician', phone, email]
        );

        return result.rows[0];
    }

    /**
     * Authenticate user and return JWT token
     */
    static async login({ username, password }) {
        const result = await query(
            'SELECT id, username, full_name, role, hashed_password, tracking_enabled, tracking_veto FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 401, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.hashed_password);

        if (!validPassword) {
            throw { statusCode: 401, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        const { hashed_password, ...userWithoutPassword } = user;
        return { token, user: userWithoutPassword };
    }

    /**
     * Get current user profile
     */
    static async getMe(userId) {
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, tracking_enabled, tracking_veto, is_active, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }

        return result.rows[0];
    }

    /**
     * Change user's own password
     */
    static async changePassword(userId, currentPassword, newPassword) {
        if (!currentPassword || !newPassword) {
            throw { statusCode: 400, message: 'كلمة المرور الحالية والجديدة مطلوبتان' };
        }
        if (newPassword.length < 4) {
            throw { statusCode: 400, message: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' };
        }

        const result = await query('SELECT hashed_password FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }

        const valid = await bcrypt.compare(currentPassword, result.rows[0].hashed_password);
        if (!valid) {
            throw { statusCode: 401, message: 'كلمة المرور الحالية غير صحيحة' };
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET hashed_password = $1, updated_at = NOW() WHERE id = $2', [hashed, userId]);
        return null;
    }

    /**
     * Update user's own profile
     */
    static async updateProfile(userId, data) {
        const { full_name, phone, email } = data;
        const result = await query(
            'UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), email = COALESCE($3, email), updated_at = NOW() WHERE id = $4 RETURNING id, username, full_name, role, phone, email, tracking_enabled, tracking_veto',
            [full_name, phone, email, userId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }

        return result.rows[0];
    }
}

module.exports = AuthService;
