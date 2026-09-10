/**
 * Networks Service - إدارة شبكات WiFi المكتشفة/المدارة
 * ------------------------------------------------------
 * CRUD كامل على جدول networks
 */
const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

/** قائمة الشبكات (مرقّمة + ترشيح) */
async function listNetworks(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const conditions = [];
    const params = [];

    if (queryParams.band) {
        params.push(Number(queryParams.band));
        conditions.push(`band = $${params.length}`);
    }
    if (queryParams.status) {
        params.push(queryParams.status);
        conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*)::int AS total FROM networks ${where}`, params);
    const result = await query(
        `SELECT n.*, u.username AS created_by_username
         FROM networks n
         LEFT JOIN users u ON n.created_by = u.id
         ${where}
         ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );
    return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
}

/** جلب شبكة واحدة */
async function getNetwork(id) {
    const result = await query('SELECT * FROM networks WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/** إنشاء شبكة */
async function createNetwork({ ssid, band, channel, frequency_mhz, security_type,
                               location_lat, location_lng, status, notes }, userId) {
    const result = await query(
        `INSERT INTO networks (ssid, band, channel, frequency_mhz, security_type,
                               location_lat, location_lng, status, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [ssid, band || 2.4, channel || null, frequency_mhz || null,
         security_type || 'wpa2', location_lat || null, location_lng || null,
         status || 'active', notes || null, userId]
    );
    return result.rows[0];
}

/** تحديث شبكة */
async function updateNetwork(id, fields) {
    const allowed = ['ssid', 'band', 'channel', 'frequency_mhz', 'security_type',
                     'location_lat', 'location_lng', 'status', 'notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            params.push(fields[key]);
            sets.push(`${key} = $${params.length}`);
        }
    }
    if (sets.length === 0) return null;

    params.push(id);
    const result = await query(
        `UPDATE networks SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params
    );
    return result.rows[0] || null;
}

/** حذف شبكة */
async function deleteNetwork(id) {
    const result = await query('DELETE FROM networks WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
}

module.exports = { listNetworks, getNetwork, createNetwork, updateNetwork, deleteNetwork };
