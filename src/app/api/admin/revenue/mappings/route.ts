import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { MappingStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(MappingStatus))
// 前端 Tab "未绑定" 语义 → creatorId IS NULL（schema 无 unbound 枚举值）
const UI_STATUS_ALIAS: Record<string, Prisma.SongMappingWhereInput> = {
  unbound: { creatorId: null },
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.revenue.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')

  let where: Prisma.SongMappingWhereInput = {}
  if (status && status !== 'all') {
    if (UI_STATUS_ALIAS[status]) {
      where = UI_STATUS_ALIAS[status]
    } else if (VALID_STATUSES.has(status)) {
      where = { status: status as MappingStatus }
    } else {
      return err('无效的状态值')
    }
  }

  const [mappings, total] = await Promise.all([
    prisma.songMapping.findMany({
      where,
      include: {
        platformSong: { select: { id: true, title: true, copyrightCode: true } },
        creator: { select: { id: true, name: true, realName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.songMapping.count({ where }),
  ])

  // 前端列字段 alias：UI 用 qishuiId/songName/source/creatorName/status(unbound)
  const list = mappings.map((m) => ({
    ...m,
    qishuiId: m.qishuiSongId,
    songName: m.qishuiSongName,
    source: m.matchType === 'manual' ? 'manual' : 'auto',
    creatorName: m.creator?.realName ?? m.creator?.name ?? null,
    // creatorId 为空 → 前端语义"未绑定"
    status: m.creatorId == null ? 'unbound' : m.status,
    // 保留原值供其他消费方使用
    rawStatus: m.status,
  }))

  return ok({ list, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.revenue.operate')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { qishuiSongId, platformSongId, creatorId, matchType } = body

  if (!qishuiSongId || !matchType) {
    return err('qishuiSongId, matchType 必填')
  }

  const mapping = await prisma.songMapping.upsert({
    where: { qishuiSongId },
    create: {
      qishuiSongId,
      platformSongId: platformSongId ?? null,
      creatorId: creatorId ?? null,
      matchType,
    },
    update: {
      ...(platformSongId !== undefined && { platformSongId }),
      ...(creatorId !== undefined && { creatorId }),
      matchType,
    },
  })

  await logAdminAction(request, {
    action: 'upsert_song_mapping',
    targetType: 'song_mapping',
    targetId: mapping.id,
    detail: { qishuiSongId, platformSongId: platformSongId ?? null, creatorId: creatorId ?? null, matchType },
  })
  return ok(mapping)
})
