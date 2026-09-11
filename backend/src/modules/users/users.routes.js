const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const { getAll, getById, update, controlTracking, vetoTracking, create, remove, resetPassword } = require('./users.controller');

router.get('/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('search').optional().isString().trim().isLength({ max: 100 }),
    ],
    validateRequest,
    authenticate,
    authorize('admin', 'support'),
    getAll
);
router.post('/',
    [
        body('username').trim().isLength({ min: 3, max: 50 }).withMessage('اسم المستخدم بين 3 و 50 حرف'),
        body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
        body('full_name').trim().notEmpty().withMessage('الاسم الكامل مطلوب').isLength({ max: 100 }).withMessage('الاسم الكامل 100 حرف كحد أقصى'),
        body('role').optional().isIn(['admin', 'support', 'technician']).withMessage('الدور يجب أن يكون admin أو support أو technician'),
        body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }).withMessage('الهاتف 20 حرف كحد أقصى'),
        body('email').optional({ values: 'falsy' }).isEmail().withMessage('بريد إلكتروني غير صالح'),
    ],
    validateRequest,
    authenticate,
    authorize('admin'),
    create
);
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, authenticate, getById);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }),
        body('full_name').optional().trim().notEmpty().isLength({ max: 100 }),
        body('phone').optional({ values: 'null' }).isString().trim().isLength({ max: 20 }),
        body('email').optional({ values: 'null' }).isEmail(),
        body('role').optional().isIn(['admin', 'support', 'technician']),
        body('is_active').optional().isBoolean(),
    ],
    validateRequest,
    authenticate,
    authorize('admin'),
    update
);
router.delete('/:id',
    [param('id').isInt({ min: 1 })],
    validateRequest,
    authenticate,
    authorize('admin'),
    remove
);
router.put('/:id/password',
    [
        param('id').isInt({ min: 1 }),
        body('new_password').isLength({ min: 6 }).withMessage('كلمة المرور الجديدة 6 أحرف على الأقل'),
    ],
    validateRequest,
    authenticate,
    authorize('admin'),
    resetPassword
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
