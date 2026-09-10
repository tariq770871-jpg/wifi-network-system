/**
 * Devices Service - طبقة الخدمة لوحدة الأجهزة
 * CRUD على جدول devices + دمج MikroTik
 */
const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');
const mikrotik = require('./mikrotik.service');

/** جلب كل الأجهزة مع ترقيم صفحات وترشيح بالحالة */
async function listDevices(queryParams = {}) {
    const status = queryParams.status;
    const device_type = queryParams.device_type;
    const { page, limit, offset } = parsePagination(queryParams);

    const conditions = [];
    const params = [];

    if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
    }
    if (device_type) {
        params.push(device_type);
        conditions.push(`device_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*)::int AS total FROM devices ${where}`, params);
    const result = await query(
        `SELECT id, name, device_type, ip_address, location_lat, location_lng, status,
                is_mikrotik_linked, mikrotik_username, mikrotik_api_port, last_ssid, last_seen,
                notes, created_at, updated_at
         FROM devices ${where}
         ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );
    return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
}

/** جلب جهاز واحد بالكامل (يشمل كلمة المرور المشفرة للاستخدام الداخلي) */
async function getDeviceRaw(id) {
    const result = await query('SELECT * FROM devices WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/** إنشاء جهاز جديد (مع تشفير كلمة مرور MikroTik إن وُجدت) */
async function createDevice({ name, device_type, ip_address, location_lat, location_lng,
                              is_mikrotik_linked, mikrotik_username, mikrotik_api_port,
                              mikrotik_password, notes, created_by }) {
    const encrypted = is_mikrotik_linked && mikrotik_password
        ? mikrotik.encryptPassword(mikrotik_password)
        : null;

    const result = await query(
        `INSERT INTO devices (name, device_type, ip_address, location_lat, location_lng,
                              is_mikrotik_linked, mikrotik_username, mikrotik_api_port,
                              mikrotik_password_encrypted, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name, device_type || 'router', ip_address || null, location_lat || null, location_lng || null,
         !!is_mikrotik_linked, mikrotik_username || 'monitor', mikrotik_api_port || 8728,
         encrypted, notes || null, created_by || null]
    );
    return sanitize(result.rows[0]);
}

/** تحديث جهاز موجود */
async function updateDevice(id, fields) {
    const allowed = ['name', 'device_type', 'ip_address', 'location_lat', 'location_lng',
                     'status', 'is_mikrotik_linked', 'mikrotik_username', 'mikrotik_api_port', 'notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            params.push(fields[key]);
            sets.push(`${key} = $${params.length}`);
        }
    }
    // كلمة المرور تُعالج بشكل خاص (تشفير)
    if (fields.mikrotik_password) {
        params.push(mikrotik.encryptPassword(fields.mikrotik_password));
        sets.push(`mikrotik_password_encrypted = $${params.length}`);
    }
    if (sets.length === 0) return null;

    params.push(id);
    const result = await query(
        `UPDATE devices SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params
    );
    return result.rows[0] ? sanitize(result.rows[0]) : null;
}

/** حذف جهاز */
async function deleteDevice(id) {
    const result = await query('DELETE FROM devices WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
}

/** تحديث حالة الجهاز وآخر ظهور (يُستخدم بعد فحص MikroTik) */
async function markSeen(id, { ssid, status } = {}) {
    const result = await query(
        `UPDATE devices
         SET last_seen = NOW(),
             last_ssid = COALESCE($2, last_ssid),
             status = COALESCE($3, status),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, last_ssid, status, last_seen`,
        [id, ssid || null, status || null]
    );
    return result.rows[0] || null;
}

/** إخفاء الحقول الحساسة قبل إرجاع الجهاز للعميل */
function sanitize(row) {
    if (!row) return row;
    // eslint-disable-next-line no-unused-vars
    const { mikrotik_password_encrypted, ...safe } = row;
    return safe;
}

/** اختبار اتصال MikroTik لجهاز مخزن */
async function testDeviceConnection(id) {
    const device = await getDeviceRaw(id);
    if (!device) return { notFound: true };
    const result = await mikrotik.testConnection(device);
    if (result.success) {
        await markSeen(id, { ssid: result.ssid, status: 'online' });
    } else {
        await markSeen(id, { status: 'offline' });
    }
    return { device: sanitize(device), ...result };
}

/** قراءة موارد حية من جهاز MikroTik */
async function getDeviceResources(id) {
    const device = await getDeviceRaw(id);
    if (!device) return { notFound: true };
    const resources = await mikrotik.getResources(device);
    const ssid = await mikrotik.getSSID(device);
    if (resources || ssid) {
        await markSeen(id, { ssid, status: 'online' });
    }
    return { device: sanitize(device), resources, ssid };
}

module.exports = {
    listDevices,
    getDeviceRaw,
    createDevice,
    updateDevice,
    deleteDevice,
    markSeen,
    testDeviceConnection,
    getDeviceResources,
    sanitize,
};
