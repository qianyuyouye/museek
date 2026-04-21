import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { toSignedUrl } from '@/lib/signed-url'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'admin.publish_confirm.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const distId = parseInt(id, 10)
  if (isNaN(distId)) return err('无效的 ID')

  const distribution = await prisma.distribution.findUnique({
    where: { id: distId },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          copyrightCode: true,
          isrc: true,
          genre: true,
          performer: true,
          coverUrl: true,
          audioUrl: true,
          userId: true,
          user: { select: { name: true } },
          mappings: {
            select: {
              revenueRows: {
                select: {
                  settlement: { select: { id: true } },
                },
                take: 1,
              },
            },
            take: 1,
          },
        },
      },
    },
  })

  if (!distribution) return err('发行记录不存在', 404)

  const now = Date.now()
  const hasRevenue = distribution.song.mappings.some((m) =>
    m.revenueRows.some((r) => r.settlement !== null),
  )

  return ok({
    id: distribution.id,
    songId: distribution.songId,
    platform: distribution.platform,
    status: distribution.status,
    submittedAt: distribution.submittedAt,
    liveDate: distribution.liveDate,
    url: distribution.url,
    song: {
      id: distribution.song.id,
      title: distribution.song.title,
      copyrightCode: distribution.song.copyrightCode,
      isrc: distribution.song.isrc,
      genre: distribution.song.genre,
      performer: distribution.song.performer,
      coverUrl: await toSignedUrl(distribution.song.coverUrl, auth.userId),
      audioUrl: await toSignedUrl(distribution.song.audioUrl, auth.userId),
    },
    creatorName: distribution.song.user.name,
    daysSinceSubmit: distribution.submittedAt
      ? Math.floor((now - distribution.submittedAt.getTime()) / 86400000)
      : null,
    hasRevenue,
  })
})

const TRANSITIONS: Record<string, { from: string; to: string; setFields: Record<string, unknown> }> = {
  submit:   { from: 'pending',   to: 'submitted', setFields: { submittedAt: 'NOW' } },
  confirm:  { from: 'submitted', to: 'live',      setFields: { liveDate: 'NOW' } },
  exception:{ from: 'submitted', to: 'failed',    setFields: {} },
  resubmit: { from: 'failed',    to: 'submitted', setFields: { submittedAt: 'NOW' } },
}

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'admin.publish_confirm.operate')
  if ('error' in auth) return auth.error

  const { id } = await params
  const distId = parseInt(id, 10)
  if (isNaN(distId)) return err('无效的 ID')

  const body = await request.json()
  const action = body.action as string
  const transition = TRANSITIONS[action]
  if (!transition) return err('无效的操作')

  const distribution = await prisma.distribution.findUnique({
    where: { id: distId },
  })
  if (!distribution) return err('发行记录不存在', 404)
  if (distribution.status !== transition.from) {
    return err(`当前状态 ${distribution.status} 不允许执行 ${action}`)
  }

  const now = new Date()
  const data: Record<string, unknown> = { status: transition.to }
  for (const [field, value] of Object.entries(transition.setFields)) {
    data[field] = value === 'NOW' ? now : value
  }

  const updated = await prisma.distribution.update({
    where: { id: distId },
    data,
  })

  await logAdminAction(request, {
    action: `distribution_${action}`,
    targetType: 'distribution',
    targetId: distId,
    detail: { platform: distribution.platform, from: transition.from, to: transition.to },
  })
  return ok(updated)
})
