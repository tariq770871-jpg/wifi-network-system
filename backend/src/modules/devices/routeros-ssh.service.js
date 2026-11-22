/**
 * RouterOS SSH Transport — وضع SSH (بديل عن خدمة api)
 * ------------------------------------------------------
 * لماذا؟ صاحب النظام لديه RouterOS 6.48.6 ولا يريد تفعيل خدمة api (8728).
 * وضع SSH يقرأ نفس جدول /ip neighbor عبر اتصال SSH مشفّر (خدمة ssh —
 * المنفذ 22) بنفس اسم المستخدم وكلمة المرور، ويعمل على RouterOS 6.x و7.x.
 *
 * قرار صريح بطلب صاحب النظام — لا يُقرأ نهائياً ولا يتدخل في هذا الموضوع:
 *  - جدول التسجيلات اللاسلكية (Active / registration-table)
 *  - قوة الإشارة بأي شكل
 *  - جدول ARP ومستأجرو DHCP
 *
 * تُقرأ /interface print فقط لاستخراج عناوين MAC الخاصة بالراوتر نفسه
 * واستبعادها من النتائج كي لا يظهر الراوتر كجهاز مكتشَف — لا تضيف أي جهاز.
 *
 * الأوامر بوضع terse (سطر لكل سجل بصيغة key=value) — ثابتة عبر إصدارات
 * RouterOS وأسهل تحليلاً من الجدولي، وبدون ترقيم صفحات (without-paging).
 */

// دعم SSH اختياري: إن لم يكن ssh2 مثبتاً على جهاز المستخدم فالنظام يبقى
// شغالاً بوضع api، ووضع ssh يعيد رسالة واضحة بدل إسقاط الخادم.
let ssh2Cache = null;
function loadSsh2() {
    if (ssh2Cache) return ssh2Cache;
    try {
        ssh2Cache = require('ssh2');
    } catch {
        throw new Error(
            'دعم SSH غير مثبت على الخادم — شغّل start.bat مرة واحدة لإكمال التثبيت (أو نفّذ npm install داخل مجلد backend)'
        );
    }
    return ssh2Cache;
}

const SSH_TIMEOUT_MS = Number(process.env.MIKROTIK_SSH_TIMEOUT_MS) || 10000;
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

/** أزواج key=value في سطر terse — يدعم قيماً مقتبسة تحتوي مسافات */
const PAIR_RE = /([a-zA-Z0-9_-]+)=("(?:[^"\\]|\\.)*"|'[^']*'|[^\s]*)/g;

/**
 * تحليل مخرجات `print terse` — سطر لكل سجل:
 * " 0 D address=192.168.88.24 mac-address=DC:2C:6E:E7:10:6B identity=\"Main Router\""
 * يتجاهل الأسطر الفارغة وأسطر الأعمدة (#) والأسطر بلا key=value (رسائل خطأ).
 */
function parseTerse(text) {
    const rows = [];
    if (!text) return rows;
    for (const rawLine of String(text).split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const row = {};
        let matched = false;
        PAIR_RE.lastIndex = 0;
        let m;
        while ((m = PAIR_RE.exec(line)) !== null) {
            matched = true;
            let val = m[2];
            if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
            ) {
                val = val.slice(1, -1).replace(/\\(["'])/g, '$1');
            }
            row[m[1]] = val;
        }
        if (matched) rows.push(row);
    }
    return rows;
}

/**
 * تحليل مخرجات `print` العادية (key: value في كل سطر) — تُستخدم
 * للهوية والموارد: "cpu-load: 3%" / "name: MikroTik"
 */
function parseColonOutput(text) {
    const row = {};
    if (!text) return row;
    for (const rawLine of String(text).split(/\r?\n/)) {
        const m = rawLine.match(/^\s*([a-zA-Z0-9_-]+):\s*(.*?)\s*$/);
        if (m) row[m[1]] = m[2];
    }
    return row;
}

/** ترجمة أخطاء SSH الشائعة لرسائل عربية واضحة */
function mapSshError(e) {
    const msg = String(e && (e.message || e));
    if (/ECONNREFUSED/.test(msg)) {
        return 'الراوتر رفض الاتصال — تأكد أن خدمة ssh مفعّلة على الراوتر وأن المنفذ صحيح (الافتراضي 22)';
    }
    if (/ETIMEDOUT|timed out/i.test(msg)) {
        return `تعذر الوصول للراوتر عبر SSH (timed out بعد ${SSH_TIMEOUT_MS}ms) — تحقق من العنوان ومن جدار الحماية`;
    }
    if (/All configured authentication methods failed/i.test(msg)) {
        return 'فشل تسجيل الدخول عبر SSH — اسم المستخدم أو كلمة المرور غير صحيحة';
    }
    if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
        return 'عنوان الراوتر غير موجود — تأكد من عنوان IP';
    }
    return `SSH: ${msg}`;
}

/**
 * تنفيذ مجموعة أوامر على الراوتر عبر SSH (اتصال واحد بالتتابع)
 * @param {object} device صف الجهاز (ip_address/mikrotik_api_port/mikrotik_username/mikrotik_password_encrypted/mikrotik_mode)
 * @param {string[]} commands أوامر RouterOS
 * @returns {Promise<string[]>} مخرجات كل أمر بنفس الترتيب
 */
async function runCommands(device, commands) {
    const { Client } = loadSsh2();
    // تجنب الاستدعاء الدائري: فك التشفير عبر require متأخر داخل الدالة
    const { decryptPassword } = require('./mikrotik.service');
    const password = decryptPassword(device.mikrotik_password_encrypted);

    const cfg = {
        host: device.ip_address,
        port: Number(device.mikrotik_api_port) || 22,
        username: device.mikrotik_username || 'monitor',
        password,
        readyTimeout: SSH_TIMEOUT_MS,
        tryKeyboard: false,
        // راوتر داخل شبكة محلية مغلقة — قبول بصمة المضيف تلقائياً (موثق في README)
    };

    return new Promise((resolve, reject) => {
        const conn = new Client();
        let settled = false;
        const finish = (fn, arg) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { conn.end(); } catch { /* تجاهل */ }
            fn(arg);
        };
        const timer = setTimeout(
            () => finish(reject, new Error(mapSshError(new Error(`SSH ${device.ip_address} timed out after ${SSH_TIMEOUT_MS}ms`)))),
            SSH_TIMEOUT_MS + 2000
        );
        conn.on('error', (e) => finish(reject, new Error(mapSshError(e))));
        conn.on('ready', () => {
            const results = [];
            const runNext = (i) => {
                if (i >= commands.length) return finish(resolve, results);
                conn.exec(commands[i], (err, stream) => {
                    if (err) {
                        results.push('');
                        return runNext(i + 1);
                    }
                    let out = '';
                    stream.on('data', (d) => { out += d.toString('utf8'); });
                    stream.stderr.on('data', () => { /* تجاهل */ });
                    stream.on('close', () => {
                        results.push(out);
                        runNext(i + 1);
                    });
                });
            };
            runNext(0);
        });
        conn.connect(cfg);
    });
}

