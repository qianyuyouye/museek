import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json()
  const { type, adminLevel, groupIds } = body

  const result = await prisma.$transaction(async (tx) => {
    // 更新用户类型和管理级别
    const updateData: Record<string, unknown> = {}
    if (type !== undefined) updateData.type = type
    if (adminLevel !== undefined) updateData.adminLevel = adminLevel

    if (Object.keys(updateData).length > 0) {
      await tx.user.update({ where: { id: userId }, data: updateData })
    }

    // 更新用户组关联
    if (groupIds !== undefined) {
      await tx.userGroup.deleteMany({ where: { userId } })
      if (Array.isArray(groupIds) && groupIds.length > 0) {
        await tx.userGroup.createMany({
          data: groupIds.map((gid: number) => ({ userId, groupId: gid })),
        })
      }
    }

    return tx.user.findUnique({
      where: { id: userId },
      include: {
        userGroups: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    })
  })

  await logAdminAction(request, {
    action: 'update_user_permissions',
    targetType: 'user',
    targetId: userId,
    detail: { name: user.name, phone: user.phone, type: result!.type, adminLevel: result!.adminLevel, groupIds: groupIds ?? null },
  })
  return ok({
    id: result!.id,
    type: result!.type,
    adminLevel: result!.adminLevel,
    groups: result!.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  })
})
