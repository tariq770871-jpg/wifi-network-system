const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

/**
 * @swagger
 * /api/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: إحصائيات الداشبورد
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: إحصائيات شاملة
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tickets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status: { type: string }
 *                       count: { type: integer }
 *                 technicians:
 *                   type: object
 *                 monthly_tickets:
 *                   type: array
 */
const getDashboardStats = async (req, res) => {
    try {
        const ticketsStats = await query(`
            SELECT status, COUNT(*) as count
            FROM tickets
            GROUP BY status
        `);

        const techniciansStats = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN is_active THEN 1 END) as active,
                COUNT(CASE WHEN tracking_enabled THEN 1 END) as tracking
            FROM users
            WHERE role = 'technician'
        `);

        const monthlyTickets = await query(`
            SELECT
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as count
            FROM tickets
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date
        `);

        // مزامنة التبويبات: الداشبورد يعكس الأجهزة ونقاط الخريطة لحظياً
        const devicesStats = await query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(CASE WHEN status = 'online' THEN 1 END)::int AS online,
                COUNT(CASE WHEN status = 'offline' THEN 1 END)::int AS offline,
                COUNT(CASE WHEN status = 'maintenance' THEN 1 END)::int AS maintenance,
                COUNT(CASE WHEN location_lat IS NOT NULL AND location_lng IS NOT NULL THEN 1 END)::int AS with_location,
                COUNT(CASE WHEN is_mikrotik_linked THEN 1 END)::int AS mikrotik_linked
            FROM devices
        `);

        const mapPointsStats = await query(`
            SELECT status, COUNT(*)::int AS count
            FROM map_points
            GROUP BY status
        `);

        success(res, {
            tickets: ticketsStats.rows,
            technicians: techniciansStats.rows[0],
            monthly_tickets: monthlyTickets.rows,
            devices: devicesStats.rows[0],
            map_points: mapPointsStats.rows
        });
    } catch (err) {
        error(res, err.message, 500);
    }
};

/**
 * @swagger
 * /api/reports/technicians:
 *   get:
 *     tags: [Reports]
 *     summary: أداء الفنيين
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: أداء كل فني
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *                   full_name: { type: string }
 *                   total_tasks: { type: integer }
 *                   completed: { type: integer }
 *                   in_progress: { type: integer }
 *                   pending: { type: integer }
 */
const getTechnicianPerformance = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                u.id,
                u.full_name,
                COUNT(t.id) as total_tasks,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_to
            WHERE u.role = 'technician'
            GROUP BY u.id, u.full_name
            ORDER BY completed DESC
        `);

        success(res, result.rows);
    } catch (err) {
        error(res, err.message, 500);
    }
};

module.exports = { getDashboardStats, getTechnicianPerformance };
