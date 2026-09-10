const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const devices = require('./devices.controller');

// جميع المسارات تتطلب مصادقة
router.use(authenticate);

// القراءة: admin / support / technician
router.get('/',
    [
        query('status').optional().isIn(['online', 'offline', 'maintenance']),
        query('device_type').optional().isIn(['router', 'switch', 'access_point', 'antenna', 'other']),
        query('coordinate_source').optional().isIn(['gps', 'manual', 'mikrotik']),
        query('search').optional().isString().trim().isLength({ max: 100 }),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    devices.listDevices
);
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, devices.getDevice);
router.get('/:id/status', [param('id').isInt({ min: 1 })], validateRequest, devices.getDeviceStatus);
router.post('/:id/test', [param('id').isInt({ min: 1 })], validateRequest, devices.testDeviceConnection);

// الكتابة: admin فقط
router.post('/',
    [
        body('name').trim().notEmpty().withMessage('اسم الجهاز مطلوب').isLength({ max: 100 }),
        body('device_type').optional().isIn(['router', 'switch', 'access_point', 'antenna', 'other']),
        body('model').optional().isString().trim().isLength({ max: 100 }),
        body('manufacturer').optional().isString().trim().isLength({ max: 100 }),
        body('serial_number').optional().isString().trim().isLength({ max: 100 }),
        body('mac_address').optional({ values: 'falsy' }).matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/).withMessage('عنوان MAC غير صالح — الصيغة AA:BB:CC:DD:EE:FF'),
        body('ip_address').optional({ values: 'falsy' }).isIP().withMessage('عنوان IP غير صالح'),
        body('location_lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }),
        body('location_lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }),
        body('coordinate_source').optional().isIn(['gps', 'manual', 'mikrotik']),
        body('gps_accuracy').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }),
        body('installed_at').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ التركيب غير صالح'),
        body('installed_by').optional({ values: 'falsy' }).isInt({ min: 1 }),
        body('status').optional().isIn(['online', 'offline', 'maintenance']),
        body('is_mikrotik_linked').optional().isBoolean(),
        body('mikrotik_username').optional().isString().trim().isLength({ max: 50 }),
        body('mikrotik_api_port').optional().isInt({ min: 1, max: 65535 }),
        body('mikrotik_password').optional().isString().isLength({ max: 200 }),
        body('notes').optional().isString().trim().isLength({ max: 2000 }),
    ],
    validateRequest,
    authorize('admin'),
    devices.createDevice
);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }),
        body('name').optional().trim().notEmpty().isLength({ max: 100 }),
        body('status').optional().isIn(['online', 'offline', 'maintenance']),
        body('device_type').optional().isIn(['router', 'switch', 'access_point', 'antenna', 'other']),
        body('model').optional().isString().trim().isLength({ max: 100 }),
        body('manufacturer').optional().isString().trim().isLength({ max: 100 }),
        body('serial_number').optional().isString().trim().isLength({ max: 100 }),
        body('mac_address').optional({ values: 'falsy' }).matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/).withMessage('عنوان MAC غير صالح'),
        body('ip_address').optional({ values: 'falsy' }).isIP(),
        body('location_lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }),
        body('location_lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }),
        body('coordinate_source').optional().isIn(['gps', 'manual', 'mikrotik']),
        body('gps_accuracy').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }),
        body('installed_at').optional({ values: 'falsy' }).isISO8601(),
        body('installed_by').optional({ values: 'falsy' }).isInt({ min: 1 }),
        body('is_mikrotik_linked').optional().isBoolean(),
        body('mikrotik_password').optional().isString().isLength({ max: 200 }),
    ],
    validateRequest,
    authorize('admin'),
    devices.updateDevice
);
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, authorize('admin'), devices.deleteDevice);

module.exports = router;
