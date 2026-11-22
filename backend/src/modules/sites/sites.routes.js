const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');
const sites = require('./sites.controller');

router.use(authenticate);

// القراءة: جميع الأدوار — مبدّل الشبكات ونماذج البلاغات/الأجهزة تحتاج القائمة
router.get('/',
    [
        query('include_inactive').optional().isIn(['true', 'false']),
        query('search').optional().isString().trim().isLength({ max: 100 }),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    sites.listSites
);
router.get('/:id',
    [param('id').isInt({ min: 1 }).withMessage('معرف غير صالح')],
    validateRequest,
    sites.getSite
);

// الكتابة: المدير فقط (نفس سياسة الأجهزة والمستخدمين)
router.post('/',
    [
        body('name').trim().notEmpty().withMessage('اسم الشبكة مطلوب').isLength({ max: 120 }).withMessage('اسم الشبكة طويل جداً (الحد 120)'),
        body('location').optional({ values: 'null' }).isString().trim().isLength({ max: 200 }).withMessage('الموقع طويل جداً (الحد 200)'),
        body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }).withMessage('الملاحظات طويلة جداً'),
        body('is_active').optional().isBoolean().withMessage('الحالة يجب أن تكون منطقية'),
    ],
    validateRequest,
    authorize('admin'),
    sites.createSite
);
router.put('/:id',
    [
        param('id').isInt({ min: 1 }).withMessage('معرف غير صالح'),
        body('name').optional().trim().notEmpty().isLength({ max: 120 }),
        body('location').optional({ values: 'null' }).isString().trim().isLength({ max: 200 }),
        body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }),
        body('is_active').optional().isBoolean().withMessage('الحالة يجب أن تكون منطقية'),
    ],
    validateRequest,
    authorize('admin'),
    sites.updateSite
);
router.delete('/:id',
    [param('id').isInt({ min: 1 }).withMessage('معرف غير صالح')],
    validateRequest,
    authorize('admin'),
    sites.deleteSite
);

module.exports = router;
