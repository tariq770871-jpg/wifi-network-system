/**
 * Pagination Utility - ترقيم صفحات موحد
 * --------------------------------------
 * الاستخدام في الخدمات:
 *   const { limit, offset, page } = parsePagination(req.query);
 *   ... LIMIT $n OFFSET $n+1 ... + COUNT(*)
 *
 * الاستجابة الموحدة: { items, pagination: { page, limit, total, pages } }
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * @param {object} query - req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query = {}) {
    let page = parseInt(query.page, 10);
    let limit = parseInt(query.limit, 10);

    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    return { page, limit, offset: (page - 1) * limit };
}

/**
 * بناء كائن الترقيم للاستجابة
 * @param {number} page
 * @param {number} limit
 * @param {number} total - إجمالي العناصر من COUNT(*)
 */
function buildMeta(page, limit, total) {
    return {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
    };
}

module.exports = { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
