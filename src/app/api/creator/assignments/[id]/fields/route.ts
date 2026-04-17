import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { id } = await params
  const assignmentId = parseInt(id, 10)
  if (isNaN(assignmentId)) return err('无效的作业 ID')

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { groupId: true },
  })
  if (!assignment) return err('作业不存在', 404)

  // Verify user belongs to this group
  const membership = await prisma.userGroup.findFirst({
    where: { userId, groupId: assignment.groupId },
  })
  if (!membership) return err('无权限访问此作业', 403)

  const fields = await prisma.formFieldConfig.findMany({
    where: { groupId: assignment.groupId },
    orderBy: { displayOrder: 'asc' },
  })

  return ok({ fields })
})
