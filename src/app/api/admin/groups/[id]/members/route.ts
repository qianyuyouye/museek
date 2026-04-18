import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const groupId = parseInt(id, 10)
  if (isNaN(groupId)) return err('无效的用户组 ID')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return err('用户组不存在', 404)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const where = { groupId }

  const [members, total] = await Promise.all([
    prisma.userGroup.findMany({
      where,
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
      skip,
      take: pageSize,
    }),
    prisma.userGroup.count({ where }),
  ])

  const list = members.map((ug) => ({
    ...ug.user,
    joinedAt: ug.joinedAt,
  }))

  return ok({ list, total, page, pageSize })
})

export const DELETE = safeHandler(async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const groupId = parseInt(id, 10)
  if (isNaN(groupId)) return err('无效的用户组 ID')

  const { userId } = await request.json()
  if (!userId) return err('userId 不能为空')

  const membership = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId } },
  })
  if (!membership) return err('该用户不在此用户组中', 404)

  await prisma.userGroup.delete({
    where: { userId_groupId: { userId, groupId } },
  })

  await logAdminAction(request, {
    action: 'remove_group_member',
    targetType: 'user_group',
    targetId: `${userId}-${groupId}`,
    detail: { userId, groupId },
  })
  return ok()
})
