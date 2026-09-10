/**
 * Devices Controller - وحدة الأجهزة مع دمج MikroTik
 */
const { success, error, respondError } = require('../../shared/utils/response');
const devicesService = require('./devices.service');

const DEVICE_TYPES = ['router', 'switch', 'access_point', 'antenna', 'other'];
const DEVICE_STATUSES = ['online', 'offline', 'maintenance'];

/** GET /api/devices (paginated: ?page=1&limit=20&status=&device_type=) */
const listDevices = async (req, res) => {
    try {
        const { status, device_type } = req.query;
        if (status && !DEVICE_STATUSES.includes(status)) {
            return error(res, req.t('DEVICE_STATUS_INVALID'), 400);
        }
        if (device_type && !DEVICE_TYPES.includes(device_type)) {
            return error(res, req.t('DEVICE_TYPE_INVALID'), 400);
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
        const device = await devicesService.getDeviceRaw(req.params.id);
        if (!device) return error(res, req.t('NOT_FOUND'), 404);
        success(res, devicesService.sanitize(device), 'تم جلب الجهاز بنجاح');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** POST /api/devices */
const createDevice = async (req, res) => {
    try {
        const { name, device_type, ip_address, location_lat, location_lng,
                is_mikrotik_linked, mikrotik_username, mikrotik_api_port,
                mikrotik_password, notes } = req.body;

        if (!name || !String(name).trim()) {
            return error(res, req.t('DEVICE_NAME_REQUIRED'), 400);
        }
        if (device_type && !DEVICE_TYPES.includes(device_type)) {
            return error(res, req.t('DEVICE_TYPE_INVALID'), 400);
        }
        if (is_mikrotik_linked && !ip_address) {
            return error(res, req.t('DEVICE_IP_REQUIRED_FOR_MIKROTIK'), 400);
        }

        const device = await devicesService.createDevice({
            name: String(name).trim(),
            device_type,
            ip_address,
            location_lat,
            location_lng,
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
