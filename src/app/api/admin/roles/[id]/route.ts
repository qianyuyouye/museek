import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'admin.roles.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const roleId = parseInt(id, 10)
  if (isNaN(roleId)) return err('无效的角色 ID')

  const role = await prisma.adminRole.findUnique({
    where: { id: roleId },
    include: { _count: { select: { admins: true } } },
  })

  if (!role) return err('角色不存在', 404)

  const { _count, ...r } = role
  return ok({ ...r, adminCount: _count.admins })
})

export const PUT = safeHandler(async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'admin.roles.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const roleId = parseInt(id, 10)
  if (isNaN(roleId)) return err('无效的角色 ID')

  const existing = await prisma.adminRole.findUnique({ where: { id: roleId } })
  if (!existing) return err('角色不存在', 404)

  const body = await request.json()
  const { name, description, permissions } = body

  const role = await prisma.adminRole.update({
    where: { id: roleId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(permissions !== undefined && { permissions }),
    },
  })

  await logAdminAction(request, {
    action: 'update_role',
    targetType: 'admin_role',
    targetId: roleId,
    detail: { name: role.name, changes: Object.keys(body).filter(k => body[k as keyof typeof body] !== undefined) },
  })
  return ok(role)
})

export const DELETE = safeHandler(async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'admin.roles.manage')
  if ('error' in auth) return auth.error

  const { id } = await params
  const roleId = parseInt(id, 10)
  if (isNaN(roleId)) return err('无效的角色 ID')

  const role = await prisma.adminRole.findUnique({
    where: { id: roleId },
    include: { _count: { select: { admins: true } } },
  })

  if (!role) return err('角色不存在', 404)
  if (role.isBuiltin) return err('内置角色不能删除')
  if (role._count.admins > 0) return err('该角色下还有管理员，不能删除')

  await prisma.adminRole.delete({ where: { id: roleId } })

  await logAdminAction(request, {
    action: 'delete_role',
    targetType: 'admin_role',
    targetId: roleId,
    detail: { name: role.name },
  })
  return ok()
})
