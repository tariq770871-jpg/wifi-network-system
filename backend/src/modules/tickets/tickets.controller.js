const { query } = require('../../shared/db');
const { success, error, respondError } = require('../../shared/utils/response');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

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
        const { page, limit, offset } = parsePagination(req.query);
        const conditions = [];
        const params = [];
        if (req.query.status) {
            params.push(req.query.status);
            conditions.push(`status = $${params.length}`);
        }
        if (req.query.assigned_to) {
            params.push(req.query.assigned_to);
            conditions.push(`assigned_to = $${params.length}`);
        }
        // FEATURE: فلترة حسب الشبكة/الموقع (?site_id=N) — مبدّل الشبكات في الواجهة
        // MULTI-NETWORK: site_id=0 يعني «البلاغات غير المرتبطة بأي شبكة» (site_id IS NULL) —
        // تعتمد عليها أداة «ربط البلاغات القديمة» في جلب غير المصنّف فقط
        const sidRaw = req.query.site_id;
        if (sidRaw !== undefined && sidRaw !== '') {
            const sid = parseInt(sidRaw, 10);
            if (Number.isNaN(sid) || sid < 0) {
                return error(res, 'معرف الشبكة غير صالح', 400);
            }
            if (sid === 0) {
                conditions.push('site_id IS NULL');
            } else {
                params.push(sid);
                conditions.push(`site_id = $${params.length}`);
            }
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await query(`SELECT COUNT(*)::int AS total FROM tickets ${where}`, params);
        // BUGFIX: JOIN مع users — الواجهة تعرض technician_name وكانت تظهر فارغة دائماً
        // لأن SELECT * لا يُرجع اسم الفني (فقط assigned_to وهو معرف رقمي)
        const result = await query(
            `SELECT t.*, u.full_name AS technician_name, c.full_name AS creator_name,
                    s.name AS site_name
             FROM tickets t
             LEFT JOIN users u ON u.id = t.assigned_to
             LEFT JOIN users c ON c.id = t.created_by
             LEFT JOIN sites s ON s.id = t.site_id
             ${where.replace(/\bstatus\b/g, 't.status').replace(/\bassigned_to\b/g, 't.assigned_to').replace(/\bsite_id\b/g, 't.site_id')}
             ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );
        success(res, { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) });
    } catch (err) {
        respondError(req, res, err);
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
        const result = await query(
            `SELECT t.*, u.full_name AS technician_name, c.full_name AS creator_name,
                    s.name AS site_name
             FROM tickets t
             LEFT JOIN users u ON u.id = t.assigned_to
             LEFT JOIN users c ON c.id = t.created_by
             LEFT JOIN sites s ON s.id = t.site_id
             WHERE t.id = $1`,
            [id]
        );
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
        const { title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, site_id } = req.body;
        // UX: إنشاء بلاغ مع تعيين فني مباشرة → الحالة "معيّن" وليس "قيد الانتظار"
        const initialStatus = assigned_to ? 'assigned' : 'pending';
        const result = await query(
            `INSERT INTO tickets (title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, site_id, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [title, description, customer_name, customer_phone, customer_address, location_lat, location_lng, priority, assigned_to, site_id || null, initialStatus, req.user?.id]
        );
        const ticket = result.rows[0];
        success(res, ticket, 'تم إنشاء البلاغ بنجاح', 201);

        // Emit real-time notification — الفنيون أيضاً: يرون البلاغ فوراً وينطلقون للإصلاح
        if (req.io) {
            req.io.to('admin').to('support').to('technician').emit('ticket:created', {
                message: `بلاغ جديد: ${ticket.title} — العميل: ${ticket.customer_name}`,
                data: ticket,
            });
        }
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
        const { title, description, customer_name, customer_phone, priority, status, site_id } = req.body;
        // BUGFIX: جلب الحالة القديمة قبل التحديث — الكود السابق كان يقارن
        // ticket.status (الجديدة بعد UPDATE) بـ req.body.status فكانا متساويين
        // دائماً والإشعار ticket:updated لم يُرسل مطلقاً
        const before = await query('SELECT status FROM tickets WHERE id = $1', [id]);
        if (before.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        const oldStatus = before.rows[0].status;
        const result = await query(
            `UPDATE tickets SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                customer_name = COALESCE($3, customer_name),
                customer_phone = COALESCE($4, customer_phone),
                priority = COALESCE($5, priority),
                status = COALESCE($6, status),
                site_id = COALESCE($7, site_id),
                updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [title, description, customer_name, customer_phone, priority, status, site_id || null, id]
        );
        const ticket = result.rows[0];
        success(res, ticket, 'تم تحديث البلاغ');

        // Emit real-time notification ONLY on actual status change
        if (req.io && status && status !== oldStatus) {
            const statusLabels = { pending: 'قيد الانتظار', assigned: 'معين', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' };
            req.io.to('admin').to('support').emit('ticket:updated', {
                message: `تم تغيير حالة بلاغ "${ticket.title}" إلى ${statusLabels[status] || status}`,
                data: ticket,
            });
        }
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
        const ticket = result.rows[0];
        success(res, ticket, 'تم تعيين الفني');

        // Emit real-time notification
        if (req.io) {
            req.io.to('admin').to('support').emit('ticket:updated', {
                message: `تم تعيين فني للبلاغ: ${ticket.title}`,
                data: ticket,
            });
        }
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}/claim:
 *   post:
 *     tags: [Tickets]
 *     summary: تبنّي البلاغ — الفني يعيّن نفسه على بلاغ لم يُعيَّن لأحد
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: تم تبنّي البلاغ وأصبح معيَّناً للفني }
 *       404: { description: البلاغ غير موجود }
 *       409: { description: سبق فني آخر وتبنّى البلاغ }
 */
const claim = async (req, res) => {
    try {
        const { id } = req.params;
        // FEATURE: تبنّي البلاغ — الفني يتبنّى بلاغاً في انتظار لم يُعيَّن لأي فني
        // ATOMIC: شرطا (assigned_to IS NULL AND status = 'pending') داخل نفس جملة
        // UPDATE يمنعان سباق فنيين يتبنّان البلاغ نفسه لحظياً — أول طلب يفوز
        // والباقي يصل 409 بدل تعيين مزدوج صامت
        const result = await query(
            `UPDATE tickets
             SET assigned_to = $1, status = 'assigned', updated_at = NOW()
             WHERE id = $2 AND assigned_to IS NULL AND status = 'pending'
             RETURNING *`,
            [req.user.id, id]
        );
        if (result.rows.length === 0) {
            // نفرّق بين "غير موجود" و"سبقه فني آخر" لرسالة واضحة في الواجهة
            const existing = await query('SELECT id FROM tickets WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return error(res, 'البلاغ غير موجود', 404);
            }
            return error(res, 'سبق فني آخر وتبنّى هذا البلاغ — اختر بلاغاً آخر', 409);
        }
        const ticket = result.rows[0];
        success(res, ticket, 'تم تبنّي البلاغ — أصبح معيَّناً لك');

        // Emit real-time notification — الإدارة والدعم يريان من تبنّى البلاغ فوراً
        if (req.io) {
            req.io.to('admin').to('support').emit('ticket:updated', {
                message: `الفني ${req.user.full_name || req.user.username} تبنّى البلاغ: ${ticket.title}`,
                data: ticket,
            });
        }
    } catch (err) {
        respondError(req, res, err);
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
        // SECURITY: الفني يعمل على بلاغه المعيَّن له فقط — لا بدء عمل على بلاغات الفنيين الآخرين
        const existing = await query('SELECT assigned_to FROM tickets WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        if (existing.rows[0].assigned_to !== req.user.id) {
            return error(res, 'هذا البلاغ غير معيَّن لك — تواصل مع المدير', 403);
        }
        const result = await query(
            "UPDATE tickets SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        const ticket = result.rows[0];
        success(res, ticket, 'تم بدء العمل');

        // Emit real-time notification
        if (req.io) {
            req.io.to('admin').to('support').emit('ticket:updated', {
                message: `بدأ العمل على البلاغ: ${ticket.title}`,
                data: ticket,
            });
        }
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
        // SECURITY: الفني يكمل بلاغه المعيَّن له فقط
        const existing = await query('SELECT assigned_to FROM tickets WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        if (existing.rows[0].assigned_to !== req.user.id) {
            return error(res, 'هذا البلاغ غير معيَّن لك — تواصل مع المدير', 403);
        }
        const noteText = notes ? '\n\nملاحظات الإكمال: ' + notes : '';
        const result = await query(
            "UPDATE tickets SET status = 'completed', completed_at = NOW(), updated_at = NOW(), description = description || $1 WHERE id = $2 RETURNING *",
            [noteText, id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        const ticket = result.rows[0];
        success(res, ticket, 'تم إكمال البلاغ');

        // Emit real-time notification
        if (req.io) {
            req.io.to('admin').to('support').emit('ticket:updated', {
                message: `تم إكمال البلاغ: ${ticket.title}`,
                data: ticket,
            });
        }
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tickets/{id}/site:
 *   post:
 *     tags: [Tickets]
 *     summary: ربط/إزالة البلاغ من شبكة (للأدمن والدعم) — أداة «ربط البلاغات القديمة»
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               site_id: { type: integer, nullable: true, description: 'معرف الشبكة — null لإزالة الربط' }
 *     responses:
 *       200: { description: تم تحديث ربط البلاغ }
 *       404: { description: البلاغ أو الشبكة غير موجودة }
 */
const setSite = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.body.site_id === undefined) {
            return error(res, 'يجب تحديد site_id (رقم الشبكة أو null لإزالة الربط)', 400);
        }
        let siteId = null;
        if (req.body.site_id !== null && req.body.site_id !== '') {
            siteId = parseInt(req.body.site_id, 10);
            if (Number.isNaN(siteId) || siteId <= 0) {
                return error(res, 'معرف الشبكة غير صالح', 400);
            }
            // التحقق من وجود الشبكة قبل الربط
            const site = await query('SELECT id FROM sites WHERE id = $1', [siteId]);
            if (site.rows.length === 0) {
                return error(res, 'الشبكة غير موجودة', 404);
            }
        }
        const result = await query(
            'UPDATE tickets SET site_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, site_id',
            [siteId, id]
        );
        if (result.rows.length === 0) {
            return error(res, 'البلاغ غير موجود', 404);
        }
        success(res, result.rows[0], siteId ? 'تم ربط البلاغ بالشبكة' : 'تم إزالة ربط البلاغ من الشبكة');
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, delete: deleteAction, assign, claim, start, complete, setSite };
