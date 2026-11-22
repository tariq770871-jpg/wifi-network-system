/**
 * MikroTik RouterOS API Service
 * -----------------------------
 * منقول ومحوّل من مشروع ntsm-backend (NestJS) إلى نمط هذا المشروع
 * (CommonJS + Service Layer) ليخدم وحدة الأجهزة.
 *
 * الوظائف:
 *  - تشفير/فك تشفير كلمات مرور MikroTik (AES)
 *  - الاتصال بجهاز MikroTik عبر RouterOS API (المنفذ 8728) أو SSH (وضع ssh)
 *  - قراءة SSID للواجهات اللاسلكية
 *  - قراءة موارد الجهاز (CPU / الذاكرة / مدة التشغيل / الجهد إن وجد)
 *  - اختبار الاتصال
 *
 * وضع الاتصال (device.mikrotik_mode):
 *  - 'api' (افتراضي): RouterOS API عبر خدمة api — المنفذ الافتراضي 8728
 *  - 'ssh' : اتصال SSH مشفّر عبر خدمة ssh — المنفذ الافتراضي 22 — مخصص
 *    لإصدارات RouterOS 6 ولمن لا يريد تفعيل خدمة api إطلاقاً
 *    (قرار صاحب النظام: راوتره 6.48.6 ولا يريد تفعيل api)
 *  المصدر الوحيد لبيانات الاكتشاف في الوضعين: /ip neighbor فقط.
 */
const CryptoJS = require('crypto-js');
const { RouterOSAPI } = require('node-routeros');
const config = require('../../shared/config');
const sshTransport = require('./routeros-ssh.service');

// SECURITY: لا يوجد مفتاح افتراضي — الإنتاج يفشل فوراً بلا مفتاح صريح قوي
// (المفتاح الافتراضي القديم 'default_key_change_me' كان يسمح بفك تشفير كلمات المرور المخزنة)
const WEAK_DEFAULT_KEYS = ['default_key_change_me', 'change_me', 'secret'];
const rawKey = process.env.MIKROTIK_ENCRYPTION_KEY;
if (config.env === 'production') {
    if (!rawKey || rawKey.length < 16 || WEAK_DEFAULT_KEYS.includes(rawKey)) {
        console.error('FATAL: MIKROTIK_ENCRYPTION_KEY مفقود أو ضعيف (مطلوب 16 حرفاً على الأقل) — رفض بدء التشغيل');
        process.exit(1);
    }
} else if (!rawKey || WEAK_DEFAULT_KEYS.includes(rawKey)) {
    console.warn('[WARN] MIKROTIK_ENCRYPTION_KEY غير مضبوط — يستخدم مفتاح تطوير غير آمن (ممنوع في الإنتاج)');
}
const ENCRYPTION_KEY = rawKey || 'dev_only_insecure_mikrotik_key';

/** سقف زمني صارم لأي عملية MikroTik (يحل مشكلة تعليق TCP مع العناوين غير القابلة للوصول) */
const OPERATION_TIMEOUT_MS = Number(process.env.MIKROTIK_TIMEOUT_MS) || 8000;

function withTimeout(promise, ms = OPERATION_TIMEOUT_MS, label = 'MikroTik operation') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** إغلاق آمن للاتصال مع حارس مهلة */
async function safeClose(conn) {
    try {
        await withTimeout(conn.close(), 2000, 'close');
    } catch { /* تجاهل أخطاء الإغلاق */ }
}

/** تشفير كلمة المرور قبل تخزينها في قاعدة البيانات */
function encryptPassword(plain) {
    if (!plain) return '';
    return CryptoJS.AES.encrypt(String(plain), ENCRYPTION_KEY).toString();
}

/** فك تشفير كلمة المرور المخزنة */
function decryptPassword(encrypted) {
    if (!encrypted) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8) || '';
    } catch {
        return '';
    }
}

/** وضع اتصال الجهاز: 'api' أو 'ssh' — أي قيمة غير معروفة تعامل كـ api */
function deviceMode(device) {
    return String(device && device.mikrotik_mode) === 'ssh' ? 'ssh' : 'api';
}

