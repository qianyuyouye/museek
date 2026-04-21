import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword } from '@/lib/password'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.admins.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const search = searchParams.get('search')?.trim()

  const where = search
    ? { OR: [{ account: { contains: search } }, { name: { contains: search } }] }
    : {}

  const [list, total] = await Promise.all([
    prisma.adminUser.findMany({
      where,
      select: {
        id: true,
        account: true,
        name: true,
        roleId: true,
        avatarUrl: true,
        status: true,
        multiLogin: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdBy: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.adminUser.count({ where }),
  ])

  return ok({ list, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.admins.manage')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { account, name, password, roleId, status, multiLogin, avatarUrl } = body

  if (!account) return err('账号不能为空')
  if (!name) return err('名称不能为空')
  if (!password) return err('密码不能为空')
  if (!roleId) return err('角色不能为空')

  const existing = await prisma.adminUser.findUnique({ where: { account } })
  if (existing) return err('账号已存在')

  // 超级管理员唯一性：roleId=1（内置超管角色）只允许存在一个
  if (roleId === 1) {
    const existingSuper = await prisma.adminUser.count({ where: { roleId: 1 } })
    if (existingSuper >= 1) {
      return err('超级管理员已存在，不可重复创建', 409)
    }
  }

  // 内置角色（超级管理员）唯一性：不允许创建第二个
  const role = await prisma.adminRole.findUnique({
    where: { id: roleId },
    select: { id: true, isBuiltin: true },
  })
  if (!role) return err('角色不存在')
  if (role.isBuiltin) {
    const count = await prisma.adminUser.count({ where: { roleId: role.id } })
    if (count > 0) return err('内置角色（超级管理员）唯一，不允许创建第二个', 409)
  }

  const passwordHash = await hashPassword(password)

  const admin = await prisma.adminUser.create({
    data: {
      account,
      name,
      passwordHash,
      roleId,
      status: status ?? true,
      multiLogin: multiLogin ?? false,
      avatarUrl: avatarUrl ?? null,
      createdBy: auth.userId,
    },
    select: {
      id: true,
      account: true,
      name: true,
      roleId: true,
      status: true,
      multiLogin: true,
      createdBy: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  })

  await logAdminAction(request, {
    action: 'create_admin',
    targetType: 'admin_user',
    targetId: admin.id,
    detail: { account: admin.account, name: admin.name, roleId: admin.roleId },
  })
  return ok(admin)
})
