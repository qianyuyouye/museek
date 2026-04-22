/**
 * 时间本地化工具。统一 `2026/04/18 15:32:05` 或 `2026-04-18` 格式。
 * 避免前端各处 ISO 原串（`2026-04-18T06:55:12.034Z`）直出。
 */

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '-'
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) return '-'
  try {
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '-'
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 相对时间：5 分钟前 / 2 小时前 / 3 天前；>30 天回落到日期 */
export function formatRelative(input: string | Date | null | undefined): string {
  if (!input) return '-'
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) return '-'
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} 天前`
  return formatDate(d)
}
