/**
 * Discovery Service — جلب الأجهزة تلقائياً من أجهزة MikroTik المرتبطة
 * -------------------------------------------------------------------
 * كيف تصل بيانات الأجهزة من الميكروتك إلى داخل التطبيق:
 *  1) يجلب من قاعدة البيانات كل راوتر مرتبط بـ MikroTik (له IP + مستخدم + كلمة مرور محفوظة)
 *  2) يتصل به عبر RouterOS API (منفذ 8728 — نفس بيانات Winbox) ويقرأ:
 *     - /ip neighbor → ما يظهر في تبويب Neighbors في Winbox — المصدر الوحيد
 *     قرار صريح بطلب صاحب النظام: لا الأكتيف (registration-table)، لا قوة الإشارة،
 *     لا ARP، لا DHCP — لا شيء يتدخل في هذا الموضوع غير النيبرز
 *  3) يحفظ النتائج حسب عنوان MAC في جدول devices
 *     (جديد → يضاف تلقائياً | موجود → يُحدَّث ويصبح online مع last_seen = الآن)
 *  4) الأجهزة التي كانت ظاهرة سابقاً ولم تعد تظهر في النيبرز → status = offline
 *     مع الاحتفاظ بـ last_seen حتى تعمل فلاتر "المنقطعة خلال 24 ساعة"
 *     و"المنقطعة أكثر من 24 ساعة" في تبويب الأجهزة
 *
 * المزامنة تعمل بطريقتين:
 *  - يدوياً: زر "جلب أجهزة MikroTik" في تبويب الأجهزة (POST /api/devices/discovery/sync)
 *  - تلقائياً: مجدول داخلي كل X دقيقة (يُضبط من PUT /api/devices/discovery/settings)
 */
const { query, pool } = require('../../shared/db');
const mikrotik = require('./mikrotik.service');

const SETTINGS_KEY = 'discovery_auto_interval_minutes';
const MAX_NAME_LEN = 100;

let syncTimer = null;
let syncBusy = false;

/** قراءة فاصل المزامنة التلقائية بالدقائق (0 = موقفة) */
async function getAutoIntervalMinutes() {
    try {
        const r = await query('SELECT value FROM app_settings WHERE key = $1', [SETTINGS_KEY]);
        const n = Number(r.rows[0] && r.rows[0].value);
        if (Number.isFinite(n)) return Math.max(0, Math.min(1440, Math.round(n)));
    } catch {
        // الجدول قد لا يكون موجوداً بعد (قبل الترحيل) — نعاملها كأنها موقفة
    }
    return 0;
}

/** حفظ فاصل المزامنة التلقائية وإعادة جدولة المؤقت فوراً */
async function setAutoIntervalMinutes(minutes) {
    const value = Math.max(0, Math.min(1440, Math.round(Number(minutes) || 0)));
    await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [SETTINGS_KEY, String(value)]
    );
    await startScheduler();
    return value;
}

/** بدء/إعادة جدولة المؤقت حسب الإعداد المخزن — تُستدعى عند إقلاع الخادم وبعد تغيير الإعداد */
async function startScheduler() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
    const minutes = await getAutoIntervalMinutes();
    if (minutes > 0) {
        syncTimer = setInterval(() => {
            syncAllRouters('auto').catch((e) =>
                console.error('[Discovery] فشلت المزامنة التلقائية:', e.message)
            );
        }, minutes * 60 * 1000);
        console.log(`[Discovery] المزامنة التلقائية للأجهزة من MikroTik كل ${minutes} دقيقة`);
    }
    return minutes;
}

/** اسم تلقائي للجهاز الجديد: اسم الشبكة (hostname) إن وجد وإلا IP أو MAC */
function buildAutoName(entry) {
    const base = (entry.hostname && String(entry.hostname).trim())
        || `جهاز ${entry.ip || entry.mac}`;
    return base.slice(0, MAX_NAME_LEN);
}

/**
 * المزامنة الكاملة: كل راوتر مرتبط → قراءة الأجهزة → حفظ + تعليم المنقطعين
 * @param {'manual'|'auto'} trigger مصدر التشغيل
 * @returns {Promise<object>} ملخص العملية (إحصاءات + أخطاء كل راوتر)
 */
