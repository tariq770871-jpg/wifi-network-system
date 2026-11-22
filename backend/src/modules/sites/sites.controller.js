/**
 * Sites Controller — الشبكات/المواقع (مجموعات العمل)
 */
const { success, error, respondError } = require('../../shared/utils/response');
const sitesService = require('./sites.service');

/** GET /api/sites — القائمة مع عدادات البلاغات والأجهزة */
const listSites = async (req, res) => {
    try {
        const sites = await sitesService.listSites(req.query);
        success(res, sites, 'تم جلب قائمة الشبكات');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** GET /api/sites/:id */
const getSite = async (req, res) => {
    try {
        const site = await sitesService.getSite(req.params.id);
        if (!site) return error(res, 'الشبكة غير موجودة', 404);
        success(res, site, 'تم جلب الشبكة');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** POST /api/sites — المدير فقط */
const createSite = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !String(name).trim()) {
            return error(res, 'اسم الشبكة مطلوب', 400);
        }
        const site = await sitesService.createSite(
            { ...req.body, name: String(name).trim() },
            req.user.id
        );
        success(res, site, 'تم إنشاء الشبكة بنجاح', 201);
    } catch (err) {
        respondError(req, res, err);
    }
};

/** PUT /api/sites/:id — المدير فقط */
const updateSite = async (req, res) => {
    try {
        if (req.body.name !== undefined && !String(req.body.name).trim()) {
            return error(res, 'اسم الشبكة مطلوب', 400);
        }
        const site = await sitesService.updateSite(req.params.id, req.body);
        if (!site) return error(res, 'الشبكة غير موجودة', 404);
        success(res, site, 'تم تحديث الشبكة');
    } catch (err) {
        respondError(req, res, err);
    }
};

/** DELETE /api/sites/:id — المدير فقط (مرفوض 409 إذا الشبكة مرتبطة بعناصر) */
const deleteSite = async (req, res) => {
    try {
        const deleted = await sitesService.deleteSite(req.params.id);
        if (!deleted) return error(res, 'الشبكة غير موجودة', 404);
        success(res, deleted, 'تم حذف الشبكة');
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = { listSites, getSite, createSite, updateSite, deleteSite };
