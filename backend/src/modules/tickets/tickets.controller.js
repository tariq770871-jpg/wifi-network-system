const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: قائمة البلاغات
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة البلاغات }
 */
const getAll = async (req, res) => {
    try {
        const result = await query('SELECT * FROM tickets ORDER BY created_at DESC');
        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     tags: [Tickets]
 *     summary: بلاغ محدد
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: بيانات البلاغ }
 *       404: { description: غير موجود }
 */
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, result.rows[0]);
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     tags: [Tickets]
 *     summary: إنشاء بلاغ جديد
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, customer_name]
 *             properties:
 *               title: { type: string, example: 'انقطاع الإنترنت' }
 *               description: { type: string }
 *               customer_name: { type: string }
 *               customer_phone: { type: string }
 *               customer_address: { type: string }
 *               location_lat: { type: number }
 *               location_lng: { type: number }
 *               priority: { type: string, enum: [low, medium, high, urgent], default: medium }
 *               assigned_to: { type: integer }
 *     responses:
 *       201: { description: تم إنشاء البلاغ }
 */
const create = async (req, res) => {
    try {
        const { title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to } = req.body;
        const result = await query(
            `INSERT INTO tickets (title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10) RETURNING *`,
            [title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, req.user?.id]
        );
        success(res, result.rows[0], 'تم إنشاء البلاغ بنجاح', 201);
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}:
 *   put:
 *     tags: [Tickets]
 *     summary: تحديث بلاغ
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
 *               title: { type: string }
 *               description: { type: string }
 *               customer_name: { type: string }
 *               customer_phone: { type: string }
 *               priority: { type: string, enum: [low, medium, high, urgent] }
 *               status: { type: string, enum: [pending, assigned, in_progress, completed, cancelled] }
 *     responses:
 *       200: { description: تم التحديث }
 */
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, customer_name, customer_phone, priority, status } = req.body;
        const result = await query(
            `UPDATE tickets SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                customer_name = COALESCE($3, customer_name),
                customer_phone = COALESCE($4, customer_phone),
                priority = COALESCE($5, priority),
                status = COALESCE($6, status),
                updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [title, description, customer_name, customer_phone, priority, status, id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, result.rows[0], 'تم تحديث البلاغ');
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}:
 *   delete:
 *     tags: [Tickets]
 *     summary: حذف بلاغ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: تم الحذف }
 */
const deleteAction = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, null, 'تم حذف البلاغ');
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}/assign:
 *   post:
 *     tags: [Tickets]
 *     summary: تعيين فني للبلاغ
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
 *             required: [assigned_to]
 *             properties:
 *               assigned_to: { type: integer, description: 'معرف الفني' }
 *     responses:
 *       200: { description: تم التعيين }
 */
const assign = async (req, res) => {
    try {
        const { id } = req.params;
        const { assigned_to } = req.body;

        if (!assigned_to) {
            return error(res, 'يجب تحديد الفني', 400);
        }

        const result = await query(
            'UPDATE tickets SET assigned_to = $1, status = $2, started_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *',
            [assigned_to, 'assigned', id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, result.rows[0], 'تم تعيين الفني');
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}/start:
 *   post:
 *     tags: [Tickets]
 *     summary: بدء العمل على البلاغ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: تم بدء العمل }
 */
const start = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            "UPDATE tickets SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, result.rows[0], 'تم بدء العمل');
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}/complete:
 *   post:
 *     tags: [Tickets]
 *     summary: إكمال البلاغ
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
 *               notes: { type: string, description: 'ملاحظات الإكمال' }
 *     responses:
 *       200: { description: تم الإكمال }
 */
const complete = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const noteText = notes ? '\n\nملاحظات الإكمال: ' + notes : '';
        const result = await query(
            "UPDATE tickets SET status = 'completed', completed_at = NOW(), updated_at = NOW(), description = description || $1 WHERE id = $2 RETURNING *",
            [noteText, id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, result.rows[0], 'تم إكمال البلاغ');
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, delete: deleteAction, assign, start, complete };
