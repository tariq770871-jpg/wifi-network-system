const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { register, login, me, changePassword, updateProfile } = require('./auth.controller');
const { authenticate } = require('../../shared/middleware/auth');
const { validateRequest } = require('../../shared/middleware/validate');

router.post('/register',
    [
        body('username').trim().isLength({ min: 3, max: 50 }).withMessage('اسم المستخدم بين 3 و 50 حرف'),
        body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
        body('full_name').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
        body('role').optional().isIn(['admin', 'support', 'technician']).withMessage('دور غير صالح'),
        body('email').optional().isEmail().withMessage('بريد إلكتروني غير صالح'),
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

router.get('/me', authenticate, me);
router.put('/password', authenticate, changePassword);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
