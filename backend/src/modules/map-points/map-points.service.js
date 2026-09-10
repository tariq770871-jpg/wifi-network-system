const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

class MapPointsService {
    static async getAll(queryParams = {}) {
        const status = queryParams.status;
        const { page, limit, offset } = parsePagination(queryParams);
        let sql = `
            SELECT mp.*, creator.full_name as creator_name, reviewer.full_name as reviewer_name
            FROM map_points mp
            LEFT JOIN users creator ON mp.created_by = creator.id
            LEFT JOIN users reviewer ON mp.reviewed_by = reviewer.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            sql += ` AND mp.status = $${params.length}`;
        }

        sql += ` ORDER BY mp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

        const countResult = await query(`SELECT COUNT(*)::int AS total FROM map_points mp ${status ? 'WHERE mp.status = $1' : ''}`, status ? [status] : []);
        const result = await query(sql, [...params, limit, offset]);
        return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
    }

    static async getById(id) {
        const result = await query(`
            SELECT mp.*, creator.full_name as creator_name, reviewer.full_name as reviewer_name
            FROM map_points mp
            LEFT JOIN users creator ON mp.created_by = creator.id
            LEFT JOIN users reviewer ON mp.reviewed_by = reviewer.id
            WHERE mp.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'النقطة غير موجودة' };
        }

        return result.rows[0];
    }

    static async create({ name, note, location_lat, location_lng }, createdBy) {
        if (!name || name.trim() === '') {
            throw { statusCode: 400, message: 'الاسم إلزامي' };
        }

        const result = await query(
            'INSERT INTO map_points (name, note, location_lat, location_lng, created_by, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, note, location_lat, location_lng, createdBy, 'pending']
        );

        return result.rows[0];
    }

    static async review(id, status, reviewedBy) {
        if (!['approved', 'rejected'].includes(status)) {
            throw { statusCode: 400, message: 'الحالة يجب أن تكون approved أو rejected' };
        }

        const result = await query(
            'UPDATE map_points SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 RETURNING *',
            [status, reviewedBy, id]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'النقطة غير موجودة' };
        }

        return result.rows[0];
    }

    static async getMyRequests(userId) {
        const result = await query(
            'SELECT * FROM map_points WHERE created_by = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }

    static async delete(id) {
        const result = await query('DELETE FROM map_points WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'النقطة غير موجودة' };
        }
    }
}

module.exports = MapPointsService;
