/**
 * 外部平台对账适配器（GAP-ADMIN-012）
 * 每类平台实现 fetchRevenue / fetchDistributionStatus 接口
 * 当前为骨架实现，后续接入真实平台 API
 */

export interface PlatformRevenue {
  songId: string
  period: string
  revenue: number
}

export interface PlatformAdapter {
  /** 拉取指定周期的收益明细 */
  fetchRevenue(platform: string, period: string): Promise<PlatformRevenue[]>
  /** 查询指定歌曲在平台的发行状态 */
  fetchDistributionStatus(platform: string, songId: string): Promise<{ status: string; url?: string }>
}

/** 平台适配器注册表 */
const ADAPTERS: Record<string, PlatformAdapter> = {}

export function registerAdapter(platform: string, adapter: PlatformAdapter) {
  ADAPTERS[platform] = adapter
}

export function getAdapter(platform: string): PlatformAdapter | null {
  return ADAPTERS[platform] ?? null
}

/** 默认 stub 实现（返回空数据） */
export const stubAdapter: PlatformAdapter = {
  async fetchRevenue() {
    return []
  },
  async fetchDistributionStatus() {
    return { status: 'unknown' }
  },
}

// 注册所有平台的 stub adapter
registerAdapter('qishui', { ...stubAdapter })
registerAdapter('qq_music', { ...stubAdapter })
registerAdapter('netease', { ...stubAdapter })
registerAdapter('spotify', { ...stubAdapter })
registerAdapter('apple_music', { ...stubAdapter })
registerAdapter('kugou', { ...stubAdapter })
