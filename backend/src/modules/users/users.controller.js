const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

const getAll = async (req, res) => {
    try {
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at FROM users ORDER BY created_at DESC'
        );
        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            'SELECT id, username, full_name, role, phone, email, is_active, tracking_enabled, tracking_veto, created_at FROM users WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return error(res, 'المستخدم غير موجود', 404);
        }
        success(res, result.rows[0]);
    } catch (err) {
        error(res, err.message, 500);
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, phone, email, is_active, role } = req.body;
        const result = await query(
            'UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), email = COALESCE($3, email), is_active = COALESCE($4, is_active), role = COALESCE($5, role), updated_at = NOW() WHERE id = $6 RETURNING *',
            [full_name, phone, email, is_active, role, id]
        );
        success(res, result.rows[0], 'تم التحديث بنجاح');
    } catch (err) {
        error(res, err.message, 500);
    }
};

// تحكم الإدارة في التتبع
const controlTracking = async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const result = await query(
            'UPDATE users SET tracking_enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, full_name, tracking_enabled, tracking_veto',
            [enabled, id]
        );

        success(res, result.rows[0], enabled ? 'تم تفعيل التتبع' : 'تم إيقاف التتبع');
    } catch (err) {
        error(res, err.message, 500);
    }
};

// الفيتو - الفني يوقف تتبعه
const vetoTracking = async (req, res) => {
    try {
        const userId = req.user.id;
        const { veto } = req.body;

        const result = await query(
            'UPDATE users SET tracking_veto = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, full_name, tracking_enabled, tracking_veto',
            [veto, userId]
        );

        success(res, result.rows[0], veto ? 'تم إيقاف التتبع يدوياً' : 'تم استئناف التتبع');
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { getAll, getById, update, controlTracking, vetoTracking };
