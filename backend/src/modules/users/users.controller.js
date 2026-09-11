const UsersService = require('./users.service');
const { success, error, respondError } = require('../../shared/utils/response');

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
        const users = await UsersService.getAll(req.query);
        success(res, users);
    } catch (err) {
        respondError(req, res, err);
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
        // SECURITY: كان مفتوحاً لكل المصادقين — أي فني يستطيع قراءة هاتف وبريد
        // أي مستخدم. المدير/الدعم يرون الكل، وبقية الأدوار أنفسهم فقط.
        if (!['admin', 'support'].includes(req.user.role) && req.user.id !== Number(req.params.id)) {
            return error(res, 'لا تملك صلاحية عرض هذا المستخدم', 403);
        }
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
        // عقد موسع: enabled (القديم) أو tracking_enabled، و tracking_veto (حق الاعتراض) — كلاهما اختياري
        const { enabled, tracking_enabled, tracking_veto } = req.body;
        const enabledVal = enabled !== undefined ? enabled : tracking_enabled;
        if (enabledVal === undefined && tracking_veto === undefined) {
            return error(res, 'أرسل enabled و/أو tracking_veto', 400);
        }
        const user = await UsersService.controlTracking(req.params.id, enabledVal, tracking_veto);
        const parts = [];
        if (enabledVal !== undefined) parts.push(enabledVal ? 'تم تفعيل التتبع' : 'تم إيقاف التتبع');
        if (tracking_veto !== undefined) parts.push(tracking_veto ? 'تم تفعيل حق الاعتراض' : 'تم رفع حق الاعتراض');
        success(res, user, parts.join(' — ') || 'تم التحديث');
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

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: إنشاء مستخدم بأي دور (المدير فقط)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, full_name]
 *             properties:
 *               username: { type: string }
 *               password: { type: string, minLength: 6 }
 *               full_name: { type: string }
 *               role: { type: string, enum: [admin, support, technician], default: technician }
 *               phone: { type: string }
 *               email: { type: string }
 *     responses:
 *       201: { description: تم إنشاء المستخدم }
 *       409: { description: اسم المستخدم موجود مسبقاً }
 */
const create = async (req, res) => {
    try {
        const user = await UsersService.create(req.body);
        success(res, user, 'تم إنشاء المستخدم بنجاح', 201);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: حذف مستخدم نهائياً (المدير فقط)
 *     description: حواجز — لا حذف للذات ولا لآخر مدير نشط. مراجع القاعدة SET NULL/CASCADE
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: تم الحذف }
 *       400: { description: حذف الذات أو آخر مدير نشط }
 *       404: { description: غير موجود }
 */
const remove = async (req, res) => {
    try {
        const result = await UsersService.remove(req.params.id, req.user.id);
        success(res, result, 'تم حذف المستخدم نهائياً');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     tags: [Users]
 *     summary: إعادة تعيين كلمة مرور مستخدم (المدير فقط)
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
 *             required: [new_password]
 *             properties:
 *               new_password: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: تم إعادة التعيين }
 */
const resetPassword = async (req, res) => {
    try {
        const { new_password } = req.body;
        const result = await UsersService.resetPassword(req.params.id, new_password);
        success(res, result, 'تم إعادة تعيين كلمة المرور');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

module.exports = { getAll, getById, update, controlTracking, vetoTracking, create, remove, resetPassword };
