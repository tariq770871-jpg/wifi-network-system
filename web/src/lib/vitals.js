// Web Vitals قياسات الأداء الفعلية (LCP/CLS/INP/FCP/TTFB)
// --------------------------------------------------------
// في التطوير: تُطبع في الكونسول لسهولة القياس.
// في الإنتاج: تُرسل عبر sendBeacon إلى /api/telemetry/vitals إن توفر، وإلا تُطبع
// quietly — ويمكن ربطها بأي منصة تحليلات عبر REPORT_VITALS.
import { onLCP, onCLS, onINP, onFCP, onTTFB } from 'web-vitals'

const REPORT_VITALS = import.meta.env.VITE_VITALS_ENDPOINT || null

function report(metric) {
  const payload = {
    name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    id: metric.id,
    page: window.location.pathname,
    ts: Date.now(),
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(`[vitals] ${metric.name}: ${payload.value}`)
  }
  if (REPORT_VITALS) {
    try {
      navigator.sendBeacon?.(REPORT_VITALS, JSON.stringify(payload))
    } catch { /* تجاهل */ }
  }
}

export function initVitals() {
  try {
    onLCP(report)
    onCLS(report)
    onINP(report)
    onFCP(report)
    onTTFB(report)
  } catch { /* متصفحات قديمة */ }
}
