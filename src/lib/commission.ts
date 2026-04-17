import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

export type CommissionConditionType =
  | 'default'
  | 'min_song_score'
  | 'min_published_count'

export interface RevenueRule {
  name: string
  creatorRatio: number
  platformRatio: number
  conditionType: CommissionConditionType
  conditionValue: number | null
  priority: number
  enabled: boolean
}

export interface ResolveCommissionContext {
  creatorId: number
  songId?: number | null
}

export interface ResolveCommissionResult {
  creatorRatio: Prisma.Decimal
  platformRatio: Prisma.Decimal
  ruleName: string
}

/** PRD §6.2 三档默认规则（seed 与 API fallback 共用） */
export const DEFAULT_REVENUE_RULES: RevenueRule[] = [
  {
    name: '高分激励',
    creatorRatio: 0.8,
    platformRatio: 0.2,
    conditionType: 'min_song_score',
    conditionValue: 90,
    priority: 1,
    enabled: true,
  },
  {
    name: '量产奖励',
    creatorRatio: 0.75,
    platformRatio: 0.25,
    conditionType: 'min_published_count',
    conditionValue: 10,
    priority: 2,
    enabled: true,
  },
  {
    name: '默认规则',
    creatorRatio: 0.7,
    platformRatio: 0.3,
    conditionType: 'default',
    conditionValue: null,
    priority: 99,
    enabled: true,
  },
]

const CONDITION_TYPES: CommissionConditionType[] = [
  'default',
  'min_song_score',
  'min_published_count',
]

function normalizeRatio(v: unknown): number | null {
  if (typeof v !== 'number' || !isFinite(v)) return null
  // 兼容历史数据把比例写成百分数（如 70 而不是 0.70）
  if (v > 1) return v / 100
  return v
}

function coerceRule(raw: unknown): RevenueRule | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!name) return null
  const creatorRatio = normalizeRatio(r.creatorRatio)
  const platformRatio = normalizeRatio(r.platformRatio)
  if (creatorRatio == null || platformRatio == null) return null
  const conditionType = CONDITION_TYPES.includes(r.conditionType as CommissionConditionType)
    ? (r.conditionType as CommissionConditionType)
    : null
  if (!conditionType) return null
  const conditionValue =
    typeof r.conditionValue === 'number' && isFinite(r.conditionValue)
      ? r.conditionValue
      : null
  const priority =
    typeof r.priority === 'number' && isFinite(r.priority) ? r.priority : 99
  const enabled = r.enabled !== false
  return {
    name,
    creatorRatio,
    platformRatio,
    conditionType,
    conditionValue,
    priority,
    enabled,
  }
}

/** 从 system_settings 读取并解析规则；解析失败回退到默认三档 */
export async function loadRevenueRules(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<RevenueRule[]> {
  const row = await client.systemSetting.findUnique({
    where: { key: 'revenue_rules' },
  })
  const raw = Array.isArray(row?.value) ? (row!.value as unknown[]) : null
  const parsed = raw
    ? raw.map(coerceRule).filter((r): r is RevenueRule => r !== null)
    : []
  const rules = parsed.length > 0 ? parsed : DEFAULT_REVENUE_RULES
  return rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority)
}

async function ruleMatches(
  client: PrismaClient | Prisma.TransactionClient,
  rule: RevenueRule,
  ctx: ResolveCommissionContext,
): Promise<boolean> {
  if (rule.conditionType === 'default') return true
  const threshold = rule.conditionValue ?? 0

  if (rule.conditionType === 'min_song_score') {
    if (!ctx.songId) return false
    const song = await client.platformSong.findUnique({
      where: { id: ctx.songId },
      select: { score: true },
    })
    return (song?.score ?? 0) >= threshold
  }

  if (rule.conditionType === 'min_published_count') {
    const count = await client.platformSong.count({
      where: { userId: ctx.creatorId, status: 'published' },
    })
    return count >= threshold
  }

  return false
}

/**
 * 评估并返回首条命中的规则的比例。若所有规则都不命中（规则被清空或全部禁用），
 * 回退到硬编码 70/30 并在 console 警告。
 * preloadedRules 可由调用方一次 loadRevenueRules 后复用，减少 settings 表读取。
 */
export async function resolveCommissionRatio(
  client: PrismaClient | Prisma.TransactionClient,
  ctx: ResolveCommissionContext,
  preloadedRules?: RevenueRule[],
): Promise<ResolveCommissionResult> {
  const rules = preloadedRules ?? (await loadRevenueRules(client))

  for (const rule of rules) {
    if (await ruleMatches(client, rule, ctx)) {
      return {
        creatorRatio: new Prisma.Decimal(rule.creatorRatio.toFixed(2)),
        platformRatio: new Prisma.Decimal(rule.platformRatio.toFixed(2)),
        ruleName: rule.name,
      }
    }
  }

  console.warn('[commission] no rule matched, falling back to 70/30', ctx)
  return {
    creatorRatio: new Prisma.Decimal('0.70'),
    platformRatio: new Prisma.Decimal('0.30'),
    ruleName: 'fallback',
  }
}
