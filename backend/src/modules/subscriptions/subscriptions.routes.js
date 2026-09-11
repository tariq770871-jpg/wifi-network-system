const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const subs = require('./subscriptions.controller');

router.use(authenticate);

// القراءة: جميع الأدوار المصادقة (الفني يحتاج رؤية اشتراكات عملائه)
router.get('/',
    [
        query('status').optional().isIn(['active', 'expired', 'suspended', 'cancelled']),
        query('plan').optional().isIn(['basic', 'standard', 'premium', 'custom']),
        query('expiring_days').optional().isInt({ min: 1, max: 365 }),
        query('search').optional().isString().trim().isLength({ max: 100 }),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    subs.list
);
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, subs.getById);

// الكتابة: admin + support
router.post('/',
    [
        body('customer_name').trim().notEmpty().withMessage('اسم العميل مطلوب').isLength({ max: 100 }).withMessage('اسم العميل 100 حرف كحد أقصى'),
        body('customer_phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }).withMessage('الهاتف 20 حرف كحد أقصى'),
        body('customer_address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }).withMessage('العنوان 255 حرف كحد أقصى'),
        body('device_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('معرف الجهاز غير صالح'),
        body('plan').optional().isIn(['basic', 'standard', 'premium', 'custom']).withMessage('الخطة غير صالحة'),
        body('monthly_price').optional().isFloat({ min: 0, max: 1000000 }).withMessage('السعر الشهري غير صالح'),
        body('start_date').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ البدء غير صالح'),
        body('end_date').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ الانتهاء غير صالح'),
        body('status').optional().isIn(['active', 'expired', 'suspended', 'cancelled']).withMessage('الحالة غير صالحة'),
        body('notes').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }).withMessage('الملاحظات 1000 حرف كحد أقصى'),
    ],
    validateRequest,
    authorize('admin', 'support'),
    subs.create
);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }),
        body('customer_name').optional().trim().notEmpty().isLength({ max: 100 }),
        body('customer_phone').optional({ values: 'null' }).isString().trim().isLength({ max: 20 }),
        body('customer_address').optional({ values: 'null' }).isString().trim().isLength({ max: 255 }),
        body('device_id').optional({ values: 'null' }).isInt({ min: 1 }),
        body('plan').optional().isIn(['basic', 'standard', 'premium', 'custom']).withMessage('الخطة غير صالحة'),
        body('monthly_price').optional().isFloat({ min: 0, max: 1000000 }).withMessage('السعر الشهري غير صالح'),
        body('start_date').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ البدء غير صالح'),
        body('end_date').optional({ values: 'falsy' }).isISO8601().withMessage('تاريخ الانتهاء غير صالح'),
        body('status').optional().isIn(['active', 'expired', 'suspended', 'cancelled']).withMessage('الحالة غير صالحة'),
        body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }),
    ],
    validateRequest,
    authorize('admin', 'support'),
    subs.update
);
// RENEW: تجديد أشهر — admin/support
router.post('/:id/renew',
    [
        param('id').isInt({ min: 1 }),
        body('months').optional().isInt({ min: 1, max: 24 }).withMessage('عدد أشهر التجديد بين 1 و 24'),
    ],
    validateRequest,
    authorize('admin', 'support'),
    subs.renew
);
// الحذف: admin فقط
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, authorize('admin'), subs.remove);

module.exports = router;
