const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticate } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const signal = require('./signal.controller');

router.use(authenticate);

// تسجيل قراءة جديدة (جميع الأدوار الميدانية)
router.post('/readings',
    [
        body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat يجب أن يكون بين -90 و 90'),
        body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng يجب أن يكون بين -180 و 180'),
        body('signal_dbm').isInt({ min: -100, max: -20 }).withMessage('signal_dbm بين -100 و -20'),
        body('ssid').optional().isString().trim().isLength({ max: 100 }),
        body('ticket_id').optional().isInt(),
    ],
    validateRequest,
    signal.recordReading
);

// الخريطة الحرارية
router.get('/heatmap',
    [
        query('min_lat').optional().isFloat({ min: -90, max: 90 }),
        query('max_lat').optional().isFloat({ min: -90, max: 90 }),
        query('min_lng').optional().isFloat({ min: -180, max: 180 }),
        query('max_lng').optional().isFloat({ min: -180, max: 180 }),
        query('grid_size').optional().isFloat({ min: 0.0001, max: 1 }),
    ],
    validateRequest,
    signal.getHeatmap
);

// قائمة القراءات (مرقّمة)
router.get('/readings', signal.listReadings);

// إحصائيات التغطية
router.get('/coverage', signal.getCoverageStats);

module.exports = router;
