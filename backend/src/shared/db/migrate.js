const { pool } = require('./index');

const migrations = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        full_name VARCHAR(100) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'technician' CHECK (role IN ('admin', 'support', 'technician')),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        tracking_enabled BOOLEAN DEFAULT false,
        tracking_veto BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Tickets table
    `CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20),
        customer_address VARCHAR(255),
        location_lat DOUBLE PRECISION,
        location_lng DOUBLE PRECISION,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
    )`,

    // Map points table
    `CREATE TABLE IF NOT EXISTS map_points (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        note TEXT,
        location_lat DOUBLE PRECISION NOT NULL,
        location_lng DOUBLE PRECISION NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        reviewed_at TIMESTAMP WITH TIME ZONE
    )`,

    // Tracking logs table
    `CREATE TABLE IF NOT EXISTS tracking_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        heading DOUBLE PRECISION,
        speed DOUBLE PRECISION,
        battery INTEGER,
        signal_dbm INTEGER,
        ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Signal readings table (for heatmap)
    `CREATE TABLE IF NOT EXISTS signal_readings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        signal_dbm INTEGER NOT NULL,
        ssid VARCHAR(100),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
];

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const migration of migrations) {
            await client.query(migration);
            console.log('✅ Migration applied');
        }
        await client.query('COMMIT');
        console.log('🎉 All migrations completed');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrate };
