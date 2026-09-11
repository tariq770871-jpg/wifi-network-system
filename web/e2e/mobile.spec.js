// E2E: تجربة الجوال (viewport هاتف) — القائمة الجانبية والتنقل والصفحات
// ----------------------------------------------------------------------
// تغطي:
//   1) الدخول من شاشة هاتف (iPhone 13) يعمل
//   2) القائمة الجانبية المخفية بـ visibility:hidden على الجوال (لا روابط نقر خفي)
//   3) زر الهامبرغر يفتح القائمة والتنقل للصفحات الجديدة سليم
//   4) صفحة الاشتراكات تعمل على الجوال بلا كسر تخطيط (لا تمرير أفقي)
//   5) صفحة الأجهزة تعمل على الجوال
// محاكاة هاتف على محرك الإنتاج (chromium): viewport الجهاز + touch + hasTouch
// (اسم الجهاز «iPhone 13» يستخدم webkit افتراضياً — غير مثبت محلياً — لذا نستخرج
//  أبعاد الجهاز ونفرض browserName chromium لاختبار التخطيط والتفاعل)
import { test, expect, devices } from '@playwright/test'

const E2E_ADMIN = 'e2e_admin'
const E2E_ADMIN_PASS = 'E2eAdmin@2026'

const iphone = devices['iPhone 13']
test.use({
  viewport: iphone.viewport,
  deviceScaleFactor: iphone.deviceScaleFactor,
  hasTouch: true,
  isMobile: true,
  userAgent: iphone.userAgent,
  locale: 'ar',
  browserName: 'chromium',
})

async function login(page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill(E2E_ADMIN)
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(E2E_ADMIN_PASS)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForURL('/')
  // انتظار صيّر Layout (Suspense lazy) — زر الهامبرغر معيار الجاهزية على الجوال
  await expect(page.getByRole('button', { name: 'فتح القائمة الجانبية' })).toBeVisible({ timeout: 15000 })
}

async function navigateMobile(page, linkName, path) {
  await page.getByRole('button', { name: 'فتح القائمة الجانبية' }).click()
  await page.getByRole('link', { name: linkName, exact: true }).click()
  await page.waitForURL(path)
}

test.describe('الجوال — iPhone 13', () => {
  test('الدخول من الجوال يصل للداشبورد', async ({ page }) => {
    await login(page)
    // عنوان الداشبورد الرئيسي (دقيق — strict mode: يوجد أيضاً عنوان جانبي)
    await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible()
  })

  test('القائمة تفتح بالهامبرغر والتنقل للاشتراكات سليم بلا تمرير أفقي', async ({ page }) => {
    await login(page)

    // قبل الفتح: الشريط الجانبي مخفي فعلياً (visibility:hidden — إصلاح الوصولية)
    const asideVisible = await page.evaluate(() => getComputedStyle(document.querySelector('aside')).visibility)
    expect(asideVisible).toBe('hidden')

    await navigateMobile(page, 'الاشتراكات', '/subscriptions')

    // الصفحة تعمل بلا تمرير أفقي (كسر تخطيط)
    const horizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    })
    expect(horizontalOverflow).toBe(false)
    // بطاقات الإحصاء ظاهرة
    await expect(page.getByText('نشطة', { exact: true }).first()).toBeVisible()
  })

  test('صفحة الأجهزة تعمل على الجوال مع البحث والتصدير', async ({ page }) => {
    await login(page)
    await navigateMobile(page, 'الأجهزة', '/devices')
    await expect(page.getByRole('textbox', { name: 'بحث في الأجهزة' })).toBeVisible()
    // التصدير متاح للأدوار كافة (قراءة)
    await expect(page.getByRole('button', { name: 'تصدير الأجهزة CSV' })).toBeVisible()
  })

  test('الشبكات تعمل على الجوال (التبويب الجديد)', async ({ page }) => {
    await login(page)
    await navigateMobile(page, 'الشبكات', '/networks')
    await expect(page.getByRole('heading', { name: 'الشبكات' })).toBeVisible()
  })
})
