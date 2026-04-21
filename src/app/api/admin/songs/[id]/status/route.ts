import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { invalidate } from '@/lib/cache'
import { SongStatus } from '@prisma/client'
import { notify } from '@/lib/notifications'
import { getEnabledPlatforms } from '@/lib/platforms'

/** 每个 action 允许的来源状态 → 目标状态 */
const ACTION_TRANSITIONS: Record<string, { from: SongStatus[]; to: SongStatus }> = {
  publish: {
    from: [SongStatus.ready_to_publish, SongStatus.reviewed],
    to: SongStatus.published,
  },
  reject: {
    from: [SongStatus.pending_review, SongStatus.reviewed, SongStatus.ready_to_publish],
    to: SongStatus.needs_revision,
  },
  archive: {
    from: [SongStatus.published],
    to: SongStatus.archived,
  },
  restore: {
    from: [SongStatus.archived],
    to: SongStatus.reviewed,
  },
  review_done: {
    from: [SongStatus.pending_review],
    to: SongStatus.reviewed,
  },
}

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.songs.operate')
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const body = await request.json()
  const { action } = body as { action: string }

  const transition = ACTION_TRANSITIONS[action]
  if (!transition) return err('无效的操作')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    include: { user: true },
  })
  if (!song) return err('歌曲不存在', 404)

  if (!transition.from.includes(song.status)) {
    return err(`当前状态 ${song.status} 不允许执行 ${action} 操作`)
  }

  // 发行前校验
  if (action === 'publish') {
    const missing: string[] = []
    if (!song.user.agencyContract) missing.push('用户未签署经纪合同')
    if (song.user.realNameStatus !== 'verified') missing.push('用户未完成实名认证')
    if (!song.isrc) missing.push('歌曲未绑定 ISRC')
    if (missing.length > 0) {
      return err(`发行条件不满足：${missing.join('、')}`)
    }
  }

  let distributionsCreated = 0
  if (action === 'publish') {
    const platforms = await getEnabledPlatforms()
    const result = await prisma.$transaction(async (tx) => {
      const song2 = await tx.platformSong.update({
        where: { id: songId },
        data: { status: transition.to },
      })
      const r = await tx.distribution.createMany({
        data: platforms.map((p) => ({ songId: song2.id, platform: p, status: 'pending' as const })),
        skipDuplicates: true,
      })
      return { song2, count: r.count }
    })
    distributionsCreated = result.count
  } else {
    await prisma.platformSong.update({
      where: { id: songId },
      data: { status: transition.to },
    })
  }

  // 看板统计依赖歌曲状态分布，写后立即失效
  invalidate('dashboard')

  try {
    if (action === 'publish') {
      await notify(song.userId, 'tpl.song_published', { songTitle: song.title, songId: song.id }, 'song', song.id)
    } else if (action === 'archive') {
      await notify(song.userId, 'tpl.song_archived', { songTitle: song.title, songId: song.id }, 'song', song.id)
    }
  } catch (e) {
    console.error('[notify] song status change failed:', e)
  }

  await logAdminAction(request, {
    action: `song_${action}`,
    targetType: 'platform_song',
    targetId: songId,
    detail: {
      title: song.title,
      copyrightCode: song.copyrightCode,
      from: song.status,
      to: transition.to,
      ...(action === 'publish' ? { distributionsCreated } : {}),
    },
  })
  return ok({ id: songId, status: transition.to, distributionsCreated: action === 'publish' ? distributionsCreated : undefined })
})
