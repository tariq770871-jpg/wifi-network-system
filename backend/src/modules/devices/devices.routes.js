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
        body('ip_address').optional().isIP().withMessage('عنوان IP غير صالح'),
        body('location_lat').optional().isFloat({ min: -90, max: 90 }),
        body('location_lng').optional().isFloat({ min: -180, max: 180 }),
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
        body('ip_address').optional().isIP(),
        body('is_mikrotik_linked').optional().isBoolean(),
        body('mikrotik_password').optional().isString().isLength({ max: 200 }),
    ],
    validateRequest,
    authorize('admin'),
    devices.updateDevice
);
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, authorize('admin'), devices.deleteDevice);

module.exports = router;
