import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const [roles, total] = await Promise.all([
    prisma.adminRole.findMany({
      include: { _count: { select: { admins: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.adminRole.count(),
  ])

  const list = roles.map(({ _count, ...r }) => ({
    ...r,
    adminCount: _count.admins,
  }))

  return ok({ list, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { name, description, permissions } = body

  if (!name) return err('角色名称不能为空')
  if (!permissions) return err('权限配置不能为空')

  const role = await prisma.adminRole.create({
    data: {
      name,
      description: description || null,
      permissions,
      createdBy: auth.userId,
    },
  })

  await logAdminAction(request, {
    action: 'create_role',
    targetType: 'admin_role',
    targetId: role.id,
    detail: { name: role.name },
  })
  return ok(role)
})
