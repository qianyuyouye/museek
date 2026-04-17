import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, parsePagination, safeHandler} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const tab = searchParams.get('tab')
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = {}

  if (tab === 'reviewer' || tab === 'creator') {
    where.type = tab
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { realName: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
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
      },
    }),
  ])

  const list = users.map((u) => ({
    id: u.id,
    name: u.name,
    realName: u.realName,
    phone: u.phone,
    email: u.email,
    avatarUrl: u.avatarUrl,
    type: u.type,
    adminLevel: u.adminLevel,
    realNameStatus: u.realNameStatus,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    groups: u.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  }))

  return ok({ list, total, page, pageSize })
})
