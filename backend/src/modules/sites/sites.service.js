/**
 * Sites Service — الشبكات/المواقع (مجموعات العمل)
 * ------------------------------------------------
 * كل "شبكة" عند العميل = موقع تشغيل مستقل (حي/قرية/منطقة) له راوتراته
 * وبلاغاته؛ الفريق الفني واحد يخدم جميع الشبكات.
 * جدول sites + ربط tickets.site_id و devices.site_id
 *
 * NOTE: جدول networks الموجود مسبقاً مخصص للـ SSIDs التقنية
 * (band/channel/frequency) وليس له علاقة بهذا المفهوم.
 */
const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

/** قائمة الشبكات مع عدد البلاغات والأجهزة المرتبطة بكل شبكة */
async function listSites(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const conditions = [];
    const params = [];

    // افتراضياً: الشبكات النشطة فقط — الصفحة الإدارية ترسل include_inactive=true
    if (queryParams.is_active === 'false') {
        conditions.push('s.is_active = false');
    } else if (queryParams.include_inactive === 'true') {
        // بدون شرط — الكل
    } else {
        conditions.push('s.is_active = true');
    }
    if (queryParams.search) {
        params.push(`%${String(queryParams.search).trim()}%`);
        const p = `$${params.length}`;
        conditions.push(`(s.name ILIKE ${p} OR s.location ILIKE ${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*)::int AS total FROM sites s ${where}`, params);
    const result = await query(
        `SELECT s.*,
                u.full_name AS created_by_username,
                (SELECT COUNT(*)::int FROM tickets t WHERE t.site_id = s.id) AS tickets_count,
                (SELECT COUNT(*)::int FROM devices d WHERE d.site_id = s.id) AS devices_count
         FROM sites s
         LEFT JOIN users u ON u.id = s.created_by
         ${where}
         ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );
    return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
}

/** جلب شبكة واحدة */
async function getSite(id) {
    const result = await query(
        `SELECT s.*, u.full_name AS created_by_username,
                (SELECT COUNT(*)::int FROM tickets t WHERE t.site_id = s.id) AS tickets_count,
                (SELECT COUNT(*)::int FROM devices d WHERE d.site_id = s.id) AS devices_count
         FROM sites s
         LEFT JOIN users u ON u.id = s.created_by
         WHERE s.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

/** إنشاء شبكة */
async function createSite({ name, location, notes, is_active }, userId) {
    const result = await query(
        `INSERT INTO sites (name, location, notes, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, location || null, notes || null, is_active === undefined ? true : !!is_active, userId]
    );
    return result.rows[0];
}

/** تحديث شبكة */
async function updateSite(id, fields) {
    const allowed = ['name', 'location', 'notes', 'is_active'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            params.push(key === 'is_active' ? !!fields[key] : fields[key]);
            sets.push(`${key} = $${params.length}`);
        }
    }
    if (sets.length === 0) return null;

    params.push(id);
    const result = await query(
        `UPDATE sites SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params
    );
    return result.rows[0] || null;
}

/**
 * حذف شبكة — محمي: إذا كانت الشبكة مرتبطة ببلاغات أو أجهزة يُرفض الحذف (409)
 * حتى لا تتشتت البيانات؛ المدير يعيد ربط العناصر بشبكة أخرى أولاً.
 */
async function deleteSite(id) {
    const used = await query(
        `SELECT
            (SELECT COUNT(*)::int FROM tickets t WHERE t.site_id = $1) AS tickets,
            (SELECT COUNT(*)::int FROM devices d WHERE d.site_id = $1) AS devices`,
        [id]
    );
    const { tickets, devices } = used.rows[0];
    if (tickets > 0 || devices > 0) {
        const err = new Error(`لا يمكن حذف الشبكة — بها ${tickets} بلاغ و${devices} جهاز مرتبط. أعد ربط العناصر بشبكة أخرى أولاً`);
        err.statusCode = 409;
        err.code = 'SITE_IN_USE';
        throw err;
    }
    const result = await query('DELETE FROM sites WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
}

module.exports = { listSites, getSite, createSite, updateSite, deleteSite };
