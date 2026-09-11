const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const ticketsController = require('./tickets.controller');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');

// All routes require authentication
router.use(authenticate);

router.get('/',
    [
        query('status').optional().isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
        query('assigned_to').optional().isInt({ min: 1 }),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    ticketsController.getAll
);
router.get('/:id',
    [param('id').isInt({ min: 1 }).withMessage('معرف غير صالح')],
    validateRequest,
    ticketsController.getById
);
router.post('/',
    [
        body('title').trim().notEmpty().withMessage('عنوان البلاغ مطلوب').isLength({ max: 200 }),
        body('customer_name').trim().notEmpty().withMessage('اسم العميل مطلوب').isLength({ max: 100 }),
        body('customer_phone').optional().isString().trim().isLength({ max: 20 }),
        body('customer_address').optional().isString().trim().isLength({ max: 255 }),
        body('description').optional().isString().trim().isLength({ max: 5000 }),
        body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('أولوية غير صالحة'),
        body('location_lat').optional().isFloat({ min: -90, max: 90 }),
        body('location_lng').optional().isFloat({ min: -180, max: 180 }),
    ],
    validateRequest,
    authorize('admin', 'support'),
    ticketsController.create
);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }),
        body('title').optional().trim().notEmpty().isLength({ max: 200 }),
        body('status').optional().isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
        body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    ],
    validateRequest,
    // SECURITY: كان مفتوحاً لأي فني — يستطيع تعديل أي بلاغ وتغيير حالته وحتى أولويته
    // متجاوزاً مساري start/complete المخصصين. تعديل محتوى البلاغ إدارة، والفني
    // يحدّث حالة عمله عبر /start و /complete فقط.
    authorize('admin', 'support'),
    ticketsController.update
);
router.delete('/:id',
    [param('id').isInt({ min: 1 })],
    validateRequest,
    authorize('admin'),
    ticketsController.delete
);
router.post('/:id/assign',
    [
        param('id').isInt({ min: 1 }),
        body('assigned_to').isInt({ min: 1 }).withMessage('معرف الفني مطلوب'),
    ],
    validateRequest,
    authorize('admin', 'support'),
    ticketsController.assign
);
router.post('/:id/start', [param('id').isInt({ min: 1 })], validateRequest, authorize('technician'), ticketsController.start);
router.post('/:id/complete', [param('id').isInt({ min: 1 })], validateRequest, authorize('technician'), ticketsController.complete);

module.exports = router;
