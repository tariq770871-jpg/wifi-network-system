/**
 * تصدير بيانات إلى CSV — يعمل كلياً في المتصفح (لا حمل على الخادم)
 * يدعم BOM UTF-8 ليتعرف Excel على العربية مباشرة
 */
export function downloadCSV(filename, rows, headers) {
  if (!Array.isArray(rows) || rows.length === 0) return false

  const escapeCell = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // اقتباس عند وجود فواصل/أسطر/اقتباسات + مضاعفة الاقتباس الداخلي
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const headerCells = headers.map((h) => escapeCell(h.label))
  const lines = rows.map((row) =>
    headers.map((h) => escapeCell(h.value(row))).join(',')
  )
  const csv = [headerCells.join(','), ...lines].join('\r\n')

  // BOM للعربية في Excel
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