/** هل المخرجات تحوي رسالة أمر غير معروف (مثلاً router بلا حزمة wireless)؟ */
function extractCommandErrors(outputText) {
    const errors = [];
    for (const line of String(outputText || '').split(/\r?\n/)) {
        if (/bad command name|no such item|unknown parameter/i.test(line)) {
            errors.push(`أمر غير مدعوم على هذا الراوتر: ${line.trim().slice(0, 100)}`);
        }
    }
    return errors;
}

/**
 * بناء entries النيبرز من مخرجات SSH (دالة نقية — تُغطى بالاختبارات)
 * @param {string} interfaceText مخرجات /interface print terse
 * @param {string} neighborText مخرجات /ip neighbor print terse
 * @returns {{entries: Array}}
 */
function entriesFromSshOutput(interfaceText, neighborText) {
    // عناوين MAC للراوتر نفسه — لاستبعاد الراوتر من النتائج فقط (لا تضيف أي جهاز)
    const interfaces = parseTerse(interfaceText);
    const ownMacs = new Set(
        interfaces
            .map((i) => String(i['mac-address'] || '').trim().toUpperCase().replace(/-/g, ':'))
            .filter((mac) => MAC_RE.test(mac))
    );

    // المصدر الوحيد: تبويب Neighbors (MNDP/LLDP) — حرفياً ما يظهر في Winbox
    const neighbors = parseTerse(neighborText);
    const entries = [];
    for (const row of neighbors) {
        const mac = String(row['mac-address'] || '').trim().toUpperCase().replace(/-/g, ':');
        if (!MAC_RE.test(mac) || ownMacs.has(mac)) continue;
        entries.push({
            mac,
            ip: row.address || null,
            hostname: row.identity || row['board-name'] || null,
            interface: row.interface || null,
            source: 'neighbor',
        });
    }
    return { entries };
}

/** قراءة بيانات الاكتشاف عبر SSH — نفس عقد fetchDiscoveryData في وضع api */
async function fetchDiscoveryDataSsh(device) {
    const outputs = await runCommands(device, [
        '/interface print terse without-paging',
        '/ip neighbor print terse without-paging',
    ]);
    const errors = outputs.flatMap(extractCommandErrors);
    const { entries } = entriesFromSshOutput(outputs[0] || '', outputs[1] || '');
    return { entries, errors };
}

/** اختبار الاتصال عبر SSH — يقرأ هوية الراوتر (/system identity) */
async function testConnectionSsh(device) {
    const outputs = await runCommands(device, ['/system identity print without-paging']);
    const row = parseColonOutput(outputs[0]);
    if (!row.name) {
        return { success: false, error: `استجابة غير متوقعة من الراوتر: ${(outputs[0] || '').trim().slice(0, 120)}` };
    }
    return { success: true, identity: row.name };
}

/** قراءة موارد الجهاز الحية عبر SSH (/system resource) — نفس عقد getResources */
async function getResourcesSsh(device) {
    const outputs = await runCommands(device, ['/system resource print without-paging']);
    const row = parseColonOutput(outputs[0]);
    const num = (v) => {
        if (v === undefined || v === null) return null;
        const n = Number(String(v).replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? n : null;
    };
    const freeMemory = num(row['free-memory']);
    const totalMemory = num(row['total-memory']);
    return {
        cpu_load: num(row['cpu-load']),
        free_memory_mb: freeMemory != null ? Math.round(freeMemory / 1048576) : null,
        total_memory_mb: totalMemory != null ? Math.round(totalMemory / 1048576) : null,
        uptime: row.uptime || null,
        version: row.version || null,
        board_name: row['board-name'] || null,
        architecture: row['architecture-name'] || null,
    };
}

/** قراءة SSID للواجهة اللاسلكية الشغالة عبر SSH — null إن لم توجد حزمة wireless */
async function getSSIDSsh(device) {
    const outputs = await runCommands(device, [
        '/interface wireless print terse where running without-paging',
    ]);
    if (extractCommandErrors(outputs[0]).length) return null;
    const rows = parseTerse(outputs[0]);
    const running = rows.find((r) => r.ssid);
    return (running && running.ssid) || null;
}

module.exports = {
    parseTerse,
    parseColonOutput,
    mapSshError,
    runCommands,
    entriesFromSshOutput,
    fetchDiscoveryDataSsh,
    testConnectionSsh,
    getResourcesSsh,
    getSSIDSsh,
};
