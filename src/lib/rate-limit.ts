/**
 * 内存版限流 + 失败计数（单进程有效，生产建议换 Redis）。
 * - ipRate: 每 IP 每窗口内最多 N 次
 * - loginFail: 每账号连续失败超过阈值则临时锁定
 */

type Bucket = { count: number; resetAt: number }

const ipBuckets = new Map<string, Bucket>()
const loginFailures = new Map<string, { count: number; lockUntil: number }>()

/** 每 IP 请求限流，超限返回 true（需要拦截） */
export function ipRateLimit(ip: string, key: string, max: number, windowMs: number): boolean {
  // 测试环境 bypass：避免 vitest 批量登录触发限流
  if (process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test') return false
  if (!ip) return false
  const bucketKey = `${key}:${ip}`
  const now = Date.now()
  const b = ipBuckets.get(bucketKey)
  if (!b || now > b.resetAt) {
    ipBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return false
  }
  b.count += 1
  return b.count > max
}

/** 记录登录失败，返回当前失败次数 */
export function recordLoginFailure(account: string): number {
  if (process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test') return 0
  const now = Date.now()
  const rec = loginFailures.get(account) ?? { count: 0, lockUntil: 0 }
  if (now < rec.lockUntil) return rec.count
  rec.count = rec.count + 1
  if (rec.count >= 5) {
    rec.lockUntil = now + 5 * 60 * 1000
  }
  loginFailures.set(account, rec)
  return rec.count
}

/** 查询账号是否仍处于锁定期，返回剩余秒数（>0 表示锁定中） */
export function isAccountLocked(account: string): number {
  if (process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test') return 0
  const rec = loginFailures.get(account)
  if (!rec) return 0
  const remain = rec.lockUntil - Date.now()
  return remain > 0 ? Math.ceil(remain / 1000) : 0
}

/** 登录成功：清空失败计数 */
export function clearLoginFailure(account: string): void {
  loginFailures.delete(account)
}
