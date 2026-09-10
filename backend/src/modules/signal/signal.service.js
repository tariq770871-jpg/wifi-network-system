/**
 * Signal Service - قراءات إشارة WiFi والخريطة الحرارية
 * ------------------------------------------------------
 * - تسجيل قراءات dBm من الفنيين الميدانيين
 * - تجميع شبكي (grid) لبناء الخريطة الحرارية
 */
const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

/** تسجيل قراءة إشارة جديدة */
async function recordReading({ lat, lng, signal_dbm, ssid, ticket_id }, userId) {
    const result = await query(
        `INSERT INTO signal_readings (user_id, ticket_id, lat, lng, signal_dbm, ssid)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, ticket_id || null, lat, lng, signal_dbm, ssid || null]
    );
    return result.rows[0];
}

/**
 * بيانات الخريطة الحرارية: تجميع القراءات في خلايا شبكية
 * @param {object} opts - { min_lat, max_lat, min_lng, max_lng, grid_size }
 * grid_size بالدرجات (افتراضي 0.001 ≈ 100م)
 */
async function getHeatmap({ min_lat, max_lat, min_lng, max_lng, grid_size } = {}) {
    const grid = Number(grid_size) > 0 ? Number(grid_size) : 0.001;
    const params = [grid];
    let where = '';

    if ([min_lat, max_lat, min_lng, max_lng].every((v) => v !== undefined && v !== null && v !== '')) {
        params.push(Number(min_lat), Number(max_lat), Number(min_lng), Number(max_lng));
        where = `WHERE lat BETWEEN $2 AND $3 AND lng BETWEEN $4 AND $5`;
    }

    const result = await query(
        `SELECT
            ROUND((lat / $1)) * $1 AS cell_lat,
            ROUND((lng / $1)) * $1 AS cell_lng,
            ROUND(AVG(signal_dbm)::numeric, 1) AS avg_dbm,
            MIN(signal_dbm) AS min_dbm,
            MAX(signal_dbm) AS max_dbm,
            COUNT(*)::int AS readings
         FROM signal_readings
         ${where}
         GROUP BY cell_lat, cell_lng
         ORDER BY readings DESC
         LIMIT 5000`,
        params
    );
    return result.rows;
}

/** قائمة القراءات الأخيرة (مرقّمة) */
async function listReadings(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const countResult = await query('SELECT COUNT(*)::int AS total FROM signal_readings');
    const result = await query(
        `SELECT sr.*, u.username AS recorded_by_username
         FROM signal_readings sr
         LEFT JOIN users u ON sr.user_id = u.id
         ORDER BY sr.timestamp DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
}

/** إحصائيات سريعة لجودة التغطية */
async function getCoverageStats() {
    const result = await query(
        `SELECT
            COUNT(*)::int AS total_readings,
            ROUND(AVG(signal_dbm)::numeric, 1) AS avg_dbm,
            COUNT(DISTINCT ssid)::int AS distinct_ssids,
            COUNT(CASE WHEN signal_dbm > -60 THEN 1 END)::int AS strong_count,
            COUNT(CASE WHEN signal_dbm BETWEEN -70 AND -60 THEN 1 END)::int AS fair_count,
            COUNT(CASE WHEN signal_dbm < -70 THEN 1 END)::int AS weak_count
         FROM signal_readings`
    );
    return result.rows[0];
}

module.exports = { recordReading, getHeatmap, listReadings, getCoverageStats };
