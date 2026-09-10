const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const { logLocation, getLiveLocations, getTechnicianPath, logSignal, getSignalReadings } = require('./tracking.controller');

router.post('/log',
    [
        body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat غير صالح'),
        body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng غير صالح'),
        body('heading').optional().isFloat({ min: 0, max: 360 }),
        body('speed').optional().isFloat({ min: 0, max: 300 }),
        body('battery').optional().isInt({ min: 0, max: 100 }),
        body('signal_dbm').optional().isInt({ min: -100, max: -20 }),
        body('ticket_id').optional().isInt({ min: 1 }),
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
        body('ssid').optional().isString().trim().isLength({ max: 100 }),
        body('ticket_id').optional().isInt({ min: 1 }),
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
