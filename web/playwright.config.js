// Playwright E2E — مسارات الدخول والجلسة ونقاط الخريطة
// -----------------------------------------------------
// التشغيل محلياً (يتطلب API على :3000):  npx playwright test
// في CI: مهمة e2e تشغّل postgres + backend + vite ثم هذه الاختبارات.
import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.E2E_PORT || 4173

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // تسلسل — الاختبارات تتشارك حالة مستخدمي الاختبار
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ar',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.E2E_NO_SERVER ? undefined : {
    command: 'npx vite preview --port ' + PORT,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
