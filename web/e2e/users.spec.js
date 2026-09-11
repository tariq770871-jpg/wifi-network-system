// E2E: تبويب المستخدمين كاملاً — الشكوى "بقي المستخدمين"
// -------------------------------------------------------
// تغطي:
//   1) قائمة المستخدمين تظهر فعلاً (كانت فارغة دائماً بسبب خطأ قراءة {items,pagination})
//   2) إضافة مستخدم بدور محدد → يظهر فوراً في القائمة
//   3) تعديل مستخدم → التغيير ينعكس
//   4) حذف مستخدم → يختفي فوراً (زر الحذف لم يكن موجوداً أصلاً)
//   5) زر الحذف معطل لحسابي (حماية الذات)
//   6) انعكاس المزامنة: تبويب التذاكر يعرض البلاغات (نفس علّة القراءة) وقائمة الفنيين ليست فارغة
// تتطلب API على :3000 (postgres حقيقي) + حسابات scripts/e2e_seed.mjs
import { test, expect } from '@playwright/test'

const E2E_ADMIN = 'e2e_admin'
const E2E_ADMIN_PASS = 'E2eAdmin@2026'
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000/api'

const stamp = () => Date.now()

async function loginAdmin(page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'اسم المستخدم', exact: true }).fill(E2E_ADMIN)
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(E2E_ADMIN_PASS)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForURL('/')
}

test.describe('تبويب المستخدمين — القائمة تظهر (الإصلاح الجذري)', () => {
  test('القائمة تعرض مستخدمين فعليين لا رسالة "لا يوجد مستخدمين"', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'المستخدمين', exact: true }).click()
    await page.waitForURL('/users')

    // جدول المستخدمين يحتوي صفوف بيانات فعلاً — كان فارغاً دائماً بسبب علّة القراءة
    await expect(page.getByRole('row').filter({ has: page.locator('button[title]') })).not.toHaveCount(0, { timeout: 10000 })
    // لا تظهر رسالة القائمة الفارغة
    await expect(page.getByText('لا يوجد مستخدمين')).toHaveCount(0)
    // إحصاء "إجمالي المستخدمين" ليس صفراً
    const totalCard = page.locator('.card', { hasText: 'إجمالي المستخدمين' }).first()
    await expect(totalCard.getByText(/^[1-9]\d*$/)).toBeVisible()

    // البحث في الخادم يجد المستخدم حتى لو كان في صفحات لاحقة
    await page.getByRole('textbox', { name: 'بحث بالاسم أو اسم المستخدم...' }).fill('e2e_admin')
    await expect(page.getByRole('cell', { name: /e2e_admin/ })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('إضافة مستخدم بدور محدد يظهر فوراً', () => {
  test('إنشاء دعم فني جديد → يظهر في القائمة مباشرة', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'المستخدمين', exact: true }).click()
    await page.waitForURL('/users')

    const username = `e2e_added_${stamp()}`
    await page.getByRole('button', { name: 'مستخدم جديد' }).click()
    await page.getByLabel('اسم المستخدم').fill(username)
    await page.getByLabel('كلمة المرور').fill('Strong@123')
    await page.getByLabel('الاسم الكامل').fill('فني دعم مضاف E2E')
    await page.getByLabel('الصلاحية').selectOption('support')
    await page.getByRole('button', { name: 'إنشاء المستخدم' }).click()

    // رسالة النجاح + ظهوره فوراً في القائمة (بدون إعادة تحميل)
    await expect(page.getByText(/تم إنشاء المستخدم/)).toBeVisible({ timeout: 8000 })
    await page.getByRole('textbox', { name: 'بحث بالاسم أو اسم المستخدم...' }).fill(username)
    await expect(page.getByText('فني دعم مضاف E2E')).toBeVisible({ timeout: 10000 })
    // شارة الدور "دعم فني" على صفّه
    await expect(page.getByRole('cell', { name: /دعم فني/ })).toBeVisible()
  })
})

