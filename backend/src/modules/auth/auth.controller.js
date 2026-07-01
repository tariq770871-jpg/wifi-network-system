const AuthService = require('./auth.service');
const { success, error } = require('../../shared/utils/response');

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
        success(res, user, 'تم إنشاء الحساب بنجاح');
    } catch (err) {
        const statusCode = err.statusCode || 500;
        error(res, err.message, statusCode);
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
        success(res, result, 'تم تسجيل الدخول بنجاح');
    } catch (err) {
        const statusCode = err.statusCode || 500;
        error(res, err.message, statusCode);
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
        success(res, user);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        error(res, err.message, statusCode);
    }
};

module.exports = { register, login, me };
