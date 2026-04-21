import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

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
    include: {
      group: { select: { name: true } },
      _count: { select: { submissions: true } },
    },
  })

  if (!assignment) return err('作业不存在', 404)

  const { _count, group, ...rest } = assignment

  return ok({
    ...rest,
    groupName: group.name,
    submissionCount: _count.submissions,
  })
})

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.assignments.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const assignmentId = parseInt(id, 10)
  if (isNaN(assignmentId)) return err('无效的作业 ID')

  const body = await request.json()
  const { title, description, deadline, status } = body

  const existing = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  })
  if (!existing) return err('作业不存在', 404)

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (description !== undefined) data.description = description
  if (deadline !== undefined) data.deadline = new Date(deadline)
  if (status !== undefined) data.status = status

  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data,
  })

  await logAdminAction(request, {
    action: 'update_assignment',
    targetType: 'assignment',
    targetId: assignmentId,
    detail: { title: existing.title, changes: Object.keys(data) },
  })
  return ok(assignment)
})

export const DELETE = safeHandler(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.assignments.manage')
  if ('error' in auth) return auth.error

  const { id } = await params
  const assignmentId = parseInt(id, 10)
  if (isNaN(assignmentId)) return err('无效的作业 ID')

  const existing = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  })
  if (!existing) return err('作业不存在', 404)

  await prisma.assignment.delete({
    where: { id: assignmentId },
  })

  await logAdminAction(request, {
    action: 'delete_assignment',
    targetType: 'assignment',
    targetId: assignmentId,
    detail: { title: existing.title },
  })
  return ok()
})
