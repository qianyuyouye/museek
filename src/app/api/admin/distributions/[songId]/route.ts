import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { DistributionStatus } from '@prisma/client'
import { isPlatformEnabled } from '@/lib/platforms'

const VALID_STATUSES = new Set(Object.values(DistributionStatus))

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> },
) {
  const auth = await requirePermission(request, 'admin.distributions.view')
  if ('error' in auth) return auth.error

  const { songId } = await params
  const id = parseInt(songId, 10)
  if (isNaN(id)) return err('无效的歌曲ID')

  const distributions = await prisma.distribution.findMany({
    where: { songId: id },
    orderBy: { id: 'asc' },
  })

  return ok(distributions)
})

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> },
) {
  const auth = await requirePermission(request, 'admin.distributions.operate')
  if ('error' in auth) return auth.error

  const { songId } = await params
  const id = parseInt(songId, 10)
  if (isNaN(id)) return err('无效的歌曲ID')

  const body = await request.json()
  const { platform, status, submittedAt, liveDate } = body

  if (!platform || typeof platform !== 'string' || !(await isPlatformEnabled(platform))) {
    return err('无效的平台名称')
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const song = await prisma.platformSong.findUnique({ where: { id } })
  if (!song) return err('歌曲不存在', 404)

  const distribution = await prisma.distribution.upsert({
    where: { songId_platform: { songId: id, platform } },
    update: {
      status,
      submittedAt: submittedAt ? new Date(submittedAt) : undefined,
      liveDate: liveDate ? new Date(liveDate) : undefined,
    },
    create: {
      songId: id,
      platform,
      status,
      submittedAt: submittedAt ? new Date(submittedAt) : undefined,
      liveDate: liveDate ? new Date(liveDate) : undefined,
    },
  })

  await logAdminAction(request, {
    action: 'upsert_distribution',
    targetType: 'distribution',
    targetId: distribution.id,
    detail: { songId: id, songTitle: song.title, platform, status },
  })
  return ok(distribution)
})
