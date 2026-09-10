const AuthService = require('./auth.service');
const { success, respondError } = require('../../shared/utils/response');

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
        success(res, result, req.t('LOGGED_IN'));
    } catch (err) {
        respondError(req, res, err);
    }
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

module.exports = { register, login, me, changePassword, updateProfile };
