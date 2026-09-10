const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: config.database.pool.max,
    idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
});

pool.on('error', (err) => {
    // STABILITY: لا نقتل العملية على خطأ عميل خامل — نسجل ونستمر
    // (الـ Pool سيعيد إنشاء اتصالات جديدة تلقائياً)
    console.error('[db] Unexpected error on idle client:', err.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
