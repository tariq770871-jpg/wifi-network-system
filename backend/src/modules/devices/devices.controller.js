/**
 * Devices Controller - وحدة الأجهزة مع دمج MikroTik
 */
const { success, error, respondError } = require('../../shared/utils/response');
const devicesService = require('./devices.service');

const DEVICE_TYPES = ['router', 'switch', 'access_point', 'antenna', 'other'];
const DEVICE_STATUSES = ['online', 'offline', 'maintenance'];
const COORDINATE_SOURCES = ['gps', 'manual', 'mikrotik'];
// MAC: تنسيقات Accepted: AA:BB:CC:DD:EE:FF أو AA-BB-CC-DD-EE-FF
const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

/** GET /api/devices (paginated: ?page=1&limit=20&status=&device_type=&coordinate_source=&search=) */
const listDevices = async (req, res) => {
    try {
        const { status, device_type, coordinate_source } = req.query;
        if (status && !DEVICE_STATUSES.includes(status)) {
            return error(res, req.t('DEVICE_STATUS_INVALID'), 400);
        }
        if (device_type && !DEVICE_TYPES.includes(device_type)) {
            return error(res, req.t('DEVICE_TYPE_INVALID'), 400);
        }
        if (coordinate_source && !COORDINATE_SOURCES.includes(coordinate_source)) {
            return error(res, 'مصدر الإحداثية غير صالح (gps/manual/mikrotik)', 400);
        }
        if (req.query.search && String(req.query.search).length > 100) {
            return error(res, 'نص البحث طويل جداً (الحد 100 حرف)', 400);
        }
        const devices = await devicesService.listDevices(req.query);
        success(res, devices, req.t('DEVICES_FETCHED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/devices/:id */
const getDevice = async (req, res) => {
    try {
        const device = await devicesService.getDevice(req.params.id);
        if (!device) return error(res, req.t('NOT_FOUND'), 404);
        success(res, device, 'تم جلب الجهاز بنجاح');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** تحقق مشترك من حقول بيانات الجهاز الموسعة — يُرجع رسالة الخطأ أو null */
function validateDeviceFields({ mac_address, coordinate_source, gps_accuracy, installed_at, installed_by, location_lat, location_lng }) {
    if (mac_address !== undefined && mac_address !== null && mac_address !== '' && !MAC_RE.test(mac_address)) {
        return 'عنوان MAC غير صالح — الصيغة المطلوبة AA:BB:CC:DD:EE:FF';
    }
    if (coordinate_source !== undefined && coordinate_source !== null && !COORDINATE_SOURCES.includes(coordinate_source)) {
        return 'مصدر الإحداثية غير صالح (gps/manual/mikrotik)';
    }
    if (gps_accuracy !== undefined && gps_accuracy !== null && (!Number.isFinite(Number(gps_accuracy)) || Number(gps_accuracy) < 0 || Number(gps_accuracy) > 100000)) {
        return 'دقة GPS غير صالحة (بال أمتتر، 0 - 100000)';
    }
    if (installed_at !== undefined && installed_at !== null && installed_at !== '' && Number.isNaN(Date.parse(installed_at))) {
        return 'تاريخ التركيب غير صالح';
    }
    if (installed_by !== undefined && installed_by !== null && installed_by !== '' && !Number.isInteger(Number(installed_by))) {
        return 'معرّف الفني المركّب غير صالح';
    }
    if (location_lat !== undefined && location_lat !== null && (Number(location_lat) < -90 || Number(location_lat) > 90)) {
        return 'خط العرض خارج النطاق المسموح (-90 إلى 90)';
    }
    if (location_lng !== undefined && location_lng !== null && (Number(location_lng) < -180 || Number(location_lng) > 180)) {
        return 'خط الطول خارج النطاق المسموح (-180 إلى 180)';
    }
    return null;
}

/** POST /api/devices */
const createDevice = async (req, res) => {
    try {
        const { name, device_type, model, manufacturer, serial_number, mac_address,
                ip_address, location_lat, location_lng, coordinate_source, gps_accuracy,
                installed_at, installed_by, status,
                is_mikrotik_linked, mikrotik_username, mikrotik_api_port,
                mikrotik_password, notes } = req.body;

        if (!name || !String(name).trim()) {
            return error(res, req.t('DEVICE_NAME_REQUIRED'), 400);
        }
        if (device_type && !DEVICE_TYPES.includes(device_type)) {
            return error(res, req.t('DEVICE_TYPE_INVALID'), 400);
        }
        if (status && !DEVICE_STATUSES.includes(status)) {
            return error(res, req.t('DEVICE_STATUS_INVALID'), 400);
        }
        if (is_mikrotik_linked && !ip_address) {
            return error(res, req.t('DEVICE_IP_REQUIRED_FOR_MIKROTIK'), 400);
        }
        const fieldError = validateDeviceFields({ mac_address, coordinate_source, gps_accuracy, installed_at, installed_by, location_lat, location_lng });
        if (fieldError) return error(res, fieldError, 400);

        const device = await devicesService.createDevice({
            name: String(name).trim(),
            device_type,
            model: model ? String(model).trim() : null,
            manufacturer: manufacturer ? String(manufacturer).trim() : null,
            serial_number: serial_number ? String(serial_number).trim() : null,
            mac_address: mac_address ? String(mac_address).trim() : null,
            ip_address,
            location_lat: location_lat ?? null,
            location_lng: location_lng ?? null,
            coordinate_source,
            gps_accuracy: gps_accuracy ?? null,
            installed_at: installed_at || null,
            installed_by: installed_by || req.user.id,
            status,
            is_mikrotik_linked,
            mikrotik_username,
            mikrotik_api_port,
            mikrotik_password,
            notes,
            created_by: req.user.id,
        });
        success(res, device, req.t('DEVICE_CREATED'), 201);
    } catch (err) {
        respondError(req, res, err);
    }
};

/** PUT /api/devices/:id */
const updateDevice = async (req, res) => {
    try {
        const fields = req.body;
        if (fields.name !== undefined && !String(fields.name).trim()) {
            return error(res, req.t('DEVICE_NAME_EMPTY'), 400);
        }
        if (fields.device_type && !DEVICE_TYPES.includes(fields.device_type)) {
            return error(res, req.t('DEVICE_TYPE_INVALID'), 400);
        }
        if (fields.status && !DEVICE_STATUSES.includes(fields.status)) {
            return error(res, req.t('DEVICE_STATUS_INVALID'), 400);
        }
        const fieldError = validateDeviceFields(fields);
        if (fieldError) return error(res, fieldError, 400);
        const device = await devicesService.updateDevice(req.params.id, fields);
        if (!device) return error(res, req.t('NOT_FOUND'), 404);
        success(res, device, req.t('DEVICE_UPDATED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** DELETE /api/devices/:id */
const deleteDevice = async (req, res) => {
    try {
        const deleted = await devicesService.deleteDevice(req.params.id);
        if (!deleted) return error(res, req.t('NOT_FOUND'), 404);
        success(res, deleted, 'تم حذف الجهاز بنجاح');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** POST /api/devices/:id/test - اختبار اتصال MikroTik */
const testDeviceConnection = async (req, res) => {
    try {
        const result = await devicesService.testDeviceConnection(req.params.id);
        if (result.notFound) return error(res, req.t('NOT_FOUND'), 404);
        success(res, result, result.success ? 'الاتصال بجهاز MikroTik ناجح' : 'فشل الاتصال بجهاز MikroTik');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/devices/:id/status - قراءة الموارد الحية */
const getDeviceStatus = async (req, res) => {
    try {
        const result = await devicesService.getDeviceResources(req.params.id);
        if (result.notFound) return error(res, req.t('NOT_FOUND'), 404);
        success(res, result, 'تم جلب حالة الجهاز');
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = {
    listDevices,
    getDevice,
    createDevice,
    updateDevice,
    deleteDevice,
    testDeviceConnection,
    getDeviceStatus,
};