/** إنشاء اتصال RouterOS من بيانات جهاز مخزنة */
function buildConnection(device) {
    return new RouterOSAPI({
        host: device.ip_address,
        port: device.mikrotik_api_port || 8728,
        user: device.mikrotik_username || 'monitor',
        password: decryptPassword(device.mikrotik_password_encrypted),
        timeout: 5000,
    });
}

/**
 * قراءة SSID من جهاز MikroTik
 * @returns {Promise<string|null>} SSID الحالي أو null عند الفشل
 */
async function getSSID(device) {
    if (!device.is_mikrotik_linked || !device.ip_address) return null;

    if (!device.mikrotik_password_encrypted) {
        console.warn(`[MikroTik] لا توجد كلمة مرور للجهاز ${device.ip_address}`);
        return null;
    }

    if (deviceMode(device) === 'ssh') {
        try {
            return await sshTransport.getSSIDSsh(device);
        } catch (e) {
            console.error(`[MikroTik/SSH] خطأ SSID ${device.ip_address}: ${e.message}`);
            return null;
        }
    }

    const conn = buildConnection(device);
    try {
        await withTimeout(conn.connect(), OPERATION_TIMEOUT_MS, `connect ${device.ip_address}`);
        const interfaces = await withTimeout(
            conn.write('/interface/wireless/print'),
            OPERATION_TIMEOUT_MS,
            'wireless print'
        );
        const running = interfaces.find(
            (i) => i.status === 'running' || i.running === 'true' || i.disabled === 'false'
        );
        return (running && (running.ssid || running.name)) || null;
    } catch (e) {
        console.error(`[MikroTik] خطأ في الجهاز ${device.ip_address}: ${e.message}`);
        return null;
    } finally {
        await safeClose(conn);
    }
}

/**
 * قراءة موارد الجهاز الحية (CPU، الذاكرة، مدة التشغيل)
 * @returns {Promise<object|null>} موارد الجهاز أو null عند الفشل
 */
async function getResources(device) {
    if (!device.is_mikrotik_linked || !device.ip_address) return null;
    if (!device.mikrotik_password_encrypted) return null;

    if (deviceMode(device) === 'ssh') {
        try {
            return await sshTransport.getResourcesSsh(device);
        } catch (e) {
            console.error(`[MikroTik/SSH] خطأ قراءة الموارد ${device.ip_address}: ${e.message}`);
            return null;
        }
    }

    const conn = buildConnection(device);
    try {
        await withTimeout(conn.connect(), OPERATION_TIMEOUT_MS, `connect ${device.ip_address}`);
        const [res] = await withTimeout(
            conn.write('/system/resource/print'),
            OPERATION_TIMEOUT_MS,
            'resource print'
        );
        if (!res) return null;
        return {
            cpu_load: res['cpu-load'],
            free_memory_mb: res['free-memory'] ? Math.round(Number(res['free-memory']) / 1048576) : null,
            total_memory_mb: res['total-memory'] ? Math.round(Number(res['total-memory']) / 1048576) : null,
            uptime: res.uptime,
            version: res.version,
            board_name: res['board-name'],
            architecture: res.architectureName || res['architecture-name'],
        };
    } catch (e) {
        console.error(`[MikroTik] خطأ قراءة الموارد ${device.ip_address}: ${e.message}`);
        return null;
    } finally {
        await safeClose(conn);
    }
}

/**
 * اختبار الاتصال بجهاز MikroTik
 * @returns {Promise<{success: boolean, ssid?: string, error?: string}>}
 */
