const { query } = require('../../shared/db');
const { success, error } = require('../../shared/utils/response');

const getDashboardStats = async (req, res) => {
    try {
        // إحصائيات البلاغات
        const ticketsStats = await query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM tickets
            GROUP BY status
        `);

        // إحصائيات الفنيين
        const techniciansStats = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_active THEN 1 END) as active,
                COUNT(CASE WHEN tracking_enabled THEN 1 END) as tracking
            FROM users
            WHERE role = 'technician'
        `);

        // بلاغات هذا الشهر
        const monthlyTickets = await query(`
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as count
            FROM tickets
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date
        `);

        success(res, {
            tickets: ticketsStats.rows,
            technicians: techniciansStats.rows[0],
            monthly_tickets: monthlyTickets.rows
        });
    } catch (err) {
        error(res, err.message, 500);
    }
};

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
