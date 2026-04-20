import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { notify } from '@/lib/notifications'

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const body = await request.json()
  const { isrc } = body as { isrc: string }

  if (!isrc || !isrc.trim()) return err('ISRC 不能为空')

  const song = await prisma.platformSong.findUnique({ where: { id: songId } })
  if (!song) return err('歌曲不存在', 404)

  const updated = await prisma.platformSong.update({
    where: { id: songId },
    data: { isrc: isrc.trim() },
  })

  await logAdminAction(request, {
    action: 'assign_isrc',
    targetType: 'platform_song',
    targetId: songId,
    detail: { title: song.title, copyrightCode: song.copyrightCode, isrc: isrc.trim(), prevIsrc: song.isrc || null },
  })

  try {
    await notify(
      song.userId,
      'tpl.isrc_bound',
      { songTitle: song.title, isrc: isrc.trim(), songId: song.id },
      'song',
      song.id,
    )
  } catch (e) {
    console.error('[notify] isrc_bound failed:', e)
  }

  return ok(updated)
})
