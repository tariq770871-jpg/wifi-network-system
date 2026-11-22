// سكربت شامل: قاعدة بيانات + ترحيلات + seed + خادم + اختبار API + Jest
// يعمل كل شيء في عملية واحدة كي لا تُقتل العمليات الخلفية بين الأوامر
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const BACKEND = __dirname;
const PGDATA = path.join(BACKEND, '.pgdata');
const DEV_PORT = 3000;

const SECTION = (t) => console.log('\n' + '='.repeat(60) + '\n== ' + t + '\n' + '='.repeat(60));

// ---------- 1) قراءة .env ----------
const envText = fs.readFileSync(path.join(BACKEND, '.env'), 'utf8');
const envFile = {};
for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) envFile[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const urlMatch = (envFile.DATABASE_URL || '').match(/^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/(.+?)(\?.*)?$/);
if (!urlMatch) { console.error('DATABASE_URL غير صالح'); process.exit(1); }
const [, dbUser, dbPass, dbHost, dbPortS, dbName] = urlMatch;
const dbPort = parseInt(dbPortS, 10);
const devUrl = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;
const testDbName = dbName + '_test';
const testUrl = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${testDbName}`;

// ---------- 2) تشغيل PostgreSQL المدمج ----------
async function main() {
    SECTION('1) تشغيل PostgreSQL المدمج');
    const mod = await import('embedded-postgres');
    const EmbeddedPostgres = mod.default || mod;
    const pg = new EmbeddedPostgres({
        databaseDir: PGDATA, user: dbUser, password: dbPass, port: dbPort, persistent: true,
        onError: (msg) => process.stderr.write('[pg] ' + msg),
    });
    if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) {
        console.log('[db] initdb...');
        await pg.initialise();
    }
    await pg.start();
    console.log(`[db] PostgreSQL جاهز على ${dbHost}:${dbPort}`);
    for (const name of [dbName, testDbName]) {
        try { await pg.createDatabase(name); console.log(`[db] أُنشئت قاعدة ${name}`); }
        catch (e) { if (!/already exists/i.test(e.message || '')) console.warn(`[db] ${name}:`, e.message); }
    }

    // ---------- 3) الترحيلات على قاعدة التطوير (داخل العملية) ----------
    SECTION('2) الترحيلات (migrate) على قاعدة التطوير');
    process.env.DATABASE_URL = devUrl;
    process.env.NODE_ENV = 'development';
    process.env.PORT = String(DEV_PORT);
    const { migrate } = require(path.join(BACKEND, 'src/shared/db/migrate'));
    try {
        await migrate();
    } catch (e) {
        console.error('❌ فشل الترحيل:', e.code, e.message || '(رسالة فارغة)', e.stack?.split('\n')[0]);
        throw e;
    }

    // ---------- 4) Seed (عملية منفصلة بقيم من .env) ----------
    SECTION('3) إنشاء المدير (seed)');
    const seedEnv = { ...process.env, DATABASE_URL: devUrl, ADMIN_USERNAME: envFile.ADMIN_USERNAME || 'admin', ADMIN_PASSWORD: envFile.ADMIN_PASSWORD || '', ADMIN_FULL_NAME: envFile.ADMIN_FULL_NAME || 'Administrator' };
    const seedRes = spawnSync('node', ['src/shared/db/seed.js'], { cwd: BACKEND, env: seedEnv, encoding: 'utf8', timeout: 60000 });
    console.log((seedRes.stdout || '').trim());
    if (seedRes.status !== 0) console.error('seed stderr:', (seedRes.stderr || '').slice(0, 500));

    // ---------- 5) تشغيل الخادم داخل العملية ----------
    SECTION('4) تشغيل الخادم على المنفذ ' + DEV_PORT);
    const { server } = require(path.join(BACKEND, 'src/app.js'));
    await new Promise((res) => server.listen(DEV_PORT, res));
    console.log(`[api] الخادم يستمع على http://localhost:${DEV_PORT}`);

    // ---------- 6) اختبار API يدوي ----------
    SECTION('5) اختبار الـ API يدوياً');
    const BASE = `http://localhost:${DEV_PORT}`;
    const results = [];
    const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`); };

    // a) health
    const h = await fetch(`${BASE}/health`);
    const hj = await h.json().catch(() => ({}));
    check('GET /health', h.status === 200 && hj.db === 'ok', `status=${h.status} db=${hj.db} migration=${hj.migration}`);

    // b) دخول خاطئ يجب أن يُرفض
    const bad = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: envFile.ADMIN_USERNAME || 'admin', password: 'wrong-pass-123' }) });
    check('POST login بكلمة مرور خاطئة يُرفض', bad.status === 401 || bad.status === 400, `status=${bad.status}`);

    // c) دخول صحيح بكوكيز HttpOnly
    const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: envFile.ADMIN_USERNAME || 'admin', password: envFile.ADMIN_PASSWORD }) });
    const cookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [];
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    const httpOnly = tokenCookie ? /httponly/i.test(tokenCookie) : false;
    check('POST login صحيح', login.status === 200, `status=${login.status}`);
    check('كوكي الجلسة HttpOnly', !!tokenCookie && httpOnly, tokenCookie ? tokenCookie.split(';')[0].slice(0, 12) + '... HttpOnly=' + httpOnly : 'لا كوكي!');

    // d) /me بكوكي
    if (tokenCookie) {
        const me = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: tokenCookie.split(';')[0] } });
        const mej = await me.json().catch(() => ({}));
        const uname = mej?.data?.user?.username || mej?.user?.username || mej?.data?.username;
        check('GET /api/auth/me بكوكي الجلسة', me.status === 200, `status=${me.status} user=${uname || '?'}`);
    }

    // e) swagger
    const sw = await fetch(`${BASE}/api-docs/`);
    check('GET /api-docs (Swagger)', sw.status === 200, `status=${sw.status}`);

    // ---------- 7) اختبارات Jest على قاعدة الاختبار ----------
    SECTION('6) الاختبارات الآلية (Jest) على قاعدة منفصلة');
    const jestEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl };
    // تشغيل Jest عبر node مباشرة (متوافق مع Windows وLinux دون الاعتماد على npx)
    const jestBin = path.join(BACKEND, 'node_modules', 'jest', 'bin', 'jest.js');
    const jestChild = spawn(process.execPath, [jestBin, '--runInBand'], { cwd: BACKEND, env: jestEnv });
    let jestOut = '';
    jestChild.stdout.on('data', (d) => { jestOut += d.toString(); });
    jestChild.stderr.on('data', (d) => { jestOut += d.toString(); });
    const jestDone = new Promise((resolve) => {
        const killer = setTimeout(() => { console.log('[jest] مهلة 8 دقائق — إيقاف'); try { jestChild.kill('SIGKILL'); } catch {} resolve(); }, 8 * 60 * 1000);
        jestChild.on('close', () => { clearTimeout(killer); resolve(); });
    });
    await jestDone;
    const lines = jestOut.split('\n');
    const tail = lines.slice(-45).join('\n');
    console.log(tail);
    const passMatch = jestOut.match(/Tests:\s+([^\n]+)/);
    if (passMatch) console.log('\n>>> ملخص Jest:', passMatch[1].trim());

    // ---------- 8) الخلاصة والتنظيف ----------
    SECTION('7) الخلاصة النهائية');
    const failed = results.filter((r) => !r.ok);
    console.log(`نتائج فحص API: ${results.length - failed.length}/${results.length} ناجحة`);
    process.stderr.write('[cleanup] إيقاف الخادم وقاعدة البيانات...\n');
    try { server.closeAllConnections?.(); } catch {}
    try { await new Promise((r) => server.close(r)); } catch {}
    try { await pg.stop(); } catch {}
    process.exit(failed.length === 0 ? 0 : 2);
}

main().catch(async (e) => {
    console.error('\n[FATAL]', e.code || '', e.message || '(رسالة فارغة)');
    console.error(e.stack?.split('\n').slice(0, 6).join('\n'));
    process.exit(1);
});
