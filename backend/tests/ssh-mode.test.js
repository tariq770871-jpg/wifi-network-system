/**
 * اختبارات وضع SSH لـ MikroTik (RouterOS 6 — بديل عن خدمة api)
 * -------------------------------------------------------------
 * تغطي:
 *  - تحليل مخرجات `print terse` و`print` العادية (تحليل نقلي)
 *  - بناء entries النيبرز من مخرجات SSH (استبعاد MAC الراوتر، تحقق MAC)
 *  - ترجمة أخطاء SSH لرسائل عربية
 *  - تخزين/تحقق mikrotik_mode عبر API (api/ssh + رفض القيم غير الصالحة)
 *  - فرع وضع ssh في testConnection/fetchDiscoveryData (اتصال مرفوض سريع)
 */
const request = require('supertest');
const { app } = require('../src/app');
const { createAuthenticatedUser } = require('./helpers/auth');
const ssh = require('../src/modules/devices/routeros-ssh.service');
const mikrotik = require('../src/modules/devices/mikrotik.service');

// ─── عينات مخرجات حقيقية الشكل (RouterOS 6.x) ───
const V6_NEIGHBOR_TERSE = [
    ' 0 D address=192.168.10.20 mac-address=DC:2C:6E:E7:10:6B interface=ether2 identity="Main Router" board-name=hEX uptime=3w4d12:33:21',
    ' 1 D address=192.168.10.31 mac-address=E4:8D:8C:AA:BB:01 interface=bridge identity="Sector-2 AP" board-name="SXTsq 5 ac"',
    ' 2 D address= mac-address=48-8F-5A-99-00-11 interface=ether3 identity=Laptop-HP',
    ' 3 D mac-address=ZZ:11:22:33:44:55 interface=ether4 identity=broken-mac',
    ' 4 D address=192.168.10.99 mac-address=DC:2C:6E:E7:10:6B interface=ether2 identity=Router-Again',
].join('\n');

const V6_INTERFACE_TERSE = [
    ' 0 R name=ether1 type=ether mtu=1500 mac-address=DC:2C:6E:E7:10:6B',
    ' 1 R name=ether2 type=ether mtu=1500 mac-address=DC:2C:6E:E7:10:6C',
    ' 2 R name=wlan1 type=wlan mtu=1500 mac-address=DC:2C:6E:E7:10:6D ssid="Net-1"',
].join('\n');

describe('SSH transport: parsing (parseTerse)', () => {
    test('يحلل أزواج key=value مع قيم مقتبسة تحتوي مسافات', () => {
        const rows = ssh.parseTerse(V6_NEIGHBOR_TERSE);
        expect(rows).toHaveLength(5);
        expect(rows[0].address).toBe('192.168.10.20');
        expect(rows[0].identity).toBe('Main Router');
        expect(rows[1].identity).toBe('Sector-2 AP');
        expect(rows[1]['board-name']).toBe('SXTsq 5 ac');
        // MAC بصيغة شرطات تُحفظ كما هي هنا (التوحيد في entriesFromSshOutput)
        expect(rows[2]['mac-address']).toBe('48-8F-5A-99-00-11');
    });

    test('يتجاهل الأسطر الفارغة وأسطر الأعمدة والرسائل بلا key=value', () => {
        const text = ['', '#  INTERFACE  ADDRESS4  MAC-ADDRESS', 'bad command name xyz (line 1 column 1)', V6_NEIGHBOR_TERSE].join('\n');
        const rows = ssh.parseTerse(text);
        expect(rows).toHaveLength(5);
    });

    test('نص فارغ يعيد مصفوفة فارغة', () => {
        expect(ssh.parseTerse('')).toEqual([]);
        expect(ssh.parseTerse(null)).toEqual([]);
    });
});

describe('SSH transport: parsing (parseColonOutput)', () => {
    test('يحلل مخرجات /system identity print', () => {
        const row = ssh.parseColonOutput('                  name: Main-Router\n');
        expect(row.name).toBe('Main-Router');
    });

    test('يحلل مخرجات /system resource print', () => {
        const text = [
            '                   uptime: 1w2d3h4m',
            '                  version: 6.48.6 (long-term)',
            '               board-name: hEX',
            '                 cpu-load: 7%',
            '             free-memory: 167772160',
            '            total-memory: 268435456',
        ].join('\n');
        const row = ssh.parseColonOutput(text);
        expect(row.uptime).toBe('1w2d3h4m');
        expect(row.version).toBe('6.48.6 (long-term)');
        expect(row['cpu-load']).toBe('7%');
    });
});

describe('SSH transport: entriesFromSshOutput', () => {
    test('يبني entries من النيبرز ويستبعد MAC الراوتر نفسه وMAC غير الصالح', () => {
        const { entries } = ssh.entriesFromSshOutput(V6_INTERFACE_TERSE, V6_NEIGHBOR_TERSE);
        // 5 سجلات: سجل 0 وسجل 4 (MAC الراوتر نفسه → مستبعدان)، سجل 3 (MAC غير صالح → مستبعد)
        expect(entries).toHaveLength(2);
        expect(entries[0]).toEqual({
            mac: 'E4:8D:8C:AA:BB:01',
            ip: '192.168.10.31',
            hostname: 'Sector-2 AP',
            interface: 'bridge',
            source: 'neighbor',
        });
        // MAC بالشرطات يُوحّد بنقطتين
        expect(entries[1].mac).toBe('48:8F:5A:99:00:11');
        expect(entries[1].ip).toBeNull(); // address فارغ → null
        // سجل identity=Laptop-HP بدون board-name
        expect(entries[1].hostname).toBe('Laptop-HP');
    });

    test('hostname يرجع board-name عند غياب identity', () => {
        const nb = ' 0 D address=10.0.0.5 mac-address=AA:BB:CC:DD:EE:0F interface=ether1 board-name=CRS328';
        const { entries } = ssh.entriesFromSshOutput('', nb);
        expect(entries[0].hostname).toBe('CRS328');
        // لا واجهات مررت → لا استبعاد
        expect(entries).toHaveLength(1);
    });
});