async function testConnection(device) {
    if (!device.ip_address) {
        return { success: false, error: 'لا يوجد عنوان IP للجهاز' };
    }
    if (!device.mikrotik_password_encrypted) {
        return { success: false, error: 'لا توجد كلمة مرور MikroTik محفوظة' };
    }
    if (deviceMode(device) === 'ssh') {
        // مثل فرع api: الفشل يعيد نتيجة لا ترمي — رسالة عربية واضحة
        try {
            return await sshTransport.testConnectionSsh(device);
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    try {
        const conn = buildConnection(device);
        try {
            await withTimeout(conn.connect(), OPERATION_TIMEOUT_MS, `connect ${device.ip_address}`);
            const [identity] = await withTimeout(
                conn.write('/system/identity/print'),
                OPERATION_TIMEOUT_MS,
                'identity print'
            );
            const ssid = await getSSID(device);
            return { success: true, identity: identity ? identity.name : undefined, ssid: ssid || undefined };
        } finally {
            await safeClose(conn);
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * FEATURE: قراءة بيانات اكتشاف الأجهزة من الراوتر
 * ------------------------------------------------
 * المصدر الوحيد للبيانات: تبويب Neighbors في Winbox
 * (/ip neighbor — اكتشاف MNDP/LLDP، نفس القائمة التي يراها المستخدم).
 *
 * قرار صريح بطلب صاحب النظام — لا يُقرأ نهائياً ولا يتدخل في هذا الموضوع:
 *  - جدول التسجيلات اللاسلكية (Active / registration-table)
 *  - قوة الإشارة بأي شكل
 *  - جدول ARP ومستأجرو DHCP
 *
 * تُقرأ /interface/print فقط لاستخراج عناوين MAC الخاصة بالراوتر نفسه
 * واستبعادها من النتائج كي لا يظهر الراوتر كجهاز مكتشَف — لا تضيف أي جهاز.
 *
 * @param {object} device صف الجهاز المرتبط من قاعدة البيانات (ip/port/user/password مشفرة)
 * @returns {Promise<{entries: Array, errors: string[]}>} entries = أجهزة Neighbors، errors = أخطاء غير قاتلة
 */
async function fetchDiscoveryData(device) {
    if (!device.ip_address) throw new Error('لا يوجد عنوان IP للراوتر');
    if (!device.mikrotik_password_encrypted) throw new Error('لا توجد كلمة مرور MikroTik محفوظة للراوتر');

    // وضع ssh: نفس العقد (entries/errors) لكن عبر اتصال SSH مشفّر
    if (deviceMode(device) === 'ssh') return sshTransport.fetchDiscoveryDataSsh(device);

    const conn = buildConnection(device);
    const errors = [];
    try {
        await withTimeout(conn.connect(), OPERATION_TIMEOUT_MS, `connect ${device.ip_address}`);

        const readTable = async (cmd, label) => {
            try {
                const rows = await withTimeout(conn.write(cmd), OPERATION_TIMEOUT_MS, label);
                return Array.isArray(rows) ? rows : [];
            } catch (e) {
                errors.push(`${label}: ${e.message}`);
                return [];
            }
        };

        // عناوين MAC للراوتر نفسه — لاستبعاد الراوتر من النتائج فقط (لا تضيف أي جهاز)
        const interfaces = await readTable('/interface/print', 'الواجهات');
        const ownMacs = new Set(
            interfaces.map((i) => String(i['mac-address'] || '').trim().toUpperCase().replace(/-/g, ':')).filter(Boolean)
        );

        // المصدر الوحيد: تبويب Neighbors (MNDP/LLDP) — حرفياً ما يظهر في Winbox
        const neighbors = await readTable('/ip/neighbor/print', 'Neighbors');

        const entries = [];
        for (const row of neighbors) {
            const mac = String(row['mac-address'] || '').trim().toUpperCase().replace(/-/g, ':');
            if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac) || ownMacs.has(mac)) continue;
            entries.push({
                mac,
                ip: row.address || null,
                hostname: row.identity || row['board-name'] || null,
                interface: row.interface || null,
                source: 'neighbor',
            });
        }

        return { entries, errors };
    } finally {
        await safeClose(conn);
    }
}

module.exports = {
    encryptPassword,
    decryptPassword,
    deviceMode,
    getSSID,
    getResources,
    testConnection,
    fetchDiscoveryData,
};
