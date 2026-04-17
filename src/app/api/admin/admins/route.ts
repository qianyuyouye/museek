import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { hashPassword } from '@/lib/password'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
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
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { account, name, password, roleId, status, multiLogin, avatarUrl } = body

  if (!account) return err('账号不能为空')
  if (!name) return err('名称不能为空')
  if (!password) return err('密码不能为空')
  if (!roleId) return err('角色不能为空')

  const existing = await prisma.adminUser.findUnique({ where: { account } })
  if (existing) return err('账号已存在')

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

  return ok(admin)
})
