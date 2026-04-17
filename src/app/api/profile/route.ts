import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  if (portal === 'admin') {
    const admin = await prisma.adminUser.findUnique({
      where: { id: userId },
      include: { role: { select: { id: true, name: true } } },
    })
    if (!admin) return err('用户不存在', 404)

    return ok({
      id: admin.id,
      account: admin.account,
      name: admin.name,
      avatarUrl: admin.avatarUrl,
      status: admin.status,
      multiLogin: admin.multiLogin,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
      createdAt: admin.createdAt,
      role: admin.role,
    })
  }

  // creator / reviewer
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userGroups: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
  })
  if (!user) return err('用户不存在', 404)

  return ok({
    id: user.id,
    name: user.name,
    realName: user.realName,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    type: user.type,
    adminLevel: user.adminLevel,
    realNameStatus: user.realNameStatus,
    agencyContract: user.agencyContract,
    agencySignedAt: user.agencySignedAt,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    groups: user.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  })
})

export const PUT = safeHandler(async function PUT(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const body = await request.json()
  const { name, email } = body as { name?: string; email?: string }

  if (portal === 'admin') {
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (Object.keys(data).length === 0) return err('无更新字段')

    await prisma.adminUser.update({ where: { id: userId }, data })
    return ok()
  }

  // creator / reviewer
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (email !== undefined) data.email = email
  if (Object.keys(data).length === 0) return err('无更新字段')

  await prisma.user.update({ where: { id: userId }, data })
  return ok()
})
