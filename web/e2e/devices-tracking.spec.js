// E2E: تبويب الأجهزة + مسار GPS (صفحة التتبع للفني)
// --------------------------------------------------
// تتطلب API على :3000 (postgres حقيقي) + حسابات scripts/e2e_seed.mjs
import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL || 'http://localhost:3000/api'
const E2E_USER = 'e2e_runner'
const E2E_PASS = 'E2ePass@2026'

let created = false

async function ensureUser(request) {
  if (created) return
  // التسجيل العام مغلق — الحساب من البذرة؛ نتحقق بالدخول API
  const res = await request.post(`${API}/auth/login`, {
    data: { username: E2E_USER, password: E2E_PASS },
  })
  if (res.status() !== 200) {
    throw new Error(`حساب ${E2E_USER} غير جاهز (${res.status()}) — شغّل: node /home/z/my-project/scripts/e2e_seed.mjs`)
  }
  created = true
}

async function loginViaUI(page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill(E2E_USER)
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(E2E_PASS)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForURL('/')
}

test.describe('تبويب الأجهزة', () => {
  test('رابط الأجهزة ظاهر في القائمة وصفحتها تعمل بالبحث والتصفية', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    await page.getByRole('link', { name: 'الأجهزة', exact: true }).click()
    await page.waitForURL('/devices')
    await expect(page.getByRole('heading', { name: 'الأجهزة' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'بحث في الأجهزة' })).toBeVisible()
    await expect(page.getByLabel('تصفية بالحالة')).toBeVisible()
    await expect(page.getByLabel('تصفية بالنوع')).toBeVisible()
    await expect(page.getByLabel('تصفية بمصدر الإحداثية')).toBeVisible()
  })

  test('الفني يقرأ فقط — بلا زر إضافة جهاز', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    await page.goto('/devices')
    await expect(page.getByRole('heading', { name: 'الأجهزة' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'إضافة جهاز' })).toHaveCount(0)
  })

  test('البحث النصي لا يكسر الصفحة عند نص بلا نتائج', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    await page.goto('/devices')
    await page.getByRole('textbox', { name: 'بحث في الأجهزة' }).fill('no_such_device_xyz_999')
    // إما "لا توجد أجهزة مطابقة" أو قائمة فارغة — المهم لا انهيار
    await page.waitForTimeout(800)
    await expect(page.getByRole('heading', { name: 'الأجهزة' })).toBeVisible()
  })
})

test.describe('مسار GPS — صفحة التتبع للفني', () => {
  test('الفني يصل لصفحة التتبع ويجد زر البث وبطاقة الحالة', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    await page.getByRole('link', { name: 'التتبع الحي' }).click()
    await page.waitForURL('/tracking')
    await expect(page.getByRole('button', { name: 'بدء البث' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'البث متوقف' })).toBeVisible()
  })

  test('تحذير مبكر يظهر عندما يكون التتبع غير مفعّل (من /tracking/status)', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    // الحساب الجديد tracking_enabled=false افتراضياً → السبب يظهر قبل أي محاولة بث
    await page.goto('/tracking')
    await page.waitForTimeout(1000)
    await expect(page.getByText(/لا يمكنك البث حالياً/)).toBeVisible()
    await expect(page.getByText(/التتبع غير مفعّل لحسابك/)).toBeVisible()
  })

  test('بدء البث دون إذن موقع يعرض خطأ الإذن ولا يدّعي النشاط', async ({ page, request }) => {
    await ensureUser(request)
    await loginViaUI(page)
    await page.goto('/tracking')
    // headless: إذن الموقع مرفوض افتراضياً — يجب أن تظهر الرسالة بدل إخفائها
    await page.getByRole('button', { name: 'بدء البث' }).click()
    await page.waitForTimeout(2500)
    // الحالة لا تقول "GPS نشط" إطلاقاً بدون حفظ ناجح
    await expect(page.getByText('GPS نشط')).toHaveCount(0)
    // إما خطأ إذن المتصفح أو رفض الخادم — كلاهما معروض للمستخدم
    const errorShown = await page.getByText(/مشكلة في تحديد الموقع|رفض الخادم|إذن الموقع/).first().isVisible()
      .catch(() => false)
    expect(errorShown).toBeTruthy()
  })
})
