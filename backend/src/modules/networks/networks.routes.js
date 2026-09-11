const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const networks = require('./networks.controller');

router.use(authenticate);

// القراءة: جميع الأدوار
router.get('/',
    [
        query('band').optional().isIn(['2.4', '5', '6', 2.4, 5, 6]).withMessage('band غير صالح'),
        query('status').optional().isIn(['active', 'inactive', 'planned']).withMessage('status غير صالح'),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    networks.listNetworks
);
router.get('/:id', networks.getNetwork);

// الكتابة: admin + support
router.post('/',
    [
        body('ssid').trim().notEmpty().withMessage('اسم الشبكة SSID مطلوب').isLength({ max: 100 }),
        // values: 'null' — الواجهة ترسل null للحقول الفارغة (نفس علّة Invalid value المصلحة
        // في tracking/devices — بدونها isFloat(null) يفشل بـ 400 وكل إنشاء شبكة من الواجهة معطّل)
        body('band').optional({ values: 'null' }).isFloat({ min: 2.4, max: 6 }).withMessage('band غير صالح (2.4 / 5 / 6)'),
        body('channel').optional({ values: 'null' }).isInt({ min: 1, max: 196 }).withMessage('القناة بين 1 و 196'),
        body('frequency_mhz').optional({ values: 'null' }).isInt({ min: 2400, max: 7200 }).withMessage('التردد بين 2400 و 7200 ميغاهرتز'),
        body('security_type').optional({ values: 'null' }).isIn(['open', 'wep', 'wpa', 'wpa2', 'wpa3']).withMessage('نوع التشفير غير صالح'),
        body('location_lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('خط العرض بين -90 و 90'),
        body('location_lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('خط الطول بين -180 و 180'),
        body('status').optional({ values: 'null' }).isIn(['active', 'inactive', 'planned']).withMessage('الحالة غير صالحة'),
        body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }).withMessage('الملاحظات طويلة جداً'),
    ],
    validateRequest,
    authorize('admin', 'support'),
    networks.createNetwork
);
router.put('/:id',
    [
        body('ssid').optional().trim().notEmpty().isLength({ max: 100 }),
        body('status').optional({ values: 'null' }).isIn(['active', 'inactive', 'planned']).withMessage('الحالة غير صالحة'),
        body('band').optional({ values: 'null' }).isFloat({ min: 2.4, max: 6 }).withMessage('band غير صالح (2.4 / 5 / 6)'),
        body('channel').optional({ values: 'null' }).isInt({ min: 1, max: 196 }).withMessage('القناة بين 1 و 196'),
        body('frequency_mhz').optional({ values: 'null' }).isInt({ min: 2400, max: 7200 }).withMessage('التردد بين 2400 و 7200 ميغاهرتز'),
        body('security_type').optional({ values: 'null' }).isIn(['open', 'wep', 'wpa', 'wpa2', 'wpa3']).withMessage('نوع التشفير غير صالح'),
        body('location_lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('خط العرض بين -90 و 90'),
        body('location_lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('خط الطول بين -180 و 180'),
        body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }).withMessage('الملاحظات طويلة جداً'),
    ],
    validateRequest,
    authorize('admin', 'support'),
    networks.updateNetwork
);
router.delete('/:id', authorize('admin'), networks.deleteNetwork);

module.exports = router;
