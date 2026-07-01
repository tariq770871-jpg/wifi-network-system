const TrackingService = require('./tracking.service');
const { success, error } = require('../../shared/utils/response');

/**
 * @swagger
 * /api/tracking/log:
 *   post:
 *     tags: [Tracking]
 *     summary: تسجيل موقع الفني
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number, example: 24.7136 }
 *               lng: { type: number, example: 46.6753 }
 *               heading: { type: number }
 *               speed: { type: number }
 *               battery: { type: integer }
 *               signal_dbm: { type: integer }
 *               ticket_id: { type: integer }
 *     responses:
 *       200: { description: تم تسجيل الموقع }
 *       403: { description: التتبع غير مفعّل }
 */
const logLocation = async (req, res) => {
    try {
        const log = await TrackingService.logLocation(req.user.id, req.body);
        success(res, log, 'تم تسجيل الموقع');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

/**
 * @swagger
 * /api/tracking/live:
 *   get:
 *     tags: [Tracking]
 *     summary: آخر مواقع جميع الفنيين
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة المواقع الحية }
 */
const getLiveLocations = async (req, res) => {
    try {
        const locations = await TrackingService.getLiveLocations();
        success(res, locations);
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tracking/path/{userId}:
 *   get:
 *     tags: [Tracking]
 *     summary: مسار فني محدد
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: مسار الفني }
 */
const getTechnicianPath = async (req, res) => {
    try {
        const path = await TrackingService.getTechnicianPath(req.params.userId, req.query);
        success(res, path);
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tracking/signal:
 *   post:
 *     tags: [Tracking]
 *     summary: تسجيل قراءة إشارة
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng, signal_dbm]
 *             properties:
 *               lat: { type: number }
 *               lng: { type: number }
 *               signal_dbm: { type: integer }
 *               ssid: { type: string }
 *               ticket_id: { type: integer }
 *     responses:
 *       200: { description: تم تسجيل القراءة }
 */
const logSignal = async (req, res) => {
    try {
        const reading = await TrackingService.logSignal(req.user.id, req.body);
        success(res, reading, 'تم تسجيل القراءة');
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/tracking/signal:
 *   get:
 *     tags: [Tracking]
 *     summary: قراءات الإشارة
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ticket_id
 *         in: query
 *         schema: { type: integer }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: قائمة القراءات }
 */
const getSignalReadings = async (req, res) => {
    try {
        const readings = await TrackingService.getSignalReadings(req.query);
        success(res, readings);
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { logLocation, getLiveLocations, getTechnicianPath, logSignal, getSignalReadings };
