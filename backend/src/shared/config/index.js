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
        origins: process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
            : [],
    },
};

// Validate required variables on startup
const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0 && config.env === 'production') {
    console.error(`Missing required env variables: ${missing.join(', ')}`);
    process.exit(1);
}
if (missing.length > 0) {
    console.warn(`[WARN] Missing env variables (using defaults): ${missing.join(', ')}`);
}

module.exports = config;
