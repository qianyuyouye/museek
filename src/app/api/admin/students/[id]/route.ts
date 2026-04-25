import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
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
  const auth = await requirePermission(request, 'admin.students.view')
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
    agencyApplied: user.agencyApplied,
    agencyAppliedAt: user.agencyAppliedAt,
    agencyRejectReason: user.agencyRejectReason,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    groups: user.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
    songCount: user._count.songs,
    totalRevenue: revenueResult._sum.creatorAmount ?? 0,
  })
})

export const PUT = safeHandler(async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission(request, 'admin.students.edit')
  if ('error' in auth) return auth.error

  const { id } = await context.params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) return err('用户不存在', 404)

  const body = await request.json()
  const { name, email, status, adminLevel, phone, realName, avatarUrl, groupIds } = body

  // Check phone uniqueness before applying changes
  if (phone !== undefined) {
    if (typeof phone !== 'string' || !/^1[3-9]\d{9}$/.test(phone)) {
      return err('手机号格式不正确')
    }
    const phoneExists = await prisma.user.findUnique({ where: { phone } })
    if (phoneExists && phoneExists.id !== userId) {
      return err('该手机号已被其他用户使用')
    }
  }

  const validStatuses = ['active', 'disabled']
  const validAdminLevels = [null, 'group_admin', 'system_admin']
  const data: Record<string, unknown> = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) return err('昵称不能为空')
    data.name = name.trim()
  }
  if (realName !== undefined) {
    if (typeof realName !== 'string' || realName.trim().length === 0) return err('真实姓名不能为空')
    data.realName = realName.trim()
  }
  if (phone !== undefined) data.phone = phone
  if (email !== undefined) data.email = email || null
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null
  if (status !== undefined) {
    if (!validStatuses.includes(status)) return err('无效的状态值')
    data.status = status
  }
  if (adminLevel !== undefined) {
    if (!validAdminLevels.includes(adminLevel)) return err('无效的管理级别')
    data.adminLevel = adminLevel
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  })

  // Update group assignments if groupIds provided
  if (groupIds !== undefined) {
    if (!Array.isArray(groupIds)) return err('groupIds 必须是数组')
    const groups = await prisma.group.findMany({ where: { id: { in: groupIds } } })
    if (groups.length !== groupIds.length) return err('部分用户组不存在')
    await prisma.userGroup.deleteMany({ where: { userId } })
    if (groupIds.length > 0) {
      await prisma.userGroup.createMany({
        data: groupIds.map((gid: number) => ({ userId, groupId: gid })),
      })
    }
  }

  await logAdminAction(request, {
    action: 'update_student',
    targetType: 'user',
    targetId: userId,
    detail: { name: existing.name, phone: existing.phone, changes: Object.keys(data) },
  })
  return ok({
    id: updated.id,
    name: updated.name,
    realName: updated.realName,
    phone: updated.phone,
    email: updated.email,
    avatarUrl: updated.avatarUrl,
    status: updated.status,
    adminLevel: updated.adminLevel,
  })
})