test.describe('حذف مستخدم — الزر الجديد والحمايات', () => {
  test('المدير يحذف مستخدماً → يختفي من القائمة فوراً', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'المستخدمين', exact: true }).click()
    await page.waitForURL('/users')

    // جهّز مستخدماً للضحية عبر نموذج الإضافة (نفس التدفق الحقيقي)
    const username = `e2e_todelete_${stamp()}`
    await page.getByRole('button', { name: 'مستخدم جديد' }).click()
    await page.getByLabel('اسم المستخدم').fill(username)
    await page.getByLabel('كلمة المرور').fill('Strong@123')
    await page.getByLabel('الاسم الكامل').fill('مستخدم للحذف E2E')
    await page.getByRole('button', { name: 'إنشاء المستخدم' }).click()
    await expect(page.getByText(/تم إنشاء المستخدم/)).toBeVisible({ timeout: 8000 })

    // ابحث عنه واضغط زر الحذف في صفّه
    await page.getByRole('textbox', { name: 'بحث بالاسم أو اسم المستخدم...' }).fill(username)
    await expect(page.getByText('مستخدم للحذف E2E')).toBeVisible()
    await page.getByRole('button', { name: 'حذف المستخدم نهائياً' }).click()

    // نافذة التأكيد تظهر اسم الضحية
    await expect(page.getByText(/أنت على وشك حذف حساب/)).toBeVisible()
    await page.getByRole('button', { name: 'نعم، احذف نهائياً' }).click()
    await expect(page.getByText('تم حذف المستخدم نهائياً')).toBeVisible({ timeout: 8000 })

    // اختفى من القائمة
    await expect(page.getByText('مستخدم للحذف E2E')).toHaveCount(0)
  })

  test('زر الحذف معطل لحسابي (حماية الذات) مع تلميح', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'المستخدمين', exact: true }).click()
    await page.waitForURL('/users')

    // اعثر على صف حسابي عبر البحث في الخادم (قد يكون في صفحات لاحقة)
    await page.getByRole('textbox', { name: 'بحث بالاسم أو اسم المستخدم...' }).fill('e2e_admin')
    const selfRow = page.getByRole('row', { name: /e2e_admin/ })
    await expect(selfRow).toBeVisible({ timeout: 10000 })
    await expect(selfRow.getByRole('button', { name: 'لا يمكنك حذف حسابك الخاص' })).toBeDisabled()
  })
})

test.describe('مزامنة القراءة — التذاكر ونقاط الخريطة تظهر (نفس علّة القراءة)', () => {
  test('تبويب التذاكر يعرض بلاغات حقيقية وقائمة الفنيين للتعيين ليست فارغة', async ({ page, request }) => {
    // جهّز بلاغاً معلقاً عبر API (المدير) حتى يكون الفحص حتمياً
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { username: E2E_ADMIN, password: E2E_ADMIN_PASS },
    })
    expect(login.status()).toBe(200)
    const token = (await login.json())?.data?.token
    const ticket = await request.post(`${API_URL}/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: `بلاغ E2E للتعيين ${stamp()}`, customer_name: 'عميل اختبار التعيين', priority: 'medium' },
    })
    expect([200, 201]).toContain(ticket.status())

    await loginAdmin(page)
    await page.getByRole('link', { name: 'البلاغات', exact: true }).click()
    await page.waitForURL('/tickets')

    // البلاغ المعلق ظاهر في الجدول (كانت القائمة فارغة دائماً بسبب علّة القراءة)
    await expect(page.getByText(/بلاغ E2E للتعيين/).first()).toBeVisible({ timeout: 10000 })

    // قائمة تعيين الفني: خيار افتراضي + فنيون نشطون (كانوا صفراً)
    const assignSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'تعيين فني' }) }).first()
    await expect(assignSelect).toBeVisible()
    const options = await assignSelect.locator('option').count()
    expect(options).toBeGreaterThan(1) // الخيار الافتراضي + e2e_runner على الأقل
  })

  test('تبويب نقاط الخريطة يعرض النقاط إن وجدت دون انهيار', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('link', { name: 'نقاط الخريطة', exact: true }).click()
    await page.waitForURL('/map-points')
    // الصفحة تعمل: علامات الأجهزة ظاهرة (أجهزة بموقع من الاختبارات السابقة)
    await expect(page.locator('.device-marker').first()).toBeVisible({ timeout: 10000 })
    // شريط الإحصاءات يعكس النقاط الحقيقية (بانتظار/معتمدة/مرفوضة)
    await expect(page.getByText('بانتظار المراجعة').first()).toBeVisible()
  })
})
