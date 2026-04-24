/**
 * Theme 8: DB 持久化限流 + 失败计数，兼容多实例部署。
 *
 * 设计：
 * - 主存 `auth_rate_limits` 表（key 唯一，count + resetAt）
 * - 内存 cache 层（5 秒 TTL）减少热点 key 的 DB 查询次数
 * - 登录失败锁与短信验证码锁共用同一套抽象
 *
 * 测试环境通过 TEST_MODE=1 或 NODE_ENV=test 直接绕过。
 */

import { prisma } from './prisma'

// 内存 cache：避免高频接口每次请求都打 DB
type CacheEntry = { count: number; resetAt: number; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5_000

function isTestBypass(): boolean {
  return process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test'
}

async function hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const now = Date.now()
  const cached = cache.get(key)

  if (cached && now < cached.expiresAt && now < cached.resetAt) {
    cached.count += 1
    // 同步写回 DB，避免缓存过期后计数丢失
    await prisma.authRateLimit.update({
      where: { key },
      data: { count: cached.count },
    }).catch(() => {})
    return { count: cached.count, resetAt: cached.resetAt }
  }

  const resetAtDate = new Date(now + windowMs)
  try {
    // upsert：窗口内自增，窗口过期重置
    const existing = await prisma.authRateLimit.findUnique({ where: { key } })
    if (existing && existing.resetAt.getTime() > now) {
      const updated = await prisma.authRateLimit.update({
        where: { key },
        data: { count: existing.count + 1 },
      })
      const entry = { count: updated.count, resetAt: updated.resetAt.getTime(), expiresAt: now + CACHE_TTL_MS }
      cache.set(key, entry)
      return { count: entry.count, resetAt: entry.resetAt }
    }
    const upserted = await prisma.authRateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: resetAtDate },
      update: { count: 1, resetAt: resetAtDate },
    })
    const entry = { count: upserted.count, resetAt: upserted.resetAt.getTime(), expiresAt: now + CACHE_TTL_MS }
    cache.set(key, entry)
    return { count: entry.count, resetAt: entry.resetAt }
  } catch (error) {
    // DB 异常降级为放行（避免限流故障导致业务中断）
    console.error('[rate-limit] DB error, falling back to allow:', error)
    return { count: 0, resetAt: now + windowMs }
  }
}

/**
 * 每 IP 请求限流。超限返回 true（需要拦截）。
 * @param ip 客户端 IP
 * @param key 业务 key，如 'login'、'sms-send'
 * @param max 窗口内允许次数
 * @param windowMs 窗口时长（ms）
 */
export async function ipRateLimit(ip: string, key: string, max: number, windowMs: number): Promise<boolean> {
  if (isTestBypass()) return false
  if (!ip) return false
  const bucketKey = `ip:${key}:${ip}`
  const { count } = await hit(bucketKey, windowMs)
  return count > max
}

/**
 * 登录失败计数。连续错误 ≥5 次则 5 分钟临时锁定。
 * 返回当前失败次数。
 */
export async function recordLoginFailure(account: string): Promise<number> {
  if (isTestBypass()) return 0
  const bucketKey = `login-fail:${account}`
  const { count } = await hit(bucketKey, 5 * 60 * 1000)
  return count
}

/** 查询账号是否仍处于锁定期。返回剩余秒数（>0 表示锁定中）。 */
export async function isAccountLocked(account: string): Promise<number> {
  if (isTestBypass()) return 0
  const rec = await prisma.authRateLimit.findUnique({ where: { key: `login-fail:${account}` } })
  if (!rec || rec.count < 5) return 0
  const remain = rec.resetAt.getTime() - Date.now()
  return remain > 0 ? Math.ceil(remain / 1000) : 0
}

/** 登录成功：清空失败计数 */
export async function clearLoginFailure(account: string): Promise<void> {
  const bucketKey = `login-fail:${account}`
  cache.delete(bucketKey)
  await prisma.authRateLimit.deleteMany({ where: { key: bucketKey } }).catch(() => {})
}

/**
 * Theme 8: SMS 验证码错误次数锁。连续 5 次错误锁 15 分钟。
 * 返回当前错误次数。
 */
export async function recordSmsVerifyFailure(phone: string): Promise<number> {
  if (isTestBypass()) return 0
  const bucketKey = `sms-verify-fail:${phone}`
  const { count } = await hit(bucketKey, 15 * 60 * 1000)
  return count
}

/** 查询 phone 是否因 SMS 错码过多锁定，返回剩余秒数 */
export async function isSmsVerifyLocked(phone: string): Promise<number> {
  if (isTestBypass()) return 0
  const rec = await prisma.authRateLimit.findUnique({ where: { key: `sms-verify-fail:${phone}` } })
  if (!rec || rec.count < 5) return 0
  const remain = rec.resetAt.getTime() - Date.now()
  return remain > 0 ? Math.ceil(remain / 1000) : 0
}

/** 清除 SMS 验证失败计数（验证成功时调用） */
export async function clearSmsVerifyFailure(phone: string): Promise<void> {
  const bucketKey = `sms-verify-fail:${phone}`
  cache.delete(bucketKey)
  await prisma.authRateLimit.deleteMany({ where: { key: bucketKey } }).catch(() => {})
}

/**
 * Theme 8: 邀请码爆破防护。同一 IP 或 phone 错误输入邀请码 ≥5 次/小时则锁定。
 * 返回 true 表示已锁定（需拦截）。
 */
export async function recordInviteCodeFailure(ip: string, phone: string): Promise<boolean> {
  if (isTestBypass()) return false
  const windowMs = 60 * 60 * 1000
  const ipKey = `invite-fail:ip:${ip}`
  const phoneKey = `invite-fail:phone:${phone}`
  const [ipRes, phoneRes] = await Promise.all([hit(ipKey, windowMs), hit(phoneKey, windowMs)])
  return ipRes.count > 5 || phoneRes.count > 5
}

/** 查询 IP 或 phone 是否仍被邀请码爆破保护锁定（读），不递增 */
export async function isInviteCodeLocked(ip: string, phone: string): Promise<boolean> {
  if (isTestBypass()) return false
  const [ipRec, phoneRec] = await Promise.all([
    prisma.authRateLimit.findUnique({ where: { key: `invite-fail:ip:${ip}` } }),
    prisma.authRateLimit.findUnique({ where: { key: `invite-fail:phone:${phone}` } }),
  ])
  const now = Date.now()
  const ipLocked = ipRec && ipRec.count > 5 && ipRec.resetAt.getTime() > now
  const phoneLocked = phoneRec && phoneRec.count > 5 && phoneRec.resetAt.getTime() > now
  return !!ipLocked || !!phoneLocked
}
