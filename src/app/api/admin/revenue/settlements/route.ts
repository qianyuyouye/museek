import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { SettleStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(SettleStatus))

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')

  if (status && !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const where = status ? { settleStatus: status as SettleStatus } : {}

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.settlement.count({ where }),
  ])

  const list = settlements.map((s) => ({
    ...s,
    status: s.settleStatus,
    songTitle: s.songName,
    platform: '汽水音乐',
    douyinRevenue: s.douyinRevenue ? parseFloat(s.douyinRevenue.toString()) : null,
    qishuiRevenue: s.qishuiRevenue ? parseFloat(s.qishuiRevenue.toString()) : null,
    totalRevenue: s.totalRevenue ? parseFloat(s.totalRevenue.toString()) : null,
    platformRatio: parseFloat(s.platformRatio.toString()),
    creatorRatio: parseFloat(s.creatorRatio.toString()),
    creatorAmount: s.creatorAmount ? parseFloat(s.creatorAmount.toString()) : null,
  }))

  return ok({ list, total, page, pageSize })
})

const TRANSITION: Record<string, { from: SettleStatus; to: SettleStatus; timeField?: string }> = {
  confirm: { from: 'pending', to: 'confirmed' },
  export: { from: 'confirmed', to: 'exported', timeField: 'exportedAt' },
  pay: { from: 'exported', to: 'paid', timeField: 'paidAt' },
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { ids, action } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return err('ids 必须为非空数组')
  }
  if (!action || !TRANSITION[action]) {
    return err('无效的 action，支持 confirm/export/pay')
  }

  const { from, to, timeField } = TRANSITION[action]

  // 校验所有记录当前状态是否符合前置条件
  const eligible = await prisma.settlement.count({
    where: { id: { in: ids }, settleStatus: from },
  })

  if (eligible !== ids.length) {
    return err(`${ids.length} 条记录中仅 ${eligible} 条处于 ${from} 状态，无法执行 ${action}`)
  }

  const data: Record<string, unknown> = { settleStatus: to }
  if (timeField) {
    data[timeField] = new Date()
  }
  if (action === 'pay') {
    data.paidBy = auth.userId
  }

  const result = await prisma.settlement.updateMany({
    where: { id: { in: ids }, settleStatus: from },
    data,
  })

  return ok({ updated: result.count })
})