describe('SSH transport: mapSshError', () => {
    test('يرجم أخطاء SSH الشائعة لرسائل عربية', () => {
        expect(ssh.mapSshError(new Error('connect ECONNREFUSED 192.168.1.1:22'))).toContain('خدمة ssh');
        expect(ssh.mapSshError(new Error('Timed out'))).toContain('timed out');
        expect(ssh.mapSshError(new Error('All configured authentication methods failed'))).toContain('اسم المستخدم');
    });
});

describe('MikroTik mode branching (api/ssh)', () => {
    test('deviceMode: ssh فقط للقيمة ssh — الباقي api', () => {
        expect(mikrotik.deviceMode({ mikrotik_mode: 'ssh' })).toBe('ssh');
        expect(mikrotik.deviceMode({ mikrotik_mode: 'api' })).toBe('api');
        expect(mikrotik.deviceMode({ mikrotik_mode: null })).toBe('api');
        expect(mikrotik.deviceMode({})).toBe('api');
    });

    test('fetchDiscoveryData بوضع ssh على منفذ مغلق يفشل برسالة واضحة سريعة', async () => {
        const device = {
            ip_address: '127.0.0.1',
            mikrotik_api_port: 1, // منفذ مغلق — ECONNREFUSED فوري
            mikrotik_mode: 'ssh',
            mikrotik_username: 'monitor',
            mikrotik_password_encrypted: mikrotik.encryptPassword('x'),
        };
        await expect(mikrotik.fetchDiscoveryData(device)).rejects.toThrow(/خدمة ssh|SSH/);
    }, 15000);

    test('testConnection بوضع ssh عبر API يعيد فشلاً برسالة عربية (منفذ مغلق)', async () => {
        const { token } = await createAuthenticatedUser({ role: 'admin', prefix: 'sshm' });
        const created = await request(app)
            .post('/api/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: `SSH-Router-${Date.now()}`,
                device_type: 'router',
                ip_address: '127.0.0.1',
                is_mikrotik_linked: true,
                mikrotik_mode: 'ssh',
                mikrotik_api_port: 1,
                mikrotik_username: 'monitor',
                mikrotik_password: 'x',
            });
        expect(created.status).toBe(201);
        expect(created.body.data.mikrotik_mode).toBe('ssh');

        const res = await request(app)
            .post(`/api/devices/${created.body.data.id}/test`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(false);
        expect(res.body.data.error).toContain('ssh');
    }, 20000);
});

describe('MikroTik mode persistence via API', () => {
    let adminToken;

    beforeAll(async () => {
        ({ token: adminToken } = await createAuthenticatedUser({ role: 'admin', prefix: 'sshmode' }));
    });

    test('POST يحفظ mikrotik_mode=ssh والمنفذ المخصص', async () => {
        const res = await request(app)
            .post('/api/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: `SSH-Mode-${Date.now()}`,
                device_type: 'router',
                ip_address: '192.168.10.1',
                is_mikrotik_linked: true,
                mikrotik_mode: 'ssh',
                mikrotik_api_port: 2222,
                mikrotik_username: 'monitor',
                mikrotik_password: 'pw',
            });
        expect(res.status).toBe(201);
        expect(res.body.data.mikrotik_mode).toBe('ssh');
        expect(res.body.data.mikrotik_api_port).toBe(2222);
        global.__sshDeviceId = res.body.data.id;
    });

    test('PUT يحدّث الوضع إلى ssh وإلى api ويسحب قيمة واحدة للمنفذ الافتراضي', async () => {
        const id = global.__sshDeviceId;
        const put = await request(app)
            .put(`/api/devices/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ mikrotik_mode: 'ssh', mikrotik_api_port: 22 });
        expect(put.status).toBe(200);
        expect(put.body.data.mikrotik_mode).toBe('ssh');

        const back = await request(app)
            .put(`/api/devices/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ mikrotik_mode: 'api', mikrotik_api_port: 8728 });
        expect(back.status).toBe(200);
        expect(back.body.data.mikrotik_mode).toBe('api');
    });

    test('PUT بقيمة غير صالحة يرفض بـ 400', async () => {
        const id = global.__sshDeviceId;
        const res = await request(app)
            .put(`/api/devices/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ mikrotik_mode: 'telnet' });
        expect(res.status).toBe(400);
    });

    test('POST بقيمة غير صالحة يرفض بـ 400', async () => {
        const res = await request(app)
            .post('/api/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: `Bad-${Date.now()}`, mikrotik_mode: 'webfig' });
        expect(res.status).toBe(400);
    });

    test('PUT بقيمة غير صالحة (whatever) يرفض بـ 400 أيضاً — التحقق في المتحكم', async () => {
        const id = global.__sshDeviceId;
        const res = await request(app)
            .put(`/api/devices/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ mikrotik_mode: 'whatever' });
        expect(res.status).toBe(400);
    });
});
