import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  // 查询用户所在的组
  const userGroups = await prisma.userGroup.findMany({
    where: { userId },
    select: { groupId: true },
  })

  const groupIds = userGroups.map((ug) => ug.groupId)
  if (groupIds.length === 0) {
    return ok({ list: [], total: 0, page, pageSize })
  }

  const where = { groupId: { in: groupIds } }

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: { group: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.assignment.count({ where }),
  ])

  // 查询当前用户已提交的作业
  const submittedSet = new Set(
    (
      await prisma.assignmentSubmission.findMany({
        where: {
          userId,
          assignmentId: { in: assignments.map((a) => a.id) },
        },
        select: { assignmentId: true },
      })
    ).map((s) => s.assignmentId),
  )

  const list = assignments.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    groupName: a.group.name,
    title: a.title,
    description: a.description,
    deadline: a.deadline,
    status: a.status,
    memberCount: a.totalMembers,
    submittedCount: a.submissionCount,
    submitted: submittedSet.has(a.id),
    createdAt: a.createdAt,
  }))

  return ok({ list, total, page, pageSize })
})
