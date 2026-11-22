// تشغيل PostgreSQL مدمج بنفس بيانات backend/.env (بدون طباعة أسرار)
// يعمل من داخل backend ليحل 'embedded-postgres' من node_modules الصحيح
const path = require('path');
const fs = require('fs');

const BACKEND_DIR = __dirname;
const PGDATA = path.join(BACKEND_DIR, '.pgdata');

// 1) قراءة .env يدوياً (بدون طباعة القيم)
const envText = fs.readFileSync(path.join(BACKEND_DIR, '.env'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL غير موجود في .env'); process.exit(1); }

// 2) تحليل الرابط: postgresql://user:pass@host:port/dbname
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/(.+?)(\?.*)?$/);
if (!m) { console.error('صيغة DATABASE_URL غير مفهومة'); process.exit(1); }
const [, user, password, host, portStr, dbname] = m;
const port = parseInt(portStr, 10);
console.log(`[db] سيتم تشغيل PostgreSQL على ${host}:${port} قاعدة="${dbname}" مستخدم="${user}" (كلمة المرور مخفية)`);

async function main() {
    const mod = await import('embedded-postgres');
    const EmbeddedPostgres = mod.default || mod.EmbeddedPostgres || mod;

    const pg = new EmbeddedPostgres({
        databaseDir: PGDATA,
        user,
        password,
        port,
        persistent: true,
        onError: (msg) => console.error('[pg]', msg),
    });

    const initialized = fs.existsSync(path.join(PGDATA, 'PG_VERSION'));
    if (!initialized) {
        console.log('[db] تهيئة عنقود بيانات جديد (initdb)...');
        await pg.initialise();
        console.log('[db] التهيئة تمت');
    } else {
        console.log('[db] عنقود البيانات موجود مسبقاً — تخطي initdb');
    }

    console.log('[db] تشغيل الخادم...');
    await pg.start();
    console.log(`[db] PostgreSQL يعمل الآن على المنفذ ${port}`);

    // إنشاء القاعدة إن لم تكن موجودة
    try {
        await pg.createDatabase(dbname);
        console.log(`[db] تم إنشاء قاعدة "${dbname}"`);
    } catch (e) {
        if (/already exists/i.test(e.message || '')) {
            console.log(`[db] قاعدة "${dbname}" موجودة مسبقاً`);
        } else {
            console.warn('[db] تعذر إنشاء القاعدة (قد تكون موجودة):', e.message);
        }
    }

    // إبقاء العملية حية
    setInterval(() => {}, 1 << 30);
}

main().catch((e) => { console.error('[db] فشل:', e); process.exit(1); });
