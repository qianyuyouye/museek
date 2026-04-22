import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'
import { fillSongDefaults } from '@/lib/song-defaults'
import { nextCopyrightCode } from '@/lib/copyright-code'

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { id: idStr } = await params
  const assignmentId = parseInt(idStr, 10)
  if (isNaN(assignmentId)) return err('无效的作业ID')

  // 检查作业是否存在
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, groupId: true, status: true },
  })
  if (!assignment) return err('作业不存在', 404)
  if (assignment.status !== 'active') return err('作业未在进行中，无法提交')

  // 检查用户是否属于该组
  const membership = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId: assignment.groupId } },
  })
  if (!membership) return err('你不属于该作业所在的组', 403)

  // 检查是否已提交过
  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
  })
  // 仅 needs_revision 状态允许重新提交（version++，保留旧 reviews）
  // 其余已提交状态一律阻断
  if (existing && existing.status !== 'needs_revision') {
    return err('不允许重复提交')
  }

  const body = await request.json()
  const { title, aiTools, performer, lyricist, composer, lyrics, styleDesc, genre, bpm, albumName, albumArtist } = body

  if (!title) return err('标题不能为空')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { realName: true, name: true },
  })
  if (!user) return err('用户不存在', 404)
  const defaults = fillSongDefaults({ title, performer, lyricist, composer, albumName, albumArtist }, { realName: user.realName, name: user.name ?? '' })

  // 重新提交分支：复用旧 platform_song（version+1，清空评分/评语），更新 submission
  if (existing && existing.platformSongId) {
    const result = await prisma.$transaction(async (tx) => {
      const updatedSong = await tx.platformSong.update({
        where: { id: existing.platformSongId! },
        data: {
          title,
          aiTools: aiTools ?? undefined,
          performer: defaults.performer,
          lyricist: defaults.lyricist,
          composer: defaults.composer,
          lyrics,
          styleDesc,
          genre,
          bpm: bpm ? parseInt(bpm, 10) : undefined,
          albumName: defaults.albumName,
          albumArtist: defaults.albumArtist,
          status: 'pending_review',
          score: null,
          reviewComment: null,
          version: { increment: 1 },
        },
      })
      const updatedSubmission = await tx.assignmentSubmission.update({
        where: { id: existing.id },
        data: {
          status: 'pending_review',
          submittedAt: new Date(),
          score: null,
          version: { increment: 1 },
        },
      })
      return { song: updatedSong, submission: updatedSubmission }
    })

    return ok({
      songId: result.song.id,
      copyrightCode: result.song.copyrightCode,
      submissionId: result.submission.id,
      version: result.song.version,
      resubmitted: true,
    })
  }

  const copyrightCode = await nextCopyrightCode()

  const result = await prisma.$transaction(async (tx) => {
    const song = await tx.platformSong.create({
      data: {
        copyrightCode,
        userId,
        title,
        aiTools: aiTools ?? undefined,
        performer: defaults.performer,
        lyricist: defaults.lyricist,
        composer: defaults.composer,
        lyrics,
        styleDesc,
        genre,
        bpm: bpm ? parseInt(bpm, 10) : undefined,
        albumName: defaults.albumName,
        albumArtist: defaults.albumArtist,
        source: 'assignment',
        assignmentId,
        status: 'pending_review',
      },
    })

    const submission = await tx.assignmentSubmission.create({
      data: {
        assignmentId,
        userId,
        platformSongId: song.id,
        status: 'pending_review',
        submittedAt: new Date(),
      },
    })

    await tx.assignment.update({
      where: { id: assignmentId },
      data: { submissionCount: { increment: 1 } },
    })

    return { song, submission }
  })

  return ok({
    songId: result.song.id,
    copyrightCode: result.song.copyrightCode,
    submissionId: result.submission.id,
  })
})
