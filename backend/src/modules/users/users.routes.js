const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const { getAll, getById, update, controlTracking, vetoTracking } = require('./users.controller');

router.get('/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    authenticate,
    authorize('admin', 'support'),
    getAll
);
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, authenticate, getById);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }),
        body('full_name').optional().trim().notEmpty().isLength({ max: 100 }),
        body('phone').optional().isString().trim().isLength({ max: 20 }),
        body('email').optional().isEmail(),
        body('role').optional().isIn(['admin', 'support', 'technician']),
        body('is_active').optional().isBoolean(),
    ],
    validateRequest,
    authenticate,
    authorize('admin'),
    update
);
router.post('/:id/tracking',
    [
        param('id').isInt({ min: 1 }),
        body('tracking_enabled').optional().isBoolean(),
        body('tracking_veto').optional().isBoolean(),
    ],
    validateRequest,
    authenticate,
    authorize('admin'),
    controlTracking
);
router.post('/me/veto',
    [body('veto').isBoolean().withMessage('قيمة veto مطلوبة (true/false)')],
    validateRequest,
    authenticate,
    authorize('technician'),
    vetoTracking
);

module.exports = router;
