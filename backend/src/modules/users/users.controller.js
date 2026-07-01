const UsersService = require('./users.service');
const { success, error } = require('../../shared/utils/response');

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: قائمة المستخدمين
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة المستخدمين }
 *       403: { description: غير مصرح }
 */
const getAll = async (req, res) => {
    try {
        const users = await UsersService.getAll();
        success(res, users);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: مستخدم محدد
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: بيانات المستخدم }
 *       404: { description: غير موجود }
 */
const getById = async (req, res) => {
    try {
        const user = await UsersService.getById(req.params.id);
        success(res, user);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: تحديث مستخدم
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               is_active: { type: boolean }
 *               role: { type: string, enum: [admin, support, technician] }
 *     responses:
 *       200: { description: تم التحديث }
 */
const update = async (req, res) => {
    try {
        const user = await UsersService.update(req.params.id, req.body);
        success(res, user, 'تم التحديث بنجاح');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/users/{id}/tracking:
 *   post:
 *     tags: [Users]
 *     summary: تفعيل/إيقاف تتبع فني
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean, example: true }
 *     responses:
 *       200: { description: تم التحديث }
 */
const controlTracking = async (req, res) => {
    try {
        const { enabled } = req.body;
        const user = await UsersService.controlTracking(req.params.id, enabled);
        success(res, user, enabled ? 'تم تفعيل التتبع' : 'تم إيقاف التتبع');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/users/me/veto:
 *   post:
 *     tags: [Users]
 *     summary: الفيتو - إيقاف/استئناف تتبعي
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [veto]
 *             properties:
 *               veto: { type: boolean, example: true }
 *     responses:
 *       200: { description: تم التحديث }
 */
const vetoTracking = async (req, res) => {
    try {
        const { veto } = req.body;
        const user = await UsersService.vetoTracking(req.user.id, veto);
        success(res, user, veto ? 'تم إيقاف التتبع يدوياً' : 'تم استئناف التتبع');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

module.exports = { getAll, getById, update, controlTracking, vetoTracking };
