import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

/** 手机号脱敏：中间4位替换为* */
function maskPhone(phone: string): string {
  if (phone.length >= 11) {
    return phone.slice(0, 3) + '****' + phone.slice(7)
  }
  return phone
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const type = searchParams.get('type')
  const realNameStatus = searchParams.get('realNameStatus')
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = {}

  if (type === 'creator' || type === 'reviewer') {
    where.type = type
  }

  if (realNameStatus) {
    where.realNameStatus = realNameStatus as Prisma.EnumRealNameStatusFilter['equals']
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { realName: { contains: search } },
      { phone: { contains: search } },
    ]
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        userGroups: {
          include: { group: { select: { id: true, name: true } } },
        },
        _count: { select: { songs: true } },
      },
    }),
  ])

  const list = users.map((u) => ({
    id: u.id,
    name: u.name,
    realName: u.realName,
    phone: maskPhone(u.phone),
    email: u.email,
    avatarUrl: u.avatarUrl,
    type: u.type,
    adminLevel: u.adminLevel,
    realNameStatus: u.realNameStatus,
    agencyContract: u.agencyContract,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    groups: u.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
    songCount: u._count.songs,
  }))

  return ok({ list, total, page, pageSize })
})
