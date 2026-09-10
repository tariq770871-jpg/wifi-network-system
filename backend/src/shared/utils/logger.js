/**
 * Structured Logger - سجلات JSON منظمة مع مستويات
 * ------------------------------------------------
 * - في الإنتاج: JSON واحد لكل سطر (جاهز لـ Loki/CloudWatch/Datadog)
 * - في التطوير: مخرجات مقروءة
 * - لا يسجل الأسرار أبداً (Authorization/password يُقنّعان)
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

const SENSITIVE_KEYS = ['password', 'hashed_password', 'mikrotik_password', 'mikrotik_password_encrypted', 'token', 'authorization', 'secret'];

function redact(meta) {
    if (!meta || typeof meta !== 'object') return meta;
    const safe = { ...meta };
    for (const key of Object.keys(safe)) {
        if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
            safe[key] = '[REDACTED]';
        } else if (typeof safe[key] === 'object' && safe[key] !== null) {
            safe[key] = redact(safe[key]);
        }
    }
    return safe;
}

function emit(level, msg, meta) {
    if (LEVELS[level] < currentLevel) return;
    const entry = {
        ts: new Date().toISOString(),
        level,
        msg,
        ...(meta ? { meta: redact(meta) } : {}),
    };
    const line = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json'
        ? JSON.stringify(entry)
        : `[${entry.ts}] ${level.toUpperCase()}: ${msg}${meta ? ' ' + JSON.stringify(entry.meta) : ''}`;

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

module.exports = {
    debug: (msg, meta) => emit('debug', msg, meta),
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
};
