import { getSetting, SETTING_KEYS } from './system-settings'
import { cacheGet, invalidate } from './cache'

/** 无 DB 配置时回落平台列表（避免 fresh install 拿到空数组导致 /distributions 矩阵空列） */
const FALLBACK_PLATFORMS = ['QQ音乐', '网易云音乐', '酷狗音乐', 'Spotify', 'Apple Music']

/** RevenueImport.platform 向后兼容的内部 key（即使 platform_configs 未收录也放行） */
const LEGACY_IMPORT_KEYS = new Set(['qishui', 'qq_music', 'netease', 'spotify', 'apple_music', 'kugou'])

const CACHE_KEY = 'platforms'
const CACHE_TTL_MS = 5 * 60 * 1000

interface RawPlatformItem {
  name?: string
  region?: string
  status?: boolean
  enabled?: boolean
  mapping?: boolean
  mapped?: boolean
}

function normalizeItem(raw: RawPlatformItem): { name: string; enabled: boolean } | null {
  const name = (raw.name ?? '').trim()
  if (!name) return null
  const enabled = raw.enabled !== undefined ? !!raw.enabled : !!raw.status
  return { name, enabled }
}

async function loadPlatforms(): Promise<string[]> {
  const raw = await getSetting<RawPlatformItem[]>(SETTING_KEYS.PLATFORM_CONFIGS, [])
  if (!Array.isArray(raw) || raw.length === 0) return [...FALLBACK_PLATFORMS]
  const enabled = raw.map(normalizeItem).filter((x): x is { name: string; enabled: boolean } => !!x && x.enabled)
  if (enabled.length === 0) return [...FALLBACK_PLATFORMS]
  return enabled.map((x) => x.name)
}

/** 返回当前启用的平台名称列表（含 5 分钟缓存 + fallback） */
export async function getEnabledPlatforms(): Promise<string[]> {
  return cacheGet(CACHE_KEY, CACHE_TTL_MS, loadPlatforms)
}

interface IsEnabledOpts {
  /** RevenueImport 路由用：即使不在 platform_configs 里，几个历史 key 也放行 */
  allowLegacyKeys?: boolean
}

export async function isPlatformEnabled(name: string, opts: IsEnabledOpts = {}): Promise<boolean> {
  if (!name) return false
  if (opts.allowLegacyKeys && LEGACY_IMPORT_KEYS.has(name)) return true
  const list = await getEnabledPlatforms()
  return list.includes(name)
}

/** 管理员保存 platform_configs 后调用 */
export function invalidatePlatforms(): void {
  invalidate(CACHE_KEY)
}
