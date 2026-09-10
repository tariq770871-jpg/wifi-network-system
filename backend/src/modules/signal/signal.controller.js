/**
 * Signal Controller - قراءات الإشارة والخريطة الحرارية
 */
const { success, error, respondError } = require('../../shared/utils/response');
const signalService = require('./signal.service');

/** POST /api/signal/readings */
const recordReading = async (req, res) => {
    try {
        const { lat, lng, signal_dbm, ssid, ticket_id } = req.body;

        if ([lat, lng].some((v) => v === undefined || v === null || v === '')) {
            return error(res, req.t('SIGNAL_LAT_LNG_REQUIRED'), 400);
        }
        const dbm = Number(signal_dbm);
        if (!Number.isFinite(dbm) || dbm < -100 || dbm > -20) {
            return error(res, req.t('SIGNAL_DBM_REQUIRED'), 400);
        }

        const reading = await signalService.recordReading(
            { lat: Number(lat), lng: Number(lng), signal_dbm: dbm, ssid, ticket_id },
            req.user.id
        );
        success(res, reading, req.t('READING_RECORDED'), 201);
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/signal/heatmap?min_lat=&max_lat=&min_lng=&max_lng=&grid_size= */
const getHeatmap = async (req, res) => {
    try {
        const cells = await signalService.getHeatmap(req.query);
        success(res, { cells }, req.t('HEATMAP_FETCHED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/signal/readings?page=1&limit=20 */
const listReadings = async (req, res) => {
    try {
        const readings = await signalService.listReadings(req.query);
        success(res, readings, req.t('READINGS_FETCHED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/signal/coverage */
const getCoverageStats = async (req, res) => {
    try {
        const stats = await signalService.getCoverageStats();
        success(res, stats, req.t('OK'));
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = { recordReading, getHeatmap, listReadings, getCoverageStats };
