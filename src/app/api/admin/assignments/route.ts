import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { notify } from '@/lib/notifications'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.assignments.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const groupId = searchParams.get('groupId')

  const parsedGroupId = groupId ? parseInt(groupId, 10) : null
  if (groupId && isNaN(parsedGroupId!)) return err('无效的用户组 ID')

  const where = parsedGroupId ? { groupId: parsedGroupId } : {}

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: {
        group: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.assignment.count({ where }),
  ])

  const list = assignments.map(({ _count, group, ...a }) => ({
    ...a,
    groupName: group.name,
    submissionCount: _count.submissions,
  }))

  return ok({ list, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.assignments.manage')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { groupId, title, description, deadline } = body

  if (!groupId) return err('用户组不能为空')
  if (!title) return err('作业标题不能为空')
  if (!deadline) return err('截止日期不能为空')

  const gid = typeof groupId === 'number' ? groupId : parseInt(groupId, 10)
  if (isNaN(gid)) return err('无效的用户组 ID')

  // 计算该组成员数
  const totalMembers = await prisma.userGroup.count({
    where: { groupId: gid },
  })

  const assignment = await prisma.assignment.create({
    data: {
      groupId: gid,
      title,
      description: description || null,
      deadline: new Date(deadline),
      totalMembers,
      createdBy: auth.userId,
    },
  })

  await logAdminAction(request, {
    action: 'create_assignment',
    targetType: 'assignment',
    targetId: assignment.id,
    detail: { title: assignment.title, groupId: gid, deadline: assignment.deadline },
  })

  try {
    const members = await prisma.userGroup.findMany({
      where: { groupId: assignment.groupId, user: { type: 'creator', status: 'active' } },
      select: { userId: true },
    })
    await Promise.all(
      members.map((m) =>
        notify(
          m.userId,
          'tpl.assignment_created',
          {
            assignmentTitle: assignment.title,
            assignmentDescription: assignment.description ?? '',
            deadline: assignment.deadline ? assignment.deadline.toISOString().slice(0, 10) : '',
            assignmentId: assignment.id,
          },
          'assignment',
          assignment.id,
        ).catch((e) => console.error('[notify] assignment_created failed uid=', m.userId, e)),
      ),
    )
  } catch (e) {
    console.error('[notify] assignment broadcast failed:', e)
  }

  return ok(assignment)
})
