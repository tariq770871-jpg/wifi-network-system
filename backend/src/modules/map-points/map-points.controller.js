const MapPointsService = require('./map-points.service');
const { success, error } = require('../../shared/utils/response');

/**
 * @swagger
 * /api/map-points:
 *   get:
 *     tags: [Map Points]
 *     summary: قائمة النقاط
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *     responses:
 *       200: { description: قائمة النقاط }
 */
const getAll = async (req, res) => {
    try {
        const points = await MapPointsService.getAll(req.query);
        success(res, points);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/map-points/my-requests:
 *   get:
 *     tags: [Map Points]
 *     summary: طلباتي
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: طلبات الفني }
 */
const getMyRequests = async (req, res) => {
    try {
        const requests = await MapPointsService.getMyRequests(req.user.id);
        success(res, requests);
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/map-points/{id}:
 *   get:
 *     tags: [Map Points]
 *     summary: نقطة محددة
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: بيانات النقطة }
 *       404: { description: غير موجودة }
 */
const getById = async (req, res) => {
    try {
        const point = await MapPointsService.getById(req.params.id);
        success(res, point);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/map-points:
 *   post:
 *     tags: [Map Points]
 *     summary: إضافة نقطة جديدة
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, location_lat, location_lng]
 *             properties:
 *               name: { type: string, example: 'نقطة تغطية - حي النزهة' }
 *               note: { type: string }
 *               location_lat: { type: number }
 *               location_lng: { type: number }
 *     responses:
 *       200: { description: تم إرسال الطلب }
 *       400: { description: الاسم إلزامي }
 */
const create = async (req, res) => {
    try {
        const point = await MapPointsService.create(req.body, req.user.id);
        success(res, point, 'تم إرسال الطلب بنجاح - بانتظار موافقة الإدارة');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/map-points/{id}/review:
 *   post:
 *     tags: [Map Points]
 *     summary: مراجعة نقطة (موافقة/رفض)
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [approved, rejected] }
 *     responses:
 *       200: { description: تمت المراجعة }
 *       404: { description: غير موجودة }
 */
const review = async (req, res) => {
    try {
        const point = await MapPointsService.review(req.params.id, req.body.status, req.user.id);
        const message = req.body.status === 'approved' ? 'تمت الموافقة على النقطة' : 'تم رفض النقطة';
        success(res, point, message);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/map-points/{id}:
 *   delete:
 *     tags: [Map Points]
 *     summary: حذف نقطة
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
const deletePoint = async (req, res) => {
    try {
        await MapPointsService.delete(req.params.id);
        success(res, null, 'تم حذف النقطة');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

module.exports = { getAll, getById, create, review, getMyRequests, delete: deletePoint };
