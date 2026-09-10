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
        body('band').optional().isFloat({ min: 2.4, max: 6 }).withMessage('band غير صالح (2.4 / 5 / 6)'),
        body('channel').optional().isInt({ min: 1, max: 196 }),
        body('frequency_mhz').optional().isInt({ min: 2400, max: 7200 }),
        body('security_type').optional().isIn(['open', 'wep', 'wpa', 'wpa2', 'wpa3']),
        body('location_lat').optional().isFloat({ min: -90, max: 90 }),
        body('location_lng').optional().isFloat({ min: -180, max: 180 }),
        body('status').optional().isIn(['active', 'inactive', 'planned']),
        body('notes').optional().isString().trim().isLength({ max: 2000 }),
    ],
    validateRequest,
    authorize('admin', 'support'),
    networks.createNetwork
);
router.put('/:id',
    [
        body('ssid').optional().trim().notEmpty().isLength({ max: 100 }),
        body('status').optional().isIn(['active', 'inactive', 'planned']),
    ],
    validateRequest,
    authorize('admin', 'support'),
    networks.updateNetwork
);
router.delete('/:id', authorize('admin'), networks.deleteNetwork);

module.exports = router;
