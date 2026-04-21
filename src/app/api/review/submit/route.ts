import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'
import { SongStatus, SubmissionStatus } from '@prisma/client'
import { notify } from '@/lib/notifications'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const body = await request.json()
  const { songId, technique, creativity, commercial, tags, comment, recommendation, durationSeconds } = body

  if (!songId || technique == null || creativity == null || commercial == null || !comment || !recommendation) {
    return err('缺少必填字段')
  }

  // 校验分数范围（必须为 0-100 的整数）
  if ([technique, creativity, commercial].some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100)) {
    return err('评分必须为 0-100 的整数')
  }

  // 评审耗时（秒）：0 ~ 24h 之间，非法值直接忽略
  let durationVal: number | null = null
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
    const v = Math.floor(durationSeconds)
    if (v >= 0 && v <= 86400) durationVal = v
  }

  const validRecommendations = ['strongly_recommend', 'recommend_after_revision', 'not_recommend']
  if (!validRecommendations.includes(recommendation)) {
    return err('无效的推荐类型')
  }

  const totalScore = Math.round(technique * 0.3 + creativity * 0.4 + commercial * 0.3)

  // 根据推荐类型决定歌曲新状态
  let newSongStatus: SongStatus
  let reviewComment: string | null = null

  if (recommendation === 'strongly_recommend' && totalScore >= 80) {
    newSongStatus = 'ready_to_publish'
  } else if (recommendation === 'recommend_after_revision') {
    newSongStatus = 'needs_revision'
    reviewComment = comment
  } else {
    newSongStatus = 'reviewed'
    reviewComment = comment
  }

  // 事务：乐观锁 updateMany 先占位（只有一个并发能 count=1），再创建 review
  let review: { id: number; creatorId: number; songTitle: string }
  try {
    review = await prisma.$transaction(async (tx) => {
      // 先读歌曲拿 version / source / submission
      const song = await tx.platformSong.findUnique({
        where: { id: songId },
        include: { submission: true },
      })
      if (!song) throw new Error('NOT_FOUND')
      if (song.status !== 'pending_review') throw new Error('NOT_PENDING')

      // 乐观锁占位：仅当当前状态仍为 pending_review 才能推进
      const songUpdate: Record<string, unknown> = {
        status: newSongStatus,
        score: totalScore,
      }
      if (reviewComment !== null) songUpdate.reviewComment = reviewComment

      const locked = await tx.platformSong.updateMany({
        where: { id: songId, status: 'pending_review' },
        data: songUpdate,
      })
      if (locked.count === 0) throw new Error('NOT_PENDING')

      const created = await tx.review.create({
        data: {
          songId,
          reviewerId: userId,
          version: song.version,
          technique,
          creativity,
          commercial,
          totalScore,
          tags: tags ?? undefined,
          comment,
          recommendation,
          durationSeconds: durationVal,
        },
      })

      // 如果歌曲来源是 assignment，同步更新 AssignmentSubmission
      if (song.source === 'assignment' && song.submission) {
        const submissionStatus: SubmissionStatus =
          newSongStatus === 'needs_revision' ? 'needs_revision' : 'reviewed'

        await tx.assignmentSubmission.update({
          where: { id: song.submission.id },
          data: { status: submissionStatus, score: totalScore },
        })
      }

      // Theme 10: 提交成功后清理该评审员对该歌曲的草稿（事务内一并）
      await tx.reviewDraft.deleteMany({ where: { userId, songId } })

      return { ...created, creatorId: song.userId, songTitle: song.title }
    })
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'NOT_FOUND') return err('歌曲不存在', 404)
      if (e.message === 'NOT_PENDING') return err('该歌曲已被其他评审处理或状态已变更', 409)
    }
    throw e
  }

  // 事务已提交，异步通知创作者（失败只打日志，不回滚主业务）
  try {
    const templateKey = newSongStatus === 'needs_revision' ? 'tpl.song_needs_revision' : 'tpl.review_done'
    await notify(
      review.creatorId,
      templateKey,
      {
        songTitle: review.songTitle,
        score: totalScore,
        songId,
        comment: comment ?? '',
      },
      'song',
      songId,
    )
  } catch (e) {
    console.error('[notify] review submit failed:', e)
  }

  return ok({ reviewId: review.id, totalScore, songStatus: newSongStatus })
})
