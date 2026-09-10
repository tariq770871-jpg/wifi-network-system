/**
 * Devices Service - طبقة الخدمة لوحدة الأجهزة
 * CRUD على جدول devices + دمج MikroTik
 */
const { query } = require('../../shared/db');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');
const mikrotik = require('./mikrotik.service');

/** جلب كل الأجهزة مع ترقيم صفحات وترشيح (الحالة/النوع/مصدر الإحداثية) وبحث نصي */
async function listDevices(queryParams = {}) {
    const status = queryParams.status;
    const device_type = queryParams.device_type;
    const coordinate_source = queryParams.coordinate_source;
    const search = (queryParams.search || '').trim();
    const { page, limit, offset } = parsePagination(queryParams);

    const conditions = [];
    const params = [];

    if (status) {
        params.push(status);
        conditions.push(`d.status = $${params.length}`);
    }
    if (device_type) {
        params.push(device_type);
        conditions.push(`d.device_type = $${params.length}`);
    }
    if (coordinate_source) {
        params.push(coordinate_source);
        conditions.push(`d.coordinate_source = $${params.length}`);
    }
    // بحث نصي موحّد: الاسم، الموديل، المصنّع، الرقم التسلسلي، MAC، IP
    if (search) {
        params.push(`%${search}%`);
        const p = `$${params.length}`;
        conditions.push(`(d.name ILIKE ${p} OR d.model ILIKE ${p} OR d.manufacturer ILIKE ${p}
                         OR d.serial_number ILIKE ${p} OR d.mac_address ILIKE ${p} OR d.ip_address ILIKE ${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*)::int AS total FROM devices d ${where}`, params);
    const result = await query(
        `SELECT d.id, d.name, d.device_type, d.model, d.manufacturer, d.serial_number, d.mac_address,
                d.ip_address, d.location_lat, d.location_lng, d.coordinate_source, d.gps_accuracy,
                d.installed_at, d.installed_by, installer.full_name AS installed_by_name,
                d.status, d.is_mikrotik_linked, d.mikrotik_username, d.mikrotik_api_port,
                d.last_ssid, d.last_seen, d.notes, d.created_at, d.updated_at
         FROM devices d
         LEFT JOIN users installer ON installer.id = d.installed_by
         ${where}
         ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );
    return { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) };
}

/** جلب جهاز واحد بالتفاصيل الكاملة (يشمل اسم الفني المركّب) */
async function getDevice(id) {
    const result = await query(
        `SELECT d.id, d.name, d.device_type, d.model, d.manufacturer, d.serial_number, d.mac_address,
                d.ip_address, d.location_lat, d.location_lng, d.coordinate_source, d.gps_accuracy,
                d.installed_at, d.installed_by, installer.full_name AS installed_by_name,
                d.status, d.is_mikrotik_linked, d.mikrotik_username, d.mikrotik_api_port,
                d.last_ssid, d.last_seen, d.notes, d.created_at, d.updated_at
         FROM devices d
         LEFT JOIN users installer ON installer.id = d.installed_by
         WHERE d.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

/** جلب جهاز واحد بالكامل (يشمل كلمة المرور المشفرة للاستخدام الداخلي) */
async function getDeviceRaw(id) {
    const result = await query('SELECT * FROM devices WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/** إنشاء جهاز جديد (مع تشفير كلمة مرور MikroTik إن وُجدت) */
async function createDevice({ name, device_type, model, manufacturer, serial_number, mac_address,
                              ip_address, location_lat, location_lng, coordinate_source, gps_accuracy,
                              installed_at, installed_by, status,
                              is_mikrotik_linked, mikrotik_username, mikrotik_api_port,
                              mikrotik_password, notes, created_by }) {
    const encrypted = is_mikrotik_linked && mikrotik_password
        ? mikrotik.encryptPassword(mikrotik_password)
        : null;

    const result = await query(
        `INSERT INTO devices (name, device_type, model, manufacturer, serial_number, mac_address,
                              ip_address, location_lat, location_lng, coordinate_source, gps_accuracy,
                              installed_at, installed_by, status,
                              is_mikrotik_linked, mikrotik_username, mikrotik_api_port,
                              mikrotik_password_encrypted, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [name, device_type || 'router', model || null, manufacturer || null, serial_number || null,
         mac_address ? mac_address.toUpperCase() : null,
         ip_address || null, location_lat ?? null, location_lng ?? null,
         // مصدر الإحداثية يستنتج تلقائياً إن لم يُحدد: GPS عند دقة موثقة، وإلا يدوي
         coordinate_source || (gps_accuracy != null && location_lat != null ? 'gps' : 'manual'),
         gps_accuracy ?? null,
         installed_at || null, installed_by || null,
         status || 'offline',
         !!is_mikrotik_linked, mikrotik_username || 'monitor', mikrotik_api_port || 8728,
         encrypted, notes || null, created_by || null]
    );
    return sanitize(result.rows[0]);
}

/** تحديث جهاز موجود */
async function updateDevice(id, fields) {
    const allowed = ['name', 'device_type', 'model', 'manufacturer', 'serial_number', 'mac_address',
                     'ip_address', 'location_lat', 'location_lng', 'coordinate_source', 'gps_accuracy',
                     'installed_at', 'installed_by', 'status',
                     'is_mikrotik_linked', 'mikrotik_username', 'mikrotik_api_port', 'notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            params.push(key === 'mac_address' && fields[key] ? String(fields[key]).toUpperCase() : fields[key]);
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
    getDevice,
    getDeviceRaw,
    createDevice,
    updateDevice,
    deleteDevice,
    markSeen,
    testDeviceConnection,
    getDeviceResources,
    sanitize,
};
