const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

class UsersService {
    static async getAll(queryParams = {}) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query('SELECT COUNT(*)::int AS total FROM users');
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
    }

    static async getById(id) {
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at FROM users WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, messageKey: 'USER_NOT_FOUND', message: 'المستخدم غير موجود' };
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

    static async controlTracking(id, enabled, veto) {
        // دعم ضبط التفعيل وحق الاعتراض معاً أو منفصلاً (المدير فقط)
        const sets = [];
        const params = [];
        if (enabled !== undefined) {
            params.push(!!enabled);
            sets.push(`tracking_enabled = $${params.length}`);
        }
        if (veto !== undefined) {
            params.push(!!veto);
            sets.push(`tracking_veto = $${params.length}`);
        }
        if (sets.length === 0) {
            throw { statusCode: 400, message: 'لا توجد قيم للتحديث — أرسل enabled و/أو tracking_veto' };
        }
        params.push(id);
        const result = await query(
            `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, username, full_name, tracking_enabled, tracking_veto`,
            params
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
