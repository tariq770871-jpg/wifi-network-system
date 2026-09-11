// E2E: مزامنة التبويبات — الأجهزة ↔ الخريطة ↔ الداشبورد (Task 16)
// ------------------------------------------------------------------
// تغطي الشكوى الأصلية "أحفظ جهاز ولا يظهر" من كل زواياها:
//   1) حفظ جهاز من تبويب الأجهزة → يظهر في الشبكة فوراً
//   2) حفظ جهاز من نموذج الخريطة → يظهر في تبويب الأجهزة
//   3) الداشبورد يعرض بطاقات حالة الأجهزة
//   4) الخريطة ترسم علامات الأجهزة + الربط المتبادل للتفاصيل
// تتطلب API على :3000 (postgres حقيقي) + حساب e2e_admin من scripts/e2e_seed.mjs
import { test, expect } from '@playwright/test'

const E2E_ADMIN = 'e2e_admin'
const E2E_ADMIN_PASS = 'E2eAdmin@2026'
const E2E_USER = 'e2e_runner'
const E2E_PASS = 'E2ePass@2026'

const stamp = () => Date.now()

async function loginViaUI(page, username, password) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill(username)
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForURL('/')
}

const loginAdmin = (page) => loginViaUI(page, E2E_ADMIN, E2E_ADMIN_PASS)

test.describe('حفظ الجهاز من تبويب الأجهزة يظهر فوراً', () => {
  test('المدير يضيف جهازاً ويجده في البحث مباشرة', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'الأجهزة', exact: true }).click()
    await page.waitForURL('/devices')

    const name = `جهاز القائمة ${stamp()}`
    await page.getByRole('button', { name: 'إضافة جهاز' }).click()
    await page.getByLabel('اسم الجهاز').fill(name)
    await page.getByRole('button', { name: 'إضافة الجهاز', exact: true }).click()

    // رسالة النجاح تشير للمزامنة
    await expect(page.getByText(/تمت إضافة الجهاز/)).toBeVisible({ timeout: 8000 })
    // البطاقة تظهر في الشبكة فوراً (بدون إعادة تحميل صفحة)
    await page.getByRole('textbox', { name: 'بحث في الأجهزة' }).fill(name)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('حفظ الجهاز من نموذج الخريطة يصل لتبويب الأجهزة', () => {
  test('المدير يحفظ جهازاً من الخريطة فيظهر في تبويب الأجهزة وعلى الخريطة', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'نقاط الخريطة', exact: true }).click()
    await page.waitForURL('/map-points')

    await page.getByRole('button', { name: 'إضافة نقطة / جهاز' }).click()
    // انقر على الخريطة في موضع عشوائي (بعيداً عن علامات التشغيلات السابقة المكدسة بالمركز)
    const s = stamp()
    await page.locator('.leaflet-container').click({ position: { x: 140 + (s % 90), y: 110 + (s % 70) } })

    // النموذج يظهر → اختر "جهاز" (متاح للمدير)
    await expect(page.getByRole('button', { name: 'نقطة خريطة' })).toBeVisible()
    await page.getByRole('button', { name: 'جهاز', exact: true }).click()

    const name = `جهاز الخريطة ${s}`
    await page.getByLabel('اسم الجهاز').fill(name)
    await page.getByRole('button', { name: 'حفظ الجهاز' }).click()
    await expect(page.getByText(/تمت إضافة الجهاز/)).toBeVisible({ timeout: 8000 })

    // علامة الجهاز ترسم على الخريطة فوراً
    await expect(page.locator('.device-marker').first()).toBeVisible({ timeout: 10000 })

    // المزامنة العابرة: يظهر في تبويب الأجهزة
    await page.getByRole('link', { name: 'الأجهزة', exact: true }).click()
    await page.waitForURL('/devices')
    await page.getByRole('textbox', { name: 'بحث في الأجهزة' }).fill(name)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  })

  test('الفني يرى الأجهزة على الخريطة لكن لا يستطيع حفظ جهاز (مدير فقط)', async ({ page, request }) => {
    await request.post(`${process.env.E2E_API_URL || 'http://localhost:3000/api'}/auth/register`, {
      data: { username: E2E_USER, password: E2E_PASS, full_name: 'E2E Runner' },
    })
    await loginViaUI(page, E2E_USER, E2E_PASS)
    await page.goto('/map-points')
    await expect(page.locator('.device-marker').first()).toBeVisible({ timeout: 10000 })

    // افتح نموذج الإضافة → خيار الجهاز معطل للفني
    await page.getByRole('button', { name: 'إضافة نقطة / جهاز' }).click()
    const s = stamp()
    await page.locator('.leaflet-container').click({ position: { x: 150 + (s % 60), y: 130 + (s % 50) } })
    await expect(page.getByRole('button', { name: 'جهاز (مدير فقط)' })).toBeDisabled()
  })
})

