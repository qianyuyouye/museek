import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

type Params = { params: Promise<{ id: string }> }

// GET 已删除：成员列表通过 GET /api/admin/groups/:id 获取（含 members 数组）

export const DELETE = safeHandler(async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'admin.groups.manage')
  if ('error' in auth) return auth.error

  const { id } = await params
  const groupId = parseInt(id, 10)
  if (isNaN(groupId)) return err('无效的用户组 ID')

  const { userId } = await request.json()
  if (!userId) return err('userId 不能为空')

  const membership = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId } },
  })
  if (!membership) return err('该用户不在此用户组中', 404)

  await prisma.userGroup.delete({
    where: { userId_groupId: { userId, groupId } },
  })

  await logAdminAction(request, {
    action: 'remove_group_member',
    targetType: 'user_group',
    targetId: `${userId}-${groupId}`,
    detail: { userId, groupId },
  })
  return ok()
})
