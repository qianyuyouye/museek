import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, parsePagination, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const rawPageSize = searchParams.get('pageSize')
  if (!rawPageSize) searchParams.set('pageSize', '8')
  const { page, pageSize, skip } = parsePagination(searchParams)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = { status: 'published' }
  if (category) where.category = category

  const [list, total] = await Promise.all([
    prisma.cmsContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.cmsContent.count({ where }),
  ])

  return ok({ list, total, page, pageSize })
})
