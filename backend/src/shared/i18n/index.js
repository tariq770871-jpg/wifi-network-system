/**
 * i18n - الترجمة على مستوى الـ API
 * ---------------------------------
 * - اللغة الافتراضية: العربية (ar)
 * - تُحدد اللغة من ?lang= أو Accept-Language
 * - المدعوم حالياً: ar, en
 * - الاستخدام: req.t('key', { params })
 */
const CATALOGS = require('./locales');

const DEFAULT_LANG = 'ar';
const SUPPORTED = Object.keys(CATALOGS);

function normalize(lang) {
    if (!lang) return DEFAULT_LANG;
    const base = String(lang).split(',')[0].trim().toLowerCase();
    const short = base.split('-')[0];
    return SUPPORTED.includes(short) ? short : DEFAULT_LANG;
}

function translate(lang, key, params) {
    const catalog = CATALOGS[lang] || CATALOGS[DEFAULT_LANG];
    let text = catalog[key] ?? CATALOGS[DEFAULT_LANG][key] ?? key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
    }
    return text;
}

/** Middleware: يحقن req.lang و req.t */
function i18n(req, res, next) {
    const fromQuery = req.query.lang;
    const fromHeader = req.headers['accept-language'];
    req.lang = normalize(fromQuery || fromHeader);
    req.t = (key, params) => translate(req.lang, key, params);
    next();
}

module.exports = { i18n, translate, normalize, SUPPORTED, DEFAULT_LANG };
