import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { MappingStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(MappingStatus))

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')

  if (status && !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const where = status ? { status: status as MappingStatus } : {}

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

  return ok({ list: mappings, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
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

  return ok(mapping)
})
