import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler} from '@/lib/api-utils'
import { decryptIdCard } from '@/lib/encrypt'

/** 手机号脱敏：中间4位替换为* */
function maskPhone(phone: string): string {
  if (phone.length >= 11) {
    return phone.slice(0, 3) + '****' + phone.slice(7)
  }
  return phone
}

/** 尝试解密身份证；老数据若为 18 位明文直接返回，其他异常返回原值 */
function revealIdCard(stored: string | null): string | null {
  if (!stored) return null
  if (/^\d{17}[\dXx]$/.test(stored)) return stored
  try {
    return decryptIdCard(stored)
  } catch {
    return stored
  }
}

type RouteContext = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await context.params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userGroups: {
        include: { group: { select: { id: true, name: true } } },
      },
      _count: { select: { songs: true } },
    },
  })

  if (!user) return err('用户不存在', 404)

  // 查询总收益：settlements 表中 settleStatus='paid' 的 creatorAmount 之和
  const revenueResult = await prisma.settlement.aggregate({
    where: { creatorId: userId, settleStatus: 'paid' },
    _sum: { creatorAmount: true },
  })

  return ok({
    id: user.id,
    name: user.name,
    realName: user.realName,
    idCard: revealIdCard(user.idCard),
    phone: maskPhone(user.phone),
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
    songCount: user._count.songs,
    totalRevenue: revenueResult._sum.creatorAmount ?? 0,
  })
})

export const PUT = safeHandler(async function PUT(request: NextRequest, context: RouteContext) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await context.params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) return err('用户不存在', 404)

  const body = await request.json()
  const { name, email, status, adminLevel } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (email !== undefined) data.email = email
  if (status !== undefined) data.status = status
  if (adminLevel !== undefined) data.adminLevel = adminLevel

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  })

  return ok({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    status: updated.status,
    adminLevel: updated.adminLevel,
  })
})
