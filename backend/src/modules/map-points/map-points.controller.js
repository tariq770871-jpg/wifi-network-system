const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

const getAll = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = `
            SELECT mp.*, creator.full_name as creator_name, reviewer.full_name as reviewer_name
            FROM map_points mp
            LEFT JOIN users creator ON mp.created_by = creator.id
            LEFT JOIN users reviewer ON mp.reviewed_by = reviewer.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND mp.status = $1';
            params.push(status);
        }

        sql += ' ORDER BY mp.created_at DESC';

        const result = await query(sql, params);
        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`
            SELECT mp.*, creator.full_name as creator_name, reviewer.full_name as reviewer_name
            FROM map_points mp
            LEFT JOIN users creator ON mp.created_by = creator.id
            LEFT JOIN users reviewer ON mp.reviewed_by = reviewer.id
            WHERE mp.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return error(res, 'النقطة غير موجودة', 404);
        }
        success(res, result.rows[0]);
    } catch (err) {
        error(res, err.message, 500);
    }
};

const create = async (req, res) => {
    try {
        const { name, note, location_lat, location_lng } = req.body;

        if (!name || name.trim() === '') {
            return error(res, 'الاسم إلزامي', 400);
        }

        const result = await query(
            'INSERT INTO map_points (name, note, location_lat, location_lng, created_by, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, note, location_lat, location_lng, req.user.id, 'pending']
        );

        success(res, result.rows[0], 'تم إرسال الطلب بنجاح - بانتظار موافقة الإدارة');
    } catch (err) {
        error(res, err.message, 500);
    }
};

const review = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' or 'rejected'

        if (!['approved', 'rejected'].includes(status)) {
            return error(res, 'الحالة يجب أن تكون approved أو rejected', 400);
        }

        const result = await query(
            'UPDATE map_points SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 RETURNING *',
            [status, req.user.id, id]
        );

        if (result.rows.length === 0) {
            return error(res, 'النقطة غير موجودة', 404);
        }

        const message = status === 'approved' ? 'تمت الموافقة على النقطة' : 'تم رفض النقطة';
        success(res, result.rows[0], message);
    } catch (err) {
        error(res, err.message, 500);
    }
};

const getMyRequests = async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM map_points WHERE created_by = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

const deletePoint = async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM map_points WHERE id = $1', [id]);
        success(res, null, 'تم حذف النقطة');
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, review, getMyRequests, delete: deletePoint };
