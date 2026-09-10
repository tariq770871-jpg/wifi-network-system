/**
 * Seed Script - إنشاء أول مستخدم admin
 * =====================================
 * SECURITY: الطريقة الوحيدة لإنشاء admin — تعمل من الخادم فقط.
 *
 * الاستخدام:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='كلمة-مرور-قوية' ADMIN_FULL_NAME='مدير النظام' npm run seed
 *
 * أو مع القيم الافتراضية (للتطوير فقط - سيطبع كلمة مرور عشوائية):
 *   npm run seed
 *
 * Idempotent: لا يفعل شيئاً إذا كان admin موجوداً مسبقاً (ما لم يُمرر --force)
 */
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

async function seed() {
    const force = process.argv.includes('--force');

    // هل يوجد admin مسبقاً؟
    const existingAdmins = await pool.query(
        "SELECT id, username FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existingAdmins.rows.length > 0 && !force) {
        console.log(`✅ يوجد admin مسبقاً (username: ${existingAdmins.rows[0].username}) - لا حاجة للـ seed`);
        console.log('   لإنشاء admin إضافي: npm run seed -- --force');
        return;
    }

    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    const fullName = (process.env.ADMIN_FULL_NAME || 'مدير النظام').trim();
    let password = process.env.ADMIN_PASSWORD;

    const generated = !password;
    if (generated) {
        // كلمة مرور عشوائية آمنة (16 حرفاً)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
        password = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    if (password.length < 8) {
        console.error('❌ ADMIN_PASSWORD يجب أن تكون 8 أحرف على الأقل');
        process.exit(1);
    }

    // هل اسم المستخدم محجوز؟
    const taken = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (taken.rows.length > 0) {
        console.error(`❌ اسم المستخدم "${username}" محجوز مسبقاً - اختر اسماً آخر عبر ADMIN_USERNAME`);
        process.exit(1);
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
        "INSERT INTO users (username, hashed_password, full_name, role) VALUES ($1, $2, $3, 'admin') RETURNING id, username, full_name, role",
        [username, hashed, fullName]
    );

    console.log('🎉 تم إنشاء المدير الأول بنجاح:');
    console.log(`   id:       ${result.rows[0].id}`);
    console.log(`   username: ${result.rows[0].username}`);
    console.log(`   full_name: ${result.rows[0].full_name}`);
    console.log(`   role:     ${result.rows[0].role}`);
    if (generated) {
        console.log('');
        console.log(`🔑 كلمة المرور المؤقتة (احفظها الآن - لن تُعرض مجدداً): ${password}`);
        console.log('   ⚠️  غيّرها فوراً بعد أول دخول عبر PUT /api/auth/password');
    } else {
        console.log('🔑 كلمة المرور: (المعينة عبر ADMIN_PASSWORD)');
    }
}

seed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Seed failed:', err.message);
        process.exit(1);
    });
