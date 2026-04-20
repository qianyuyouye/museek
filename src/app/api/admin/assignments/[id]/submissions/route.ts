import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.assignments.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const assignmentId = parseInt(id, 10)
  if (isNaN(assignmentId)) return err('无效的作业 ID')

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  })
  if (!assignment) return err('作业不存在', 404)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const where = { assignmentId }

  const [submissions, total] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, realName: true } },
        platformSong: {
          select: {
            id: true,
            title: true,
            aiTools: true,
            score: true,
            status: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.assignmentSubmission.count({ where }),
  ])

  return ok({ list: submissions, total, page, pageSize })
})
