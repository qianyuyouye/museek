import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'
import { fillSongDefaults } from '@/lib/song-defaults'
import { nextCopyrightCode } from '@/lib/copyright-code'

async function loadUserForDefaults(userId: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { realName: true, name: true },
  })
  if (!u) throw new Error('用户不存在')
  return { realName: u.realName, name: u.name ?? '' }
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const body = await request.json()
  const { songId, title, lyricist, composer, aiTool, aiTools, genre, bpm, prompt, lyrics, contribution, creationDesc, styleDesc, audioUrl, coverUrl, audioFeatures, performer, albumName, albumArtist } = body

  if (!title) return err('标题不能为空')

  const normalizedAiTools = aiTools || (aiTool ? [aiTool] : undefined)
  const normalizedBpm = bpm ? parseInt(String(bpm), 10) : undefined
  const normalizedStyleDesc = styleDesc || prompt

  // 修改并重新提交：update 已有 needs_revision 作品，保留 copyrightCode 和创作历史
  if (songId != null) {
    const existing = await prisma.platformSong.findUnique({
      where: { id: Number(songId) },
      select: { id: true, userId: true, status: true, version: true, copyrightCode: true },
    })
    if (!existing) return err('作品不存在', 404)
    if (existing.userId !== userId) return err('无权限', 403)
    if (existing.status !== 'needs_revision') return err('仅 needs_revision 状态的作品可重新提交')

    const updated = await prisma.platformSong.update({
      where: { id: existing.id },
      data: {
        title,
        lyricist,
        composer,
        performer: performer ?? undefined,
        albumName: albumName ?? undefined,
        albumArtist: albumArtist ?? undefined,
        aiTools: normalizedAiTools,
        genre,
        bpm: normalizedBpm,
        lyrics,
        styleDesc: normalizedStyleDesc,
        audioUrl: audioUrl || undefined,
        coverUrl: coverUrl || undefined,
        audioFeatures: audioFeatures || undefined,
        contribution: contribution || 'lead',
        creationDesc,
        status: 'pending_review',
        version: existing.version + 1,
        reviewComment: null,
        score: null,
      },
    })
    return ok({ id: updated.id, copyrightCode: updated.copyrightCode })
  }

  const user = await loadUserForDefaults(userId)
  const defaults = fillSongDefaults({ title, performer, lyricist, composer, albumName, albumArtist }, user)

  const song = await prisma.$transaction(async (tx) => {
    const copyrightCode = await nextCopyrightCode(tx)
    return tx.platformSong.create({
      data: {
        copyrightCode,
        userId,
        title,
        performer: defaults.performer,
        lyricist: defaults.lyricist,
        composer: defaults.composer,
        albumName: defaults.albumName,
        albumArtist: defaults.albumArtist,
        aiTools: normalizedAiTools,
        genre,
        bpm: normalizedBpm,
        lyrics,
        styleDesc: normalizedStyleDesc,
        audioUrl: audioUrl || undefined,
        coverUrl: coverUrl || undefined,
        audioFeatures: audioFeatures || undefined,
        contribution: contribution || 'lead',
        creationDesc,
        source: 'upload',
        status: 'pending_review',
      },
    })
  })

  return ok({
    id: song.id,
    copyrightCode: song.copyrightCode,
  })
})
