const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');
const bcrypt = require('bcryptjs');

const SAFE_FIELDS = 'id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at';

class UsersService {
    /**
     * حارس "آخر مدير نشط" — يمنع ترك النظام بلا مدير فعال
     * يُستخدم عند: تعطيل مدير، تنزيل دوره، أو حذفه
     */
    static async assertNotLastActiveAdmin(targetId) {
        const target = await query(
            `SELECT id, role, is_active FROM users WHERE id = $1`,
            [targetId]
        );
        if (target.rows.length === 0) return; // غير موجود — الخدمة المستدعية ترفع 404
        const u = target.rows[0];
        if (u.role !== 'admin' || u.is_active === false) return; // ليس مديراً نشطاً — لا خطر

        // كم مدير نشط آخر (غير الهدف)؟
        const others = await query(
            `SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin' AND is_active <> false AND id <> $1`,
            [targetId]
        );
        if (others.rows[0].total === 0) {
            throw { statusCode: 400, message: 'لا يمكن تنفيذ العملية — هذا آخر مدير نشط في النظام' };
        }
    }

    static async getAll(queryParams = {}) {
        const { page, limit, offset } = parsePagination(queryParams);
        // بحث نصي موحد في الخادم (username/full_name/phone) — يعمل عبر كل الصفحات
        const search = queryParams.search && String(queryParams.search).trim() !== ''
            ? `%${String(queryParams.search).trim()}%`
            : null;
        const where = search ? 'WHERE username ILIKE $1 OR full_name ILIKE $1 OR phone ILIKE $1' : '';
        const params = search ? [search] : [];
        const countResult = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);
        const result = await query(
            `SELECT ${SAFE_FIELDS} FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );
        return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
    }

    static async getById(id) {
        const result = await query(
            `SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, messageKey: 'USER_NOT_FOUND', message: 'المستخدم غير موجود' };
        }
        return result.rows[0];
    }

    /**
     * إنشاء مستخدم بأي دور — المدير فقط (عبر POST /users)
     * يتيح اختيار الدور مباشرة بدل إنشاء فني ثم تعديله
     * ملاحظة: القيم الفارغة (null/'') تُخزن NULL — عمود email عليه فهرس فريد
     */
    static async create({ username, password, full_name, role, phone, email }) {
        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            throw { statusCode: 409, messageKey: 'USERNAME_TAKEN', message: 'اسم المستخدم موجود مسبقاً' };
        }
        if (!password || password.length < 6) {
            throw { statusCode: 400, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
        }
        const emailVal = email && String(email).trim() !== '' ? String(email).trim() : null;
        if (emailVal) {
            const dupEmail = await query('SELECT id FROM users WHERE email = $1', [emailVal]);
            if (dupEmail.rows.length > 0) {
                throw { statusCode: 409, message: 'البريد الإلكتروني مستخدم مسبقاً لحساب آخر' };
            }
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
            const result = await query(
                `INSERT INTO users (username, hashed_password, full_name, role, phone, email)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING ${SAFE_FIELDS}`,
                [username, hashedPassword, full_name, role || 'technician', (phone && String(phone).trim() !== '') ? String(phone).trim() : null, emailVal]
            );
            return result.rows[0];
        } catch (err) {
            // 23505 = unique_violation (سباق اسم/بريد بين طلبين متزامنين)
            if (err && err.code === '23505') {
                throw { statusCode: 409, message: 'اسم المستخدم أو البريد الإلكتروني موجود مسبقاً' };
            }
            throw err;
        }
    }

    /**
     * حذف مستخدم نهائياً — المدير فقط
     * حواجز: لا تحذف نفسك، لا تحذف آخر مدير نشط
     * مراجع القاعدة آمنة (SET NULL/CASCADE): التذاكر والنقاط والأجهزة تبقى بلا مستخدم
     */
    static async remove(id, requesterId) {
        if (Number(id) === Number(requesterId)) {
            throw { statusCode: 400, message: 'لا يمكنك حذف حسابك الخاص — استخدم طلب مدير آخر' };
        }
        const exists = await query('SELECT id FROM users WHERE id = $1', [id]);
        if (exists.rows.length === 0) {
            throw { statusCode: 404, messageKey: 'USER_NOT_FOUND', message: 'المستخدم غير موجود' };
        }
        await UsersService.assertNotLastActiveAdmin(id);
        await query('DELETE FROM users WHERE id = $1', [id]);
        return { id: Number(id), deleted: true };
    }

    /**
     * إعادة تعيين كلمة مرور مستخدم — المدير فقط (بلا كلمة المرور الحالية)
     */
    static async resetPassword(id, newPassword) {
        if (!newPassword || newPassword.length < 6) {
            throw { statusCode: 400, message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' };
        }
        const exists = await query('SELECT id FROM users WHERE id = $1', [id]);
        if (exists.rows.length === 0) {
            throw { statusCode: 404, messageKey: 'USER_NOT_FOUND', message: 'المستخدم غير موجود' };
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET hashed_password = $1, updated_at = NOW() WHERE id = $2', [hashed, id]);
        return { id: Number(id), password_reset: true };
    }

    static async update(id, data) {
        const { full_name, phone, email, is_active, role } = data;
        // حارس آخر مدير: منع تعطيل المدير الأخير أو تنزيل دوره
        if ((is_active === false || (role && role !== 'admin'))) {
            await UsersService.assertNotLastActiveAdmin(id);
        }
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
