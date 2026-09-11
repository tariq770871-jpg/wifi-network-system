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
    )`,

    // Devices table (with MikroTik integration)
    `CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        device_type VARCHAR(30) DEFAULT 'router' CHECK (device_type IN ('router', 'switch', 'access_point', 'antenna', 'other')),
        model VARCHAR(100),
        manufacturer VARCHAR(100),
        serial_number VARCHAR(100),
        mac_address VARCHAR(17),
        ip_address VARCHAR(45),
        location_lat DOUBLE PRECISION,
        location_lng DOUBLE PRECISION,
        coordinate_source VARCHAR(20) DEFAULT 'manual' CHECK (coordinate_source IN ('gps', 'manual', 'mikrotik')),
        gps_accuracy DOUBLE PRECISION,
        installed_at TIMESTAMP WITH TIME ZONE,
        installed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
        is_mikrotik_linked BOOLEAN DEFAULT false,
        mikrotik_username VARCHAR(50) DEFAULT 'monitor',
        mikrotik_api_port INTEGER DEFAULT 8728,
        mikrotik_password_encrypted TEXT,
        last_ssid VARCHAR(100),
        last_seen TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Device status history (MikroTik monitoring)
    `CREATE TABLE IF NOT EXISTS device_status_logs (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        ssid VARCHAR(100),
        cpu_load INTEGER,
        free_memory_mb INTEGER,
        uptime VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // WiFi networks managed/discovered
    `CREATE TABLE IF NOT EXISTS networks (
        id SERIAL PRIMARY KEY,
        ssid VARCHAR(100) NOT NULL,
        band DOUBLE PRECISION DEFAULT 2.4,
        channel INTEGER,
        frequency_mhz INTEGER,
        security_type VARCHAR(20) DEFAULT 'wpa2' CHECK (security_type IN ('open', 'wep', 'wpa', 'wpa2', 'wpa3')),
        location_lat DOUBLE PRECISION,
        location_lng DOUBLE PRECISION,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'planned')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // ===== ترقيات مخطط قواعد بيانات قائمة (idempotent — آمنة على الإنتاج) =====
    // بيانات الجهاز الموسعة: الموديل، المصنّع، الرقم التسلسلي، MAC، التركيب، مصدر الإحداثية
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS model VARCHAR(100)`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100)`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100)`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17)`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS coordinate_source VARCHAR(20) DEFAULT 'manual'`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS installed_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE devices ADD COLUMN IF NOT EXISTS installed_by INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    // قيد مصدر الإحداثية يُضاف فقط إن لم يوجد (Postgres لا يدعم IF NOT EXISTS للقيود)
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_coordinate_source_check') THEN
            ALTER TABLE devices ADD CONSTRAINT devices_coordinate_source_check
                CHECK (coordinate_source IN ('gps', 'manual', 'mikrotik'));
        END IF;
    END $$`,
    // فهرس البحث السريع بالاسم/الرقم التسلسلي/MAC/IP
    `CREATE INDEX IF NOT EXISTS devices_name_trgm_idx ON devices (name)`,
    `CREATE INDEX IF NOT EXISTS devices_serial_idx ON devices (serial_number)`,
    `CREATE INDEX IF NOT EXISTS devices_mac_idx ON devices (mac_address)`,

    // ─── الاشتراكات: جوهر إدارة مزوّد خدمة WiFi ───
    // اشتراك عميل على جهاز/نقطة: خطة + سعر شهري + فترة صلاحية + حالة
    `CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20),
        customer_address VARCHAR(255),
        device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        plan VARCHAR(50) NOT NULL DEFAULT 'basic',
        monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','suspended','cancelled')),
        notes VARCHAR(1000),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status)`,
    `CREATE INDEX IF NOT EXISTS subscriptions_end_date_idx ON subscriptions (end_date)`,
    `CREATE INDEX IF NOT EXISTS subscriptions_device_idx ON subscriptions (device_id)`
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
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

// تتبع حالة الـ migration الذاتي عند الإقلاع (يُعرض في /health)
const migrationState = { status: 'idle', error: null, at: null };

// قفل استشاري موحّد: إذا انطلقت عدة حاويات معاً فالأولى تنفّذ والبقية تتجاوز
const MIGRATE_LOCK_KEY = 918273645;

/**
 * تشغيل migrations عند إقلاع الـ serverless (idempotent بالكامل).
 * يُفعّل بمتغير البيئة RUN_MIGRATIONS=true — تنفيذ واحد لكل حاوية.
 * حماية من التعليق: pg_try_advisory_lock + lock_timeout — الحاوية التي لا تحصل
 * على القفل تتجاوز فوراً (الـ DDL idempotent والمخطط سيكتمل من الحاوية الأولى).
 */
function runMigrationsOnBoot() {
    if (process.env.RUN_MIGRATIONS !== 'true') {
        migrationState.status = 'disabled';
        return;
    }
    if (migrationState.status === 'running' || migrationState.status === 'done') return;
    migrationState.status = 'running';
    migrationState.at = new Date().toISOString();

    (async () => {
        const client = await pool.connect();
        try {
            // مهلة قفل قصيرة: إن كان قفل المخطط محتجزاً فلا ننتظر أبداً
            await client.query('SET lock_timeout = 5000');
            const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [MIGRATE_LOCK_KEY]);
            if (!lock.rows[0].ok) {
                migrationState.status = 'skipped';
                migrationState.at = new Date().toISOString();
                console.log('⏭️ Migration skipped — another instance holds the lock');
                return;
            }
            try {
                // مهلة لكل عبارة DDL: فشل سريع أفضل من تعليق الحاوية
                await client.query('SET statement_timeout = 60000');
                // إنقاذ: جلسات DDL عالقة idle-in-transaction (حاوية serverless مجمّدة
                // قبل COMMIT) تحتجز الأقفال إلى الأبد — تُنهى فقط إذا تجاوزت 3 دقائق
                // وكان آخر استعلام فيها DDL مخطط (وليس حركة تطبيق عادية)
                await client.query(`
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE state = 'idle in transaction'
                      AND pid <> pg_backend_pid()
                      AND xact_start < now() - interval '3 minutes'
                      AND (query ILIKE 'CREATE TABLE%'
                        OR query ILIKE 'ALTER TABLE%'
                        OR query ILIKE 'CREATE INDEX%'
                        OR query ILIKE 'DO $$%')
                `).catch(() => {});
                for (const migration of migrations) {
                    await client.query(migration);
                    console.log('✅ Migration applied');
                }
                console.log('🎉 All migrations completed');
                migrationState.status = 'done';
                migrationState.at = new Date().toISOString();
            } finally {
                await client.query('SELECT pg_advisory_unlock($1)', [MIGRATE_LOCK_KEY]).catch(() => {});
            }
        } catch (err) {
            migrationState.status = 'failed';
            migrationState.error = err.message;
            console.error('❌ Boot migration failed:', err.message);
        } finally {
            client.release();
        }
    })();
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrate, migrationState, runMigrationsOnBoot };
