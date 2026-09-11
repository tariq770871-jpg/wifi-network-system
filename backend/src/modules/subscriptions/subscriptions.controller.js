const { query } = require('../../shared/db');
const { success, error, respondError } = require('../../shared/utils/response');
const { parsePagination, buildMeta } = require('../../shared/utils/pagination');

// PLANS: خطط اشتراك معرّفة مركزياً — الواجهة تقرأ نفس القائمة
const PLANS = ['basic', 'standard', 'premium', 'custom'];
const STATUSES = ['active', 'expired', 'suspended', 'cancelled'];

// SELECT أساسي مع اسم الجهاز المرتبط + حقول تنبيه محسوبة
const BASE_SELECT = `
    SELECT s.*, d.name AS device_name, d.ip_address AS device_ip,
           u.full_name AS created_by_name,
           (s.end_date < CURRENT_DATE) AS is_expired,
           (s.end_date >= CURRENT_DATE AND s.end_date <= CURRENT_DATE + INTERVAL '7 days') AS expiring_soon
    FROM subscriptions s
    LEFT JOIN devices d ON d.id = s.device_id
    LEFT JOIN users u ON u.id = s.created_by`;

const list = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const conditions = [];
        const params = [];

        if (req.query.status && STATUSES.includes(req.query.status)) {
            params.push(req.query.status);
            conditions.push(`s.status = $${params.length}`);
        }
        if (req.query.plan && PLANS.includes(req.query.plan)) {
            params.push(req.query.plan);
            conditions.push(`s.plan = $${params.length}`);
        }
        // تصفية «ينتهي قريباً» — خلايا تنبيه التجديد
        if (req.query.expiring_days) {
            params.push(parseInt(req.query.expiring_days, 10));
            conditions.push(`s.end_date <= CURRENT_DATE + ($${params.length} * INTERVAL '1 day')`);
            conditions.push(`s.end_date >= CURRENT_DATE`);
            conditions.push(`s.status = 'active'`);
        }
        // بحث نصي موحد: اسم العميل / هاتف / عنوان
        if (req.query.search) {
            params.push(`%${req.query.search}%`);
            const p = `$${params.length}`;
            conditions.push(`(s.customer_name ILIKE ${p} OR s.customer_phone ILIKE ${p} OR s.customer_address ILIKE ${p})`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await query(`SELECT COUNT(*)::int AS total FROM subscriptions s ${where}`, params);
        const result = await query(
            `${BASE_SELECT} ${where} ORDER BY s.end_date ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );
        success(res, { items: result.rows, pagination: buildMeta(page, limit, countResult.rows[0].total) });
    } catch (err) {
        respondError(req, res, err);
    }
};

const getById = async (req, res) => {
    try {
        const result = await query(`${BASE_SELECT} WHERE s.id = $1`, [req.params.id]);
        if (result.rows.length === 0) return error(res, 'الاشتراك غير موجود', 404);
        success(res, result.rows[0]);
    } catch (err) {
        respondError(req, res, err);
    }
};

// تحقق مشترك بين POST/PUT — تواريخ صالحة والانتهاء بعد البدء
function validateDates(body) {
    if (!body.start_date && !body.end_date) return null;
    const start = body.start_date ? new Date(body.start_date) : null;
    const end = body.end_date ? new Date(body.end_date) : null;
    if (start && isNaN(start.getTime())) return 'تاريخ البدء غير صالح';
    if (end && isNaN(end.getTime())) return 'تاريخ الانتهاء غير صالح';
    if (start && end && end < start) return 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء';
    return null;
}

const create = async (req, res) => {
    try {
        const dateErr = validateDates(req.body);
        if (dateErr) return error(res, dateErr, 400);

        const {
            customer_name, customer_phone, customer_address, device_id,
            plan = 'basic', monthly_price = 0, start_date, end_date, notes,
        } = req.body;

        // خطة غير معروفة → رفض صريح
        if (!PLANS.includes(plan)) return error(res, 'الخطة غير صالحة (basic/standard/premium/custom)', 400);

        // الافتراضي: سنة من اليوم إن لم يُحدَّد انتهاء
        const endDate = end_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const isExpired = endDate < today;

        const result = await query(
            `INSERT INTO subscriptions
                (customer_name, customer_phone, customer_address, device_id, plan, monthly_price, start_date, end_date, status, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, CURRENT_DATE), $8, $9, $10, $11)
             RETURNING *`,
            [
                customer_name, customer_phone || null, customer_address || null,
                device_id || null, plan, monthly_price,
                start_date || null, endDate,
                isExpired ? 'expired' : (req.body.status === 'suspended' ? 'suspended' : 'active'),
                notes || null, req.user.userId,
            ]
        );
        success(res, result.rows[0], 'تم إنشاء الاشتراك', 201);
    } catch (err) {
        respondError(req, res, err);
    }
};

const update = async (req, res) => {
    try {
        const dateErr = validateDates(req.body);
        if (dateErr) return error(res, dateErr, 400);
        if (req.body.plan && !PLANS.includes(req.body.plan)) {
            return error(res, 'الخطة غير صالحة (basic/standard/premium/custom)', 400);
        }
        if (req.body.status && !STATUSES.includes(req.body.status)) {
            return error(res, 'الحالة غير صالحة (active/expired/suspended/cancelled)', 400);
        }

        const b = req.body;
        const result = await query(
            `UPDATE subscriptions SET
                customer_name = COALESCE($1, customer_name),
                customer_phone = COALESCE($2, customer_phone),
                customer_address = COALESCE($3, customer_address),
                device_id = COALESCE($4, device_id),
                plan = COALESCE($5, plan),
                monthly_price = COALESCE($6, monthly_price),
                start_date = COALESCE($7, start_date),
                end_date = COALESCE($8, end_date),
                status = COALESCE($9, status),
                notes = COALESCE($10, notes),
                updated_at = NOW()
             WHERE id = $11 RETURNING *`,
            [
                b.customer_name, b.customer_phone, b.customer_address, b.device_id,
                b.plan, b.monthly_price, b.start_date, b.end_date, b.status, b.notes, req.params.id,
            ]
        );
        if (result.rows.length === 0) return error(res, 'الاشتراك غير موجود', 404);
        success(res, result.rows[0], 'تم تحديث الاشتراك');
    } catch (err) {
        respondError(req, res, err);
    }
};

// RENEW: تجديد n أشهر (افتراضي 1) من أقصى (اليوم، تاريخ الانتهاء الحالي) — لا فقدان أيام متبقية
const renew = async (req, res) => {
    try {
        const months = Math.min(Math.max(parseInt(req.body?.months, 10) || 1, 1), 24);
        const result = await query(
            `UPDATE subscriptions SET
                end_date = GREATEST(CURRENT_DATE, end_date) + ($2 * INTERVAL '1 month'),
                status = 'active',
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [req.params.id, months]
        );
        if (result.rows.length === 0) return error(res, 'الاشتراك غير موجود', 404);
        success(res, result.rows[0], `تم تجديد الاشتراك ${months} شهر`);
    } catch (err) {
        respondError(req, res, err);
    }
};

const remove = async (req, res) => {
    try {
        const result = await query('DELETE FROM subscriptions WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return error(res, 'الاشتراك غير موجود', 404);
        success(res, { id: result.rows[0].id }, 'تم حذف الاشتراك');
    } catch (err) {
        respondError(req, res, err);
    }
};

module.exports = { list, getById, create, update, renew, remove, PLANS, STATUSES };
