require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    database: {
        url: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production',
        pool: {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        },
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '24h',
    },
    cors: {
        get origins() {
            const raw = process.env.ALLOWED_ORIGINS;
            if (!raw || raw.trim() === '') {
                // No origins specified — allow all in non-production
                if (process.env.NODE_ENV !== 'production') {
                    return true; // cors origin: true = allow all
                }
                // In production, require explicit origins
                console.warn('[WARN] ALLOWED_ORIGINS is empty in production. CORS will reject all requests.');
                return [];
            }
            return raw.split(',').map(o => o.trim()).filter(Boolean);
        },
    },
};

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0 && config.env === 'production') {
    console.error(`Missing required env variables: ${missing.join(', ')}`);
    process.exit(1);
}
if (missing.length > 0) {
    console.warn(`[WARN] Missing env variables: ${missing.join(', ')}`);
}

module.exports = config;
