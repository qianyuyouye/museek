import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { getSetting } from '@/lib/system-settings'
import { SETTING_KEYS } from '@/lib/system-settings'

async function buildInviteLink(inviteCode: string): Promise<string> {
  const domain = await getSetting<string>(SETTING_KEYS.INVITE_LINK_DOMAIN, '')
  const baseUrl = domain || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl}/join/${inviteCode}`
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.groups.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status') as 'active' | 'paused' | null

  const where = status ? { status } : {}

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where,
      include: { _count: { select: { userGroups: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.group.count({ where }),
  ])

  const list = groups.map(({ _count, ...g }) => ({
    ...g,
    memberCount: _count.userGroups,
  }))

  return ok({ list, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.groups.manage')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { name, description, status } = body

  if (!name) return err('用户组名称不能为空')

  // 生成唯一 inviteCode
  let inviteCode = body.inviteCode as string | undefined
  if (!inviteCode) {
    for (let i = 0; i < 10; i++) {
      inviteCode = generateInviteCode()
      const exists = await prisma.group.findUnique({ where: { inviteCode } })
      if (!exists) break
      if (i === 9) return err('邀请码生成失败，请重试', 500)
    }
  }

  const inviteLink = await buildInviteLink(inviteCode!)

  try {
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        inviteCode: inviteCode!,
        inviteLink,
        status: status || 'active',
        createdBy: auth.userId,
      },
    })

    await logAdminAction(request, {
      action: 'create_group',
      targetType: 'group',
      targetId: group.id,
      detail: { name: group.name, inviteCode: group.inviteCode },
    })
    return ok(group)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return err('邀请码已被占用，请重试')
    }
    throw e
  }
})
