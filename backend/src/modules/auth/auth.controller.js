const AuthService = require('./auth.service');
const { success, respondError } = require('../../shared/utils/response');
const config = require('../../shared/config');

// خصائص كوكي الجلسة الآمن — HttpOnly (لا يقرأه JavaScript = محصن ضد سرقة XSS)
// SameSite: على Vercel الويب والـ API نطاقان مختلفان (cross-site) → الإنتاج يحتاج
// None+Secure حتى يُرفق الكوكي مع الطلبات عبر النطاق. التطوير (vite proxy نفس
// الأصل) يستخدم Lax. يمكن تجاوزه بـ AUTH_COOKIE_SAMESITE.
const AUTH_COOKIE = 'token';
const sameSite = (process.env.AUTH_COOKIE_SAMESITE || (config.env === 'production' ? 'none' : 'lax')).toLowerCase();
const cookieBase = {
    httpOnly: true,
    secure: config.env === 'production' || sameSite === 'none',
    sameSite: sameSite === 'none' ? 'none' : sameSite,
    path: '/',
};
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: تسجيل مستخدم جديد
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, full_name]
 *             properties:
 *               username: { type: string, example: technician1 }
 *               password: { type: string, example: pass123 }
 *               full_name: { type: string, example: أحمد محمد }
 *               role: { type: string, enum: [admin, support, technician], default: technician }
 *               phone: { type: string }
 *               email: { type: string }
 *     responses:
 *       201: { description: تم إنشاء الحساب, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       409: { description: اسم المستخدم موجود, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
const register = async (req, res) => {
    try {
        const user = await AuthService.register(req.body);
        success(res, user, req.t('REGISTERED'), 201);
    } catch (err) {
        respondError(req, res, err);
    }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: تسجيل الدخول
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: admin }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: تم تسجيل الدخول, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { description: بيانات خاطئة, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
const login = async (req, res) => {
    try {
        const result = await AuthService.login(req.body);
        // الكوكي هو الوسيلة الأساسية للواجهة (HttpOnly)؛ التوكن في الجسد يبقى
        // لتوافق تطبيق الجوال والاختبارات
        const remember = req.body.remember !== false;
        res.cookie(AUTH_COOKIE, result.token, {
            ...cookieBase,
            ...(remember ? { maxAge: sevenDaysMs } : {}), // بلا maxAge = كوكي جلسة ينتهي بإغلاق المتصفح
        });
        success(res, result, req.t('LOGGED_IN'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: تسجيل الخروج (حذف كوكي الجلسة)
 *     responses:
 *       200: { description: تم تسجيل الخروج }
 */
const logout = async (req, res) => {
    res.clearCookie(AUTH_COOKIE, { ...cookieBase });
    success(res, null, req.t('OK'));
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: معلومات المستخدم الحالي
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: بيانات المستخدم, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { description: غير مصادق, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
const me = async (req, res) => {
    try {
        const user = await AuthService.getMe(req.user.id);
        success(res, user, req.t('OK'));
    } catch (err) {
        respondError(req, res, err);
    }
};

const changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        await AuthService.changePassword(req.user.id, current_password, new_password);
        success(res, null, req.t('PASSWORD_CHANGED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await AuthService.updateProfile(req.user.id, req.body);
        success(res, user, req.t('PROFILE_UPDATED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = { register, login, logout, me, changePassword, updateProfile };
