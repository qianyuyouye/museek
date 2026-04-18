import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const users = await prisma.user.findMany({
    where: { type: 'creator', status: 'active' },
    select: { id: true, name: true, realName: true, phone: true },
    orderBy: { id: 'asc' },
  })

  const creators = users.map((u) => ({
    id: u.id,
    name: u.realName || u.name || '未命名',
    phone: u.phone,
  }))

  return ok({ creators })
})
