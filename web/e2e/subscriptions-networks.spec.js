// E2E: تبويبا الاشتراكات والشبكات (الجديدان)
// -------------------------------------------
// تغطي:
//   1) تبويب الاشتراكات ظاهر في القائمة وصفحتها تعمل (بطاقات + قائمة)
//   2) المدير يضيف اشتراكاً → يظهر فوراً في القائمة (مزامنة الحفظ)
//   3) بطاقة «تنتهي خلال 7 أيام» تظهر لاشتراك انتهائه قريب
//   4) الفني يرى الاشتراكات بلا زر إضافة (مدير/دعم فقط)
//   5) تبويب الشبكات ظاهر وصفحتها تعمل — المدير يضيف شبكة وتظهر فوراً
// تتطلب API على :3000 (postgres حقيقي) + حسابات scripts/e2e_seed.mjs
import { test, expect } from '@playwright/test'

const E2E_ADMIN = 'e2e_admin'
const E2E_ADMIN_PASS = 'E2eAdmin@2026'
const E2E_RUNNER = 'e2e_runner'
const E2E_RUNNER_PASS = 'E2ePass@2026'
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000/api'

const stamp = () => Date.now()

async function login(page, username, password) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill(username)
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForURL('/')
}

test.describe('تبويب الاشتراكات', () => {
  test('الصفحة تفتح ببطاقات الإحصاء وزر الإضافة للمدير', async ({ page }) => {
    await login(page, E2E_ADMIN, E2E_ADMIN_PASS)
    await page.getByRole('link', { name: 'الاشتراكات', exact: true }).click()
    await page.waitForURL('/subscriptions')

    // بطاقات الإحصاء الأربع ظاهرة
    await expect(page.getByText('نشطة', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('منتهية').first()).toBeVisible()
    await expect(page.getByText('تنتهي خلال 7 أيام').first()).toBeVisible()
    // زر الإضافة للمدير
    await expect(page.getByRole('button', { name: 'إضافة اشتراك' })).toBeVisible()
  })

  test('المدير يضيف اشتراكاً → يظهر في القائمة مباشرة', async ({ page }) => {
    await login(page, E2E_ADMIN, E2E_ADMIN_PASS)
    await page.getByRole('link', { name: 'الاشتراكات', exact: true }).click()
    await page.waitForURL('/subscriptions')

    const name = `عميل E2E ${stamp()}`
    await page.getByRole('button', { name: 'إضافة اشتراك' }).click()
    await page.getByRole('textbox', { name: 'اسم العميل *' }).fill(name)
    // السعر الشهري
    await page.getByRole('spinbutton', { name: 'السعر الشهري' }).fill('35')
    await page.getByRole('button', { name: 'إنشاء الاشتراك' }).click()

    // يظهر في القائمة فوراً + توست النجاح
    await expect(page.getByText('تم إنشاء الاشتراك')).toBeVisible()
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  })

  test('تنبيه «ينتهي خلال X يوم» يظهر على بطاقة اشتراك قريب الانتهاء', async ({ page }) => {
    // إنشاء اشتراك ينتهي بعد 3 أيام عبر API — لضمان وجود حالة التنبيه فعلاً
    const loginRes = await page.request.post(`${API_URL}/auth/login`, {
      data: { username: E2E_ADMIN, password: E2E_ADMIN_PASS },
    })
    const token = (await loginRes.json())?.data?.token
    expect(token).toBeTruthy()
    const end = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    const createRes = await page.request.post(`${API_URL}/subscriptions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { customer_name: `قريب الانتهاء ${stamp()}`, end_date: end, monthly_price: 10 },
    })
    expect(createRes.status()).toBe(201)

    await login(page, E2E_ADMIN, E2E_ADMIN_PASS)
    await page.getByRole('link', { name: 'الاشتراكات', exact: true }).click()
    await page.waitForURL('/subscriptions')
    // التنبيه يظهر على بطاقة الاشتراك القريب الانتهاء
    await expect(page.locator('p', { hasText: /ينتهي (اليوم|خلال)/ }).first()).toBeVisible({ timeout: 10000 })
  })

  test('الفني يرى الاشتراكات لكن بلا زر إضافة أو حذف', async ({ page }) => {
    await login(page, E2E_RUNNER, E2E_RUNNER_PASS)
    await page.getByRole('link', { name: 'الاشتراكات', exact: true }).click()
    await page.waitForURL('/subscriptions')

    await expect(page.getByRole('button', { name: 'إضافة اشتراك' })).toHaveCount(0)
    // التصفيح والبحث ظاهران
    await expect(page.getByRole('combobox', { name: 'تصفية بالحالة' })).toBeVisible()
  })
})

test.describe('تبويب الشبكات', () => {
  test('المدير يضيف شبكة WiFi → تظهر في القائمة مباشرة', async ({ page }) => {
    await login(page, E2E_ADMIN, E2E_ADMIN_PASS)
    await page.getByRole('link', { name: 'الشبكات', exact: true }).click()
    await page.waitForURL('/networks')

    const ssid = `E2E-Net-${stamp()}`
    await page.getByRole('button', { name: 'إضافة شبكة' }).click()
    await page.getByRole('textbox', { name: 'اسم الشبكة SSID *' }).fill(ssid)
    await page.getByRole('button', { name: 'إنشاء الشبكة' }).click()

    await expect(page.getByText('تم إنشاء الشبكة')).toBeVisible()
    await expect(page.getByText(ssid).first()).toBeVisible({ timeout: 10000 })
  })

  test('صفحة الشبكات تعمل للفني (قراءة) بلا زر إضافة', async ({ page }) => {
    await login(page, E2E_RUNNER, E2E_RUNNER_PASS)
    await page.getByRole('link', { name: 'الشبكات', exact: true }).click()
    await page.waitForURL('/networks')
    await expect(page.getByRole('button', { name: 'إضافة شبكة' })).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'تصفية بالحالة' })).toBeVisible()
  })
})
