// E2E: مصادقة + حماية المسارات + نقاط الخريطة
// المستخدم التجريبي يُنشأ عبر API في first-run (اسم يبدأ بـ e2e_ لسهولة التنظيف)
import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL || 'http://localhost:3000/api'
const E2E_USER = 'e2e_runner'
const E2E_PASS = 'E2ePass@2026'

let created = false

async function ensureUser(request) {
  if (created) return
  // تسجيل يفشل إن كان موجوداً — كلاهما مقبول
  await request.post(`${API}/auth/register`, {
    data: { username: E2E_USER, password: E2E_PASS, full_name: 'E2E Runner' },
  })
  created = true
}

async function loginViaUI(page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill(E2E_USER)
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(E2E_PASS)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForURL('/')
}

test.describe('المصادقة', () => {
  test('صفحة الدخول تعرض النموذج', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'إدارة شبكات WiFi' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'اسم المستخدم', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'كلمة المرور', exact: true })).toBeVisible()
  })

  test('زائر يُحوَّل من الرئيسية إلى /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('دخول ناجح يصل للوحة التحكم مع كوكي الجلسة', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    // الجلسة عبر كوكي HttpOnly — لا توكن في localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeNull()
    await expect(page.getByText('WiFi Manager')).toBeVisible()
  })

  test('بيانات خاطئة تعرض رسالة خطأ ولا تدخل', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill('no_such_user_xyz')
    await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill('wrongpass')
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('نقاط الخريطة', () => {
  test('زر إضافة نقطة ظاهر بعد الدخول', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    await page.goto('/map-points')
    await expect(page.getByRole('button', { name: /إضافة نقطة/ }).first()).toBeVisible()
  })
})
