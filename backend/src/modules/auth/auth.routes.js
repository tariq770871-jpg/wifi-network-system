const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { register, login, logout, me, changePassword, updateProfile } = require('./auth.controller');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');

// SECURITY: التسجيل العام مغلق — إنشاء الحسابات من المدير فقط (صفحة المستخدمين أو POST /users).
// كان التسجيل مكشوفاً لأي زائر فينشئ حساب فني ويدخل ليرى التتبع والأجهزة والتذاكر.
router.post('/register',
    authenticate,
    authorize('admin'),
    [
        body('username').trim().isLength({ min: 3, max: 50 }).withMessage('اسم المستخدم بين 3 و 50 حرف'),
        body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
        body('full_name').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
        body('email').optional().isEmail().withMessage('بريد إلكتروني غير صالح'),
        body('phone').optional().isString().trim(),
        // SECURITY: لا يُقبل role من العميل إطلاقاً — يُفرض technician من الخادم
        body('role').not().exists({ checkFalsy: true }).withMessage('لا يمكن تحديد الدور عند التسجيل - استخدم POST /api/users لاختيار الدور'),
    ],
    validateRequest,
    register
);

router.post('/login',
    [
        body('username').trim().notEmpty().withMessage('اسم المستخدم مطلوب'),
        body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
    ],
    validateRequest,
    login
);

router.post('/logout', logout);

router.get('/me', authenticate, me);
router.put('/password', authenticate, changePassword);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
