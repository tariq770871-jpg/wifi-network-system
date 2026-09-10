const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const { getAll, getById, create, review, getMyRequests, delete: deletePoint } = require('./map-points.controller');

router.get('/',
    [
        query('status').optional().isIn(['pending', 'approved', 'rejected']),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    authenticate,
    getAll
);
router.get('/my-requests', authenticate, authorize('technician'), getMyRequests);
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, authenticate, getById);
router.post('/',
    [
        body('name').trim().notEmpty().withMessage('اسم النقطة مطلوب').isLength({ max: 200 }),
        body('note').optional().isString().trim().isLength({ max: 2000 }),
        body('location_lat').isFloat({ min: -90, max: 90 }).withMessage('lat غير صالح'),
        body('location_lng').isFloat({ min: -180, max: 180 }).withMessage('lng غير صالح'),
    ],
    validateRequest,
    authenticate,
    authorize('technician', 'admin', 'support'),
    create
);
router.post('/:id/review',
    [
        param('id').isInt({ min: 1 }),
        body('status').isIn(['approved', 'rejected']).withMessage('قرار المراجعة غير صالح'),
    ],
    validateRequest,
    authenticate,
    authorize('admin', 'support'),
    review
);
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, authenticate, authorize('admin'), deletePoint);

module.exports = router;
