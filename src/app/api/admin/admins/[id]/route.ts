import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler } from '@/lib/api-utils'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request)
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
  const auth = requireAdmin(request)
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

  return ok(admin)
})
