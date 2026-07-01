const { query } = require('../../shared/db');

class UsersService {
    static async getAll() {
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at FROM users ORDER BY created_at DESC'
        );
        return result.rows;
    }

    static async getById(id) {
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at FROM users WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }
        return result.rows[0];
    }

    static async update(id, data) {
        const { full_name, phone, email, is_active, role } = data;
        const result = await query(
            `UPDATE users SET
                full_name = COALESCE($1, full_name),
                phone = COALESCE($2, phone),
                email = COALESCE($3, email),
                is_active = COALESCE($4, is_active),
                role = COALESCE($5, role),
                updated_at = NOW()
            WHERE id = $6 RETURNING id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, updated_at`,
            [full_name, phone, email, is_active, role, id]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }
        return result.rows[0];
    }

    static async controlTracking(id, enabled) {
        const result = await query(
            'UPDATE users SET tracking_enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, full_name, tracking_enabled, tracking_veto',
            [enabled, id]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }
        return result.rows[0];
    }

    static async vetoTracking(userId, veto) {
        const result = await query(
            'UPDATE users SET tracking_veto = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, full_name, tracking_enabled, tracking_veto',
            [veto, userId]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }
        return result.rows[0];
    }
}

module.exports = UsersService;
