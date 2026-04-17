import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const groupId = parseInt(id, 10)
  if (isNaN(groupId)) return err('无效的用户组 ID')

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      userGroups: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatarUrl: true,
              realNameStatus: true,
              status: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      },
      _count: { select: { userGroups: true } },
    },
  })

  if (!group) return err('用户组不存在', 404)

  const { _count, userGroups, ...rest } = group
  return ok({
    ...rest,
    memberCount: _count.userGroups,
    members: userGroups.map((ug) => ({
      ...ug.user,
      joinedAt: ug.joinedAt,
    })),
  })
})

export const PUT = safeHandler(async function PUT(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const groupId = parseInt(id, 10)
  if (isNaN(groupId)) return err('无效的用户组 ID')

  const existing = await prisma.group.findUnique({ where: { id: groupId } })
  if (!existing) return err('用户组不存在', 404)

  const body = await request.json()
  const { name, description, status, inviteCode } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (description !== undefined) data.description = description
  if (status !== undefined) data.status = status
  if (inviteCode !== undefined) {
    // 检查邀请码是否已被其他用户组占用
    const codeExists = await prisma.group.findFirst({
      where: { inviteCode, id: { not: groupId } },
    })
    if (codeExists) return err('邀请码已被其他用户组占用')
    data.inviteCode = inviteCode
    data.inviteLink = `https://aimusic.com/join/${inviteCode}`
  }

  try {
    const group = await prisma.group.update({
      where: { id: groupId },
      data,
    })

    const isRegenCode = inviteCode !== undefined && inviteCode !== existing.inviteCode
    await logAdminAction(request, {
      action: isRegenCode ? 'regen_invite_code' : 'update_group',
      targetType: 'group',
      targetId: group.id,
      detail: isRegenCode
        ? { name: group.name, oldCode: existing.inviteCode, newCode: group.inviteCode }
        : { name: group.name, changes: Object.keys(data) },
    })
    return ok(group)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return err('邀请码已被占用，请重试')
    }
    throw e
  }
})

export const DELETE = safeHandler(async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const groupId = parseInt(id, 10)
  if (isNaN(groupId)) return err('无效的用户组 ID')

  const existing = await prisma.group.findUnique({ where: { id: groupId } })
  if (!existing) return err('用户组不存在', 404)

  // 先删除关联的 userGroups 记录（事务保证原子性）
  await prisma.$transaction([
    prisma.userGroup.deleteMany({ where: { groupId } }),
    prisma.group.delete({ where: { id: groupId } }),
  ])

  await logAdminAction(request, {
    action: 'delete_group',
    targetType: 'group',
    targetId: groupId,
    detail: { name: existing.name },
  })
  return ok()
})
