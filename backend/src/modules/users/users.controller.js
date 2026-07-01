const UsersService = require('./users.service');
const { success, error } = require('../../shared/utils/response');

const getAll = async (req, res) => {
    try {
        const users = await UsersService.getAll();
        success(res, users);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

const getById = async (req, res) => {
    try {
        const user = await UsersService.getById(req.params.id);
        success(res, user);
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

const update = async (req, res) => {
    try {
        const user = await UsersService.update(req.params.id, req.body);
        success(res, user, 'تم التحديث بنجاح');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

const controlTracking = async (req, res) => {
    try {
        const { enabled } = req.body;
        const user = await UsersService.controlTracking(req.params.id, enabled);
        success(res, user, enabled ? 'تم تفعيل التتبع' : 'تم إيقاف التتبع');
    } catch (err) {
        error(res, err.message, err.statusCode || 500);
    }
};

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
