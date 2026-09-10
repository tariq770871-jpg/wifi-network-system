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
        body('name').trim().notEmpty().withMessage('اسم الجهاز مطلوب').isLength({ max: 100 }).withMessage('اسم الجهاز طويل جداً (الحد 100)'),
        body('device_type').optional().isIn(['router', 'switch', 'access_point', 'antenna', 'other']).withMessage('نوع الجهاز غير صالح'),
        body('model').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('الموديل طويل جداً'),
        body('manufacturer').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('اسم المصنّع طويل جداً'),
        body('serial_number').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('الرقم التسلسلي طويل جداً'),
        body('mac_address').optional({ values: 'falsy' }).matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/).withMessage('عنوان MAC غير صالح — الصيغة AA:BB:CC:DD:EE:FF'),
        body('ip_address').optional({ values: 'falsy' }).isIP().withMessage('عنوان IP غير صالح'),
        body('location_lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('خط العرض بين -90 و 90'),
        body('location_lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('خط الطول بين -180 و 180'),
        // values: 'null' — النموذج يرسل null عند عدم اختيار موقع، بدونها isIn(null) يعطي "Invalid value"
        body('coordinate_source').optional({ values: 'null' }).isIn(['gps', 'manual', 'mikrotik']).withMessage('مصدر الإحداثية غير صالح (gps/manual/mikrotik)'),
        body('gps_accuracy').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }).withMessage('دقة GPS غير صالحة'),
        body('installed_at').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ التركيب غير صالح'),
        body('installed_by').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('معرّف الفني غير صالح'),
        body('status').optional().isIn(['online', 'offline', 'maintenance']).withMessage('الحالة غير صالحة'),
        body('is_mikrotik_linked').optional().isBoolean().withMessage('قيمة ربط MikroTik يجب أن تكون true أو false'),
        body('mikrotik_username').optional({ values: 'falsy' }).isString().trim().isLength({ max: 50 }).withMessage('مستخدم MikroTik طويل جداً'),
        body('mikrotik_api_port').optional({ values: 'null' }).isInt({ min: 1, max: 65535 }).withMessage('منفذ MikroTik بين 1 و 65535'),
        body('mikrotik_password').optional({ values: 'falsy' }).isString().isLength({ max: 200 }).withMessage('كلمة المرور طويلة جداً'),
        body('notes').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }).withMessage('الملاحظات طويلة جداً (الحد 2000)'),
    ],
    validateRequest,
    authorize('admin'),
    devices.createDevice
);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }),
        body('name').optional().trim().notEmpty().withMessage('اسم الجهاز لا يمكن أن يكون فارغاً').isLength({ max: 100 }).withMessage('اسم الجهاز طويل جداً'),
        body('status').optional().isIn(['online', 'offline', 'maintenance']).withMessage('الحالة غير صالحة'),
        body('device_type').optional().isIn(['router', 'switch', 'access_point', 'antenna', 'other']).withMessage('نوع الجهاز غير صالح'),
        body('model').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('الموديل طويل جداً'),
        body('manufacturer').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('اسم المصنّع طويل جداً'),
        body('serial_number').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('الرقم التسلسلي طويل جداً'),
        body('mac_address').optional({ values: 'falsy' }).matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/).withMessage('عنوان MAC غير صالح'),
        body('ip_address').optional({ values: 'falsy' }).isIP().withMessage('عنوان IP غير صالح'),
        body('location_lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('خط العرض بين -90 و 90'),
        body('location_lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('خط الطول بين -180 و 180'),
        // values: 'null' — "إزالة الموقع" في النموذج ترسل null لتفريغ الحقول عمداً
        body('coordinate_source').optional({ values: 'null' }).isIn(['gps', 'manual', 'mikrotik']).withMessage('مصدر الإحداثية غير صالح'),
        body('gps_accuracy').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }).withMessage('دقة GPS غير صالحة'),
        body('installed_at').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ التركيب غير صالح'),
        body('installed_by').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('معرّف الفني غير صالح'),
        body('is_mikrotik_linked').optional().isBoolean().withMessage('قيمة ربط MikroTik يجب أن تكون true أو false'),
        body('mikrotik_password').optional({ values: 'falsy' }).isString().isLength({ max: 200 }).withMessage('كلمة المرور طويلة جداً'),
    ],
    validateRequest,
    authorize('admin'),
    devices.updateDevice
);
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, authorize('admin'), devices.deleteDevice);

module.exports = router;
