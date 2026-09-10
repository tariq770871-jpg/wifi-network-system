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
            // 10s: واقعي للاتصالات TLS عبر Pooler السحابي (Supabase/Neon) من مناطق بعيدة
            connectionTimeoutMillis: 10000,
        },
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
    },
    cors: {
        get origins() {
            const raw = process.env.ALLOWED_ORIGINS;
            if (!raw || raw.trim() === '') {
                // SECURITY: في الإنتاج يُمنع السماح بكل المصادر — لا بد من قائمة صريحة
                // (allow-all مع credentials يفتح باب هجمات CSRF/CORS من أي موقع)
                if ((process.env.NODE_ENV || 'development') === 'production') {
                    console.error('FATAL: ALLOWED_ORIGINS مطلوب في الإنتاج (قائمة أصول مفصولة بفواصل) — رفض بدء التشغيل');
                    process.exit(1);
                }
                console.warn('[WARN] ALLOWED_ORIGINS فارغ — السماح بكل المصادر (تطوير فقط)');
                return true;
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
