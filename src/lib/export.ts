'use client'

/** 把对象数组导出为 CSV（UTF-8 + BOM，兼容 Excel） */
export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    // CSV 注入防护：公式前缀加 ' 转义
    const sanitized = s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')
      ? "'" + s
      : s
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** JSON 导出 */
export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 当前日期串，用于文件名 */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