test.describe('الداشبورد يعكس الأجهزة والنقاط', () => {
  test('بطاقات حالة الأجهزة وبطاقة النقاط المعلقة ظاهرة', async ({ page }) => {
    await loginAdmin(page)
    await expect(page.getByRole('heading', { name: 'حالة الأجهزة' })).toBeVisible()
    await expect(page.getByText('إجمالي الأجهزة')).toBeVisible()
    await expect(page.getByText('أجهزة متصلة')).toBeVisible()
    await expect(page.getByText('نقاط بانتظار المراجعة')).toBeVisible()
    // رابط التنقل المتبادل
    await expect(page.getByRole('link', { name: 'فتح تبويب الأجهزة ←' })).toBeVisible()
  })

  test('رابط بطاقة النقاط المعلقة ينقل لتبويب الخريطة', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'مراجعة نقاط الخريطة المعلقة' }).click()
    await page.waitForURL('/map-points')
    await expect(page.getByRole('heading', { name: /نقاط الخريطة والأجهزة/ })).toBeVisible()
  })
})

test.describe('الخريطة ترسم الأجهزة + الربط المتبادل', () => {
  test('علامات الأجهزة ظاهرة مع عدّاد الطبقة', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/map-points')
    await expect(page.getByText('طبقات الخريطة:')).toBeVisible()
    await expect(page.getByText(/الأجهزة \(\d+\)/)).toBeVisible()
    await expect(page.locator('.device-marker').first()).toBeVisible({ timeout: 10000 })
  })

  test('الربط المتبادل: تفاصيل الجهاز ← الخريطة ← popup ← العودة للتفاصيل', async ({ page }) => {
    await loginAdmin(page)

    // 1) أنشئ جهازاً بموقع معروف (تحديد الموقع بالنقر داخل خريطة النموذج)
    await page.getByRole('link', { name: 'الأجهزة', exact: true }).click()
    await page.waitForURL('/devices')
    const name = `ربط متبادل ${stamp()}`
    await page.getByRole('button', { name: 'إضافة جهاز' }).click()
    await page.getByLabel('اسم الجهاز').fill(name)
    // منتقي الموقع: خريطة النموذج الوحيدة في صفحة الأجهزة — انقر لتحديد موقع يدوي
    await page.locator('.leaflet-container').click({ position: { x: 130, y: 130 } })
    await expect(page.getByText(/تحديد يدوي/)).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'إضافة الجهاز', exact: true }).click()
    await expect(page.getByText(/تمت إضافة الجهاز/)).toBeVisible({ timeout: 8000 })

    // 2) افتح تفاصيله من البحث ثم «عرض على خريطة النظام»
    await page.getByRole('textbox', { name: 'بحث في الأجهزة' }).fill(name)
    await page.getByText(name).first().click()
    await expect(page.getByRole('button', { name: 'عرض على خريطة النظام' })).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'عرض على خريطة النظام' }).click()
    await page.waitForURL('/map-points')

    // 3) الخريطة تحلّق للجهاز وتفتح popup تلقائياً
    await expect(page.locator('.leaflet-popup').first()).toBeVisible({ timeout: 12000 })

    // 4) من popup العودة لتفاصيل الجهاز — حلقة الربط مكتملة
    await page.getByRole('button', { name: 'فتح تفاصيل الجهاز في تبويب الأجهزة' }).click()
    await page.waitForURL('/devices')
    await expect(page.getByRole('button', { name: 'عرض على خريطة النظام' })).toBeVisible({ timeout: 8000 })
  })
})