async function syncAllRouters(trigger = 'manual') {
    if (syncBusy) return { busy: true };
    syncBusy = true;
    const started = Date.now();
    const summary = {
        trigger,
        routers_total: 0,
        routers_ok: 0,
        routers_failed: 0,
        seen_count: 0,
        new_count: 0,
        updated_count: 0,
        offline_count: 0,
        errors: [],
        log_id: null,
    };

    try {
        // الراوترات المرتبطة (IP + مستخدم + كلمة مرور محفوظة) — تشمل موقعها لتوريث site_id
        const routersRes = await query(
            `SELECT id, name, ip_address, site_id, mikrotik_api_port, mikrotik_username, mikrotik_password_encrypted, mikrotik_mode
             FROM devices
             WHERE is_mikrotik_linked = true
               AND ip_address IS NOT NULL AND ip_address <> ''
               AND mikrotik_password_encrypted IS NOT NULL`
        );
        const routers = routersRes.rows;
        summary.routers_total = routers.length;

        // سجل العملية — يظهر في GET /discovery/status وتبويب الأجهزة
        const logRes = await query(
            `INSERT INTO discovery_sync_log (status, trigger_type, routers_total)
             VALUES ('running', $1, $2) RETURNING id`,
            [trigger, routers.length]
        );
        summary.log_id = logRes.rows[0].id;

        if (routers.length === 0) {
            summary.errors.push('لا يوجد راوتر مرتبط بـ MikroTik — اربط الراوتر من تعديل الجهاز (IP + مستخدم + كلمة مرور)');
        }

        // الاتصال بكل راوتر وجمع الأجهزة المكتشفة
        const allEntries = [];
        for (const router of routers) {
            try {
                const { entries, errors } = await mikrotik.fetchDiscoveryData(router);
                summary.routers_ok += 1;
                for (const e of errors) summary.errors.push(`${router.ip_address} → ${e}`);
                for (const entry of entries) {
                    allEntries.push({
                        ...entry,
                        router_site_id: router.site_id,
                        discovered_from: router.ip_address,
                    });
                }
            } catch (e) {
                summary.routers_failed += 1;
                summary.errors.push(`${router.ip_address} (${router.name}): ${e.message}`);
            }
        }

        // حماية مهمة: إذا فشل الاتصال بكل الراوترات لا نعلّم الأجهزة بالانقطاع
        // (قد يكون الانقطاع في اتصال الخادم بالراوتر وليس في الشبكة نفسها)
        if (summary.routers_ok > 0) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const entry of allEntries) {
                    const mac = entry.mac;
                    const ip = entry.ip ? String(entry.ip).slice(0, 45) : null;
                    const host = entry.hostname ? String(entry.hostname).trim().slice(0, 100) || null : null;
                    const iface = entry.interface ? String(entry.interface).slice(0, 100) : null;
                    // لا قوة إشارة نهائياً (قرار صاحب النظام) — أي قيمة قديمة محفوظة تُمسح عند كل مزامنة

                    const existing = await client.query(
                        'SELECT id FROM devices WHERE UPPER(mac_address) = $1 LIMIT 1',
                        [mac]
                    );

                    if (existing.rows.length > 0) {
                        // جهاز موجود: تحديث بياناته + شغال الآن (آخر ظهور = الآن)
                        await client.query(
                            `UPDATE devices SET
                                ip_address = COALESCE($2, ip_address),
                                hostname = COALESCE($3, hostname),
                                interface_name = $4,
                                signal_strength = NULL,
                                discovery_source = $5,
                                discovered_from = $6,
                                site_id = COALESCE(site_id, $7),
                                status = CASE WHEN status = 'maintenance' THEN 'maintenance' ELSE 'online' END,
                                last_seen = NOW(),
                                discovery_updated_at = NOW(),
                                updated_at = NOW()
                             WHERE id = $1`,
                            [existing.rows[0].id, ip, host, iface,
                             entry.source, entry.discovered_from, entry.router_site_id]
                        );
                        summary.updated_count += 1;
                    } else {
                        // جهاز جديد لم يُسجل في التطبيق — يضاف تلقائياً (IP أو MAC يظهران في البطاقة)
                        await client.query(
                            `INSERT INTO devices (name, device_type, mac_address, ip_address, hostname,
                                                  interface_name, discovery_source,
                                                  discovered_from, site_id, status, is_auto_discovered,
                                                  last_seen, discovery_updated_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'online', true, NOW(), NOW())`,
                            [buildAutoName(entry),
                             // أجهزة النيبرز (MNDP/LLDP) راوترات/سويتشات مجاورة غالباً
                             'router',
                             mac, ip, host, iface,
                             entry.source, entry.discovered_from, entry.router_site_id]
                        );
                        summary.new_count += 1;
                    }
                    summary.seen_count += 1;
                }

                // تعليم الأجهزة المكتشفة سابقاً ولم تعد تظهر في هذا المسح — انقطعت الآن
                // (last_seen تبقى كما هي — منها تُبنى فلاتر الانقطاع 24 ساعة / أكثر)
                const macs = summary.seen_count > 0
                    ? allEntries.map((e) => e.mac)
                    : ['__none__'];
                const offRes = await client.query(
                    `UPDATE devices SET status = 'offline', updated_at = NOW()
                     WHERE status = 'online'
                       AND (is_auto_discovered = true OR discovery_source IS NOT NULL)
                       AND (mac_address IS NULL OR UPPER(mac_address) <> ALL($1::text[]))`,
                    [macs]
                );
                summary.offline_count = offRes.rowCount || 0;

                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK').catch(() => {});
                throw e;
            } finally {
                client.release();
            }
        }

        // تحديث سجل العملية: فشل تام إذا لم يستجب أي راوتر، جزئي إذا استجاب بعضها
        const logStatus = (summary.routers_total > 0 && summary.routers_ok === 0)
            ? 'failed'
            : (summary.routers_failed === 0 ? 'success' : 'partial');
        await query(
            `UPDATE discovery_sync_log SET
                finished_at = NOW(), status = $2, routers_ok = $3, routers_failed = $4,
                seen_count = $5, new_count = $6, updated_count = $7, offline_count = $8,
                error = $9, details = $10
             WHERE id = $1`,
            [summary.log_id, logStatus,
             summary.routers_ok, summary.routers_failed,
             summary.seen_count, summary.new_count, summary.updated_count, summary.offline_count,
             summary.errors.length ? summary.errors.join(' | ').slice(0, 2000) : null,
             JSON.stringify({ duration_ms: Date.now() - started })]
        );

        console.log(`[Discovery] مزامنة (${trigger}): ${summary.routers_ok}/${summary.routers_total} راوتر — ` +
            `${summary.seen_count} جهاز ظاهر، ${summary.new_count} جديد، ${summary.offline_count} انقطع`);
        return summary;
    } catch (e) {
        // فشل غير متوقع (قاعدة بيانات مثلاً) — يُسجل في السجل ثم يُعاد رميه
        if (summary.log_id) {
            await query(
                `UPDATE discovery_sync_log SET finished_at = NOW(), status = 'failed', error = $2 WHERE id = $1`,
                [summary.log_id, String(e.message).slice(0, 2000)]
            ).catch(() => {});
        }
        throw e;
    } finally {
        syncBusy = false;
    }
}

/** حالة المزامنة للعرض: الإعداد التلقائي + آخر عملية + عدد الراوترات المرتبطة */
async function getDiscoveryStatus() {
    const [interval, linked, last] = await Promise.all([
        getAutoIntervalMinutes(),
        query(
            `SELECT COUNT(*)::int AS n FROM devices
             WHERE is_mikrotik_linked = true
               AND ip_address IS NOT NULL AND ip_address <> ''
               AND mikrotik_password_encrypted IS NOT NULL`
        ),
        query(
            `SELECT id, started_at, finished_at, status, trigger_type, routers_total, routers_ok,
                    routers_failed, seen_count, new_count, updated_count, offline_count, error
             FROM discovery_sync_log ORDER BY id DESC LIMIT 1`
        ),
    ]);
    return {
        interval_minutes: interval,
        linked_routers: linked.rows[0].n,
        scheduler_active: interval > 0 && !!syncTimer,
        last_sync: last.rows[0] || null,
    };
}

module.exports = {
    syncAllRouters,
    startScheduler,
    getDiscoveryStatus,
    getAutoIntervalMinutes,
    setAutoIntervalMinutes,
};
