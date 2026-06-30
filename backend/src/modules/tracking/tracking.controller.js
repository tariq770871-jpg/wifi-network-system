const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

// تسجيل موقع الفني
const logLocation = async (req, res) => {
    try {
        const { lat, lng, heading, speed, battery, signal_dbm, ticket_id } = req.body;
        const userId = req.user.id;

        // التحقق من حالة التتبع
        const userResult = await query(
            'SELECT tracking_enabled, tracking_veto FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return error(res, 'المستخدم غير موجود', 404);
        }

        const user = userResult.rows[0];

        // إذا كان التتبع معطل أو الفني طبّق الفيتو
        if (!user.tracking_enabled || user.tracking_veto) {
            return error(res, 'التتبع غير مفعّل', 403);
        }

        const result = await query(
            'INSERT INTO tracking_logs (user_id, lat, lng, heading, speed, battery, signal_dbm, ticket_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [userId, lat, lng, heading, speed, battery, signal_dbm, ticket_id]
        );

        success(res, result.rows[0], 'تم تسجيل الموقع');
    } catch (err) {
        error(res, err.message, 500);
    }
};

// الحصول على آخر مواقع جميع الفنيين (للدعم والإدارة)
const getLiveLocations = async (req, res) => {
    try {
        const result = await query(`
            SELECT DISTINCT ON (tl.user_id)
                tl.user_id,
                tl.lat,
                tl.lng,
                tl.heading,
                tl.speed,
                tl.battery,
                tl.signal_dbm,
                tl.ticket_id,
                tl.created_at as last_update,
                u.full_name,
                u.tracking_enabled,
                u.tracking_veto
            FROM tracking_logs tl
            JOIN users u ON tl.user_id = u.id
            WHERE u.role = 'technician'
            ORDER BY tl.user_id, tl.created_at DESC
        `);

        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

// الحصول على مسار فني محدد
const getTechnicianPath = async (req, res) => {
    try {
        const { userId } = req.params;
        const { from, to } = req.query;

        let sql = `
            SELECT lat, lng, heading, speed, battery, signal_dbm, created_at
            FROM tracking_logs
            WHERE user_id = $1
        `;
        const params = [userId];

        if (from && to) {
            sql += ' AND created_at BETWEEN $2 AND $3';
            params.push(from, to);
        }

        sql += ' ORDER BY created_at ASC';

        const result = await query(sql, params);
        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

// تسجيل قراءة إشارة (للخريطة الحرارية)
const logSignal = async (req, res) => {
    try {
        const { lat, lng, signal_dbm, ssid, ticket_id } = req.body;

        const result = await query(
            'INSERT INTO signal_readings (user_id, ticket_id, lat, lng, signal_dbm, ssid) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [req.user.id, ticket_id, lat, lng, signal_dbm, ssid]
        );

        success(res, result.rows[0], 'تم تسجيل القراءة');
    } catch (err) {
        error(res, err.message, 500);
    }
};

// الحصول على قراءات الإشارة (للخريطة الحرارية)
const getSignalReadings = async (req, res) => {
    try {
        const { ticket_id, from, to } = req.query;

        let sql = `
            SELECT sr.*, u.full_name as technician_name
            FROM signal_readings sr
            JOIN users u ON sr.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (ticket_id) {
            sql += ` AND sr.ticket_id = $${paramIndex}`;
            params.push(ticket_id);
            paramIndex++;
        }
        if (from && to) {
            sql += ` AND sr.timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(from, to);
        }

        sql += ' ORDER BY sr.timestamp DESC';

        const result = await query(sql, params);
        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { logLocation, getLiveLocations, getTechnicianPath, logSignal, getSignalReadings };
