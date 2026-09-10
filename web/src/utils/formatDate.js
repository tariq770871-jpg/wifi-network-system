/**
 * Date Formatting - criterion 6: الدعم العالمي
 * تنسيق موحد للتواريخ عبر Intl مع دعم اللغة العربية والمناطق الزمنية
 */

const DEFAULT_LOCALE = 'ar'

/**
 * تنسيق تاريخ قصير: 15 سبتمبر 2026 (أو حسب locale)
 */
export function formatDate(date, locale = DEFAULT_LOCALE, options = {}) {
  if (!date) return '-'
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d)
}

/**
 * تنسيق تاريخ ووقت
 */
export function formatDateTime(date, locale = DEFAULT_LOCALE) {
  return formatDate(date, locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * وقت نسبي بالعربية: "قبل 5 دقائق"
 */
export function formatRelative(date, locale = DEFAULT_LOCALE) {
  if (!date) return '-'
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMs = d.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)

  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffHours = Math.round(diffMs / 3600000)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  return rtf.format(Math.round(diffMs / 86400000), 'day')
}

/**
 * تنسيق أرقام بفواصل
 */
export function formatNumber(num, locale = DEFAULT_LOCALE) {
  if (num === undefined || num === null || Number.isNaN(Number(num))) return '-'
  return new Intl.NumberFormat(locale).format(Number(num))
}
