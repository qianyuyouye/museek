import { signGetUrl } from './signature'

/**
 * Theme 5: DB 语义从 URL 改为 key。API 读出口一律过此函数生成带 1h TTL 的签名 URL。
 * key 可能残留前导 '/'（Theme 5 迁移前数据），`replace(/^\//, '')` 是兜底规整。
 * TODO(theme5+2): 迁移稳定后删除 replace 规整，改 `if (key.startsWith('/')) throw` 严格化。
 */
export async function toSignedUrl(
  key: string | null | undefined,
  viewerId?: number,
): Promise<string | null> {
  if (!key) return null
  const normalized = key.replace(/^\//, '')
  return signGetUrl(normalized, { userId: viewerId, ttlSec: 3600 })
}
