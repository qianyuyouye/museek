import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'

/** 生成唯一的 copyrightCode */
async function generateCopyrightCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = `AIMU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`
    const exists = await prisma.platformSong.findUnique({
      where: { copyrightCode: code },
      select: { id: true },
    })
    if (!exists) return code
  }
  throw new Error('无法生成唯一的版权编码')
}

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
  if (existing) return err('不允许重复提交')

  const body = await request.json()
  const { title, aiTools, performer, lyricist, composer, lyrics, styleDesc, genre, bpm, albumName, albumArtist } = body

  if (!title) return err('标题不能为空')

  const copyrightCode = await generateCopyrightCode()

  const result = await prisma.$transaction(async (tx) => {
    const song = await tx.platformSong.create({
      data: {
        copyrightCode,
        userId,
        title,
        aiTools: aiTools ?? undefined,
        performer,
        lyricist,
        composer,
        lyrics,
        styleDesc,
        genre,
        bpm: bpm ? parseInt(bpm, 10) : undefined,
        albumName,
        albumArtist,
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
