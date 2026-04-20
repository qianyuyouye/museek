/**
 * 进程内简单 TTL 缓存（单实例有效；多实例部署需改 Redis）。
 * 用法：
 *   const data = await cacheGet('dashboard', 5 * 60 * 1000, () => loadDashboard())
 *   invalidate('dashboard')   // 或 invalidatePrefix('song')
 */

type Entry = { value: unknown; expireAt: number }

const store = new Map<string, Entry>()

export async function cacheGet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const cur = store.get(key)
  if (cur && cur.expireAt > now) return cur.value as T
  const value = await loader()
  store.set(key, { value, expireAt: now + ttlMs })
  return value
}

export function invalidate(key: string): void {
  store.delete(key)
}

/** 失效所有以 prefix 开头的 key */
export function invalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

/** 清空所有缓存（测试/热重启用）*/
export function clearCache(): void {
  store.clear()
}
