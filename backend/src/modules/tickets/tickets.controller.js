const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

const ticketsController = {
    getAll: async (req, res) => {
        try {
            const result = await query('SELECT * FROM tickets ORDER BY created_at DESC');
            success(res, result.rows);
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    getById: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await query('SELECT * FROM tickets WHERE id = $1', [id]);
            if (result.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            success(res, result.rows[0]);
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    create: async (req, res) => {
        try {
            const { title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to } = req.body;
            const result = await query(
                `INSERT INTO tickets (title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, status, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10) RETURNING *`,
                [title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, req.user?.id]
            );
            success(res, result.rows[0], 'تم إنشاء البلاغ بنجاح', 201);
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, customer_name, customer_phone, priority, status } = req.body;
            const result = await query(
                `UPDATE tickets SET
                    title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    customer_name = COALESCE($3, customer_name),
                    customer_phone = COALESCE($4, customer_phone),
                    priority = COALESCE($5, priority),
                    status = COALESCE($6, status),
                    updated_at = NOW()
                 WHERE id = $7 RETURNING *`,
                [title, description, customer_name, customer_phone, priority, status, id]
            );
            if (result.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            success(res, result.rows[0], 'تم تحديث البلاغ');
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
            if (result.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            success(res, null, 'تم حذف البلاغ');
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    assign: async (req, res) => {
        try {
            const { id } = req.params;
            const { assigned_to } = req.body;

            if (!assigned_to) {
                return error(res, 'يجب تحديد الفني', 400);
            }

            const result = await query(
                'UPDATE tickets SET assigned_to = $1, status = $2, started_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *',
                [assigned_to, 'assigned', id]
            );
            if (result.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            success(res, result.rows[0], 'تم تعيين الفني');
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    start: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await query(
                "UPDATE tickets SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1 RETURNING *",
                [id]
            );
            if (result.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            success(res, result.rows[0], 'تم بدء العمل');
        } catch (err) {
            error(res, err.message, 500);
        }
    },

    complete: async (req, res) => {
        try {
            const { id } = req.params;
            const { notes } = req.body;
            const noteText = notes ? '\n\nملاحظات الإكمال: ' + notes : '';
            const result = await query(
                "UPDATE tickets SET status = 'completed', completed_at = NOW(), updated_at = NOW(), description = description || $1 WHERE id = $2 RETURNING *",
                [noteText, id]
            );
            if (result.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            success(res, result.rows[0], 'تم إكمال البلاغ');
        } catch (err) {
            error(res, err.message, 500);
        }
    },
};

module.exports = ticketsController;
