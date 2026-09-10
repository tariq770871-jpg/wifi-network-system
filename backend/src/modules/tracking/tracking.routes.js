const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const { logLocation, getTrackingStatus, getLiveLocations, getTechnicianPath, logSignal, getSignalReadings } = require('./tracking.controller');

// حالة التتبع للمستخدم الحالي (فني/مدير/دعم) — تعرض سبب المنع بدقة قبل بدء البث
router.get('/status', authenticate, getTrackingStatus);
router.post('/log',
    [
        // values: 'null' ضروري — الواجهة ترسل null صراحةً (heading غير متاح على سطح المكتب،
        // بطارية/إشارة غير مقروءة). بدونها: isInt(null) يفشل بـ 400 "Invalid value" ويفشل البث كله
        body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat غير صالح'),
        body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng غير صالح'),
        body('heading').optional({ values: 'null' }).isFloat({ min: 0, max: 360 }).withMessage('heading بين 0 و 360'),
        body('speed').optional({ values: 'null' }).isFloat({ min: 0, max: 300 }).withMessage('speed بين 0 و 300'),
        body('battery').optional({ values: 'null' }).isInt({ min: 0, max: 100 }).withMessage('battery بين 0 و 100'),
        body('signal_dbm').optional({ values: 'null' }).isInt({ min: -100, max: -20 }).withMessage('signal_dbm بين -100 و -20'),
        body('ticket_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('ticket_id غير صالح'),
    ],
    validateRequest,
    authenticate,
    authorize('technician'),
    logLocation
);
router.get('/live', authenticate, authorize('admin', 'support'), getLiveLocations);
router.get('/path/:userId',
    [
        param('userId').isInt({ min: 1 }),
        query('hours').optional().isInt({ min: 1, max: 168 }),
    ],
    validateRequest,
    authenticate,
    authorize('admin', 'support'),
    getTechnicianPath
);
router.post('/signal',
    [
        body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat غير صالح'),
        body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng غير صالح'),
        body('signal_dbm').isInt({ min: -100, max: -20 }).withMessage('signal_dbm بين -100 و -20'),
        body('ssid').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('ssid طويل جداً'),
        body('ticket_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('ticket_id غير صالح'),
    ],
    validateRequest,
    authenticate,
    authorize('technician'),
    logSignal
);
router.get('/signal',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    authenticate,
    getSignalReadings
);

module.exports = router;
