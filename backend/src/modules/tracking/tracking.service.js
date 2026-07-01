const { query } = require('../../shared/db');

class TrackingService {
    /**
     * Log a technician's location
     */
    static async logLocation(userId, { lat, lng, heading, speed, battery, signal_dbm, ticket_id }) {
        // Verify tracking is enabled and not vetoed
        const userResult = await query(
            'SELECT tracking_enabled, tracking_veto FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw { statusCode: 404, message: 'المستخدم غير موجود' };
        }

        const user = userResult.rows[0];

        if (!user.tracking_enabled || user.tracking_veto) {
            throw { statusCode: 403, message: 'التتبع غير مفعّل' };
        }

        const result = await query(
            'INSERT INTO tracking_logs (user_id, lat, lng, heading, speed, battery, signal_dbm, ticket_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [userId, lat, lng, heading, speed, battery, signal_dbm, ticket_id]
        );

        return result.rows[0];
    }

    /**
     * Get last known location of all technicians
     */
    static async getLiveLocations() {
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

        return result.rows;
    }

    /**
     * Get technician path history
     */
    static async getTechnicianPath(userId, { from, to } = {}) {
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
        return result.rows;
    }

    /**
     * Log a signal reading (for heatmap)
     */
    static async logSignal(userId, { lat, lng, signal_dbm, ssid, ticket_id }) {
        const result = await query(
            'INSERT INTO signal_readings (user_id, ticket_id, lat, lng, signal_dbm, ssid) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, ticket_id, lat, lng, signal_dbm, ssid]
        );

        return result.rows[0];
    }

    /**
     * Get signal readings with optional filters
     */
    static async getSignalReadings({ ticket_id, from, to } = {}) {
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
        return result.rows;
    }
}

module.exports = TrackingService;
