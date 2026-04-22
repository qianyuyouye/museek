import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { toSignedUrl } from '@/lib/signed-url'

// GET 歌曲详情（含签名 URL）— 当前前端用列表页直接编辑，此端点保留供后续详情页使用
export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.songs.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    include: {
      user: { select: { id: true, name: true, realName: true, phone: true } },
      reviews: {
        include: { reviewer: { select: { id: true, name: true } } },
        orderBy: { reviewedAt: 'desc' },
      },
      distributions: true,
    },
  })

  if (!song) return err('歌曲不存在', 404)

  return ok({
    ...song,
    audioUrl: await toSignedUrl(song.audioUrl, auth.userId),
    coverUrl: await toSignedUrl(song.coverUrl, auth.userId),
  })
})

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.songs.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({ where: { id: songId } })
  if (!song) return err('歌曲不存在', 404)

  // v6.0 PRD §1.2 字段白名单
  const ALLOWED = ['genre', 'bpm', 'lyrics', 'lyricist', 'composer', 'performer', 'albumName', 'albumArtist', 'creationDesc', 'aiTools'] as const
  const body = await request.json()
  const changes: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}

  for (const key of ALLOWED) {
    if (key in body) {
      before[key] = (song as Record<string, unknown>)[key]
      changes[key] = body[key]
    }
  }

  // 拒绝不在白名单中的字段
  const forbidden = Object.keys(body).filter(k => !ALLOWED.includes(k as typeof ALLOWED[number]))
  if (forbidden.length > 0) return err(`不允许修改字段：${forbidden.join(', ')}`)
  if (Object.keys(changes).length === 0) return err('无有效更新字段')

  const updated = await prisma.platformSong.update({
    where: { id: songId },
    data: changes as Record<string, unknown>,
  })

  await logAdminAction(request, {
    action: 'edit_song_meta',
    targetType: 'platform_song',
    targetId: songId,
    detail: { copyrightCode: updated.copyrightCode, before, after: changes },
  })
  return ok(updated)
})
