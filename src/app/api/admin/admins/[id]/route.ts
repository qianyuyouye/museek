import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const adminId = parseInt(id, 10)
  if (isNaN(adminId)) return err('无效的管理员 ID')

  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      account: true,
      name: true,
      roleId: true,
      avatarUrl: true,
      status: true,
      multiLogin: true,
      createdBy: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  })

  if (!admin) return err('管理员不存在', 404)
  return ok(admin)
})

export const PUT = safeHandler(async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const adminId = parseInt(id, 10)
  if (isNaN(adminId)) return err('无效的管理员 ID')

  const existing = await prisma.adminUser.findUnique({ where: { id: adminId } })
  if (!existing) return err('管理员不存在', 404)

  const body = await request.json()
  const { name, roleId, status, multiLogin, avatarUrl } = body

  const admin = await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      ...(name !== undefined && { name }),
      ...(roleId !== undefined && { roleId }),
      ...(status !== undefined && { status }),
      ...(multiLogin !== undefined && { multiLogin }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
    select: {
      id: true,
      account: true,
      name: true,
      roleId: true,
      avatarUrl: true,
      status: true,
      multiLogin: true,
      createdBy: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  })

  await logAdminAction(request, {
    action: 'update_admin',
    targetType: 'admin_user',
    targetId: adminId,
    detail: { account: existing.account, changes: Object.keys(body).filter(k => body[k as keyof typeof body] !== undefined) },
  })
  return ok(admin)
})

export const DELETE = safeHandler(async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const adminId = parseInt(id, 10)
  if (isNaN(adminId)) return err('无效的管理员 ID')

  const target = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { role: { select: { isBuiltin: true } } },
  })
  if (!target) return err('管理员不存在', 404)

  // 不允许删除自己；不允许删除内置超管
  if (adminId === auth.userId) return err('不能删除自己', 400)
  if (target.role.isBuiltin) return err('内置角色（超级管理员）不能删除', 400)

  await prisma.adminUser.delete({ where: { id: adminId } })

  await logAdminAction(request, {
    action: 'delete_admin',
    targetType: 'admin_user',
    targetId: adminId,
    detail: { account: target.account, name: target.name },
  })
  return ok({ id: adminId })
})
