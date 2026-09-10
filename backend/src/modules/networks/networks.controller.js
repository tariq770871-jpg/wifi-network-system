/**
 * Networks Controller - إدارة شبكات WiFi
 */
const { success, error, respondError } = require('../../shared/utils/response');
const networksService = require('./networks.service');

const NETWORK_STATUSES = ['active', 'inactive', 'planned'];
const BANDS = [2.4, 5, 6];

/** GET /api/networks */
const listNetworks = async (req, res) => {
    try {
        const networks = await networksService.listNetworks(req.query);
        success(res, networks, req.t('NETWORKS_FETCHED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/networks/:id */
const getNetwork = async (req, res) => {
    try {
        const network = await networksService.getNetwork(req.params.id);
        if (!network) return error(res, req.t('NOT_FOUND'), 404);
        success(res, network, req.t('NETWORK_FETCHED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** POST /api/networks */
const createNetwork = async (req, res) => {
    try {
        const { ssid } = req.body;
        if (!ssid || !String(ssid).trim()) {
            return error(res, req.t('NETWORK_SSID_REQUIRED'), 400);
        }
        if (req.body.band !== undefined && !BANDS.includes(Number(req.body.band))) {
            return error(res, req.t('NETWORK_BAND_INVALID'), 400);
        }
        const network = await networksService.createNetwork(req.body, req.user.id);
        success(res, network, req.t('NETWORK_CREATED'), 201);
    } catch (err) {
        respondError(req, res, err);
    }
};

/** PUT /api/networks/:id */
const updateNetwork = async (req, res) => {
    try {
        if (req.body.ssid !== undefined && !String(req.body.ssid).trim()) {
            return error(res, req.t('NETWORK_SSID_REQUIRED'), 400);
        }
        if (req.body.band !== undefined && !BANDS.includes(Number(req.body.band))) {
            return error(res, req.t('NETWORK_BAND_INVALID'), 400);
        }
        if (req.body.status !== undefined && !NETWORK_STATUSES.includes(req.body.status)) {
            return error(res, req.t('INVALID_INPUT'), 400);
        }
        const network = await networksService.updateNetwork(req.params.id, req.body);
        if (!network) return error(res, req.t('NOT_FOUND'), 404);
        success(res, network, req.t('NETWORK_UPDATED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

/** DELETE /api/networks/:id */
const deleteNetwork = async (req, res) => {
    try {
        const deleted = await networksService.deleteNetwork(req.params.id);
        if (!deleted) return error(res, req.t('NOT_FOUND'), 404);
        success(res, deleted, req.t('NETWORK_DELETED'));
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = { listNetworks, getNetwork, createNetwork, updateNetwork, deleteNetwork };
