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

  // 列表页每加载一条记录 views +1（记录被浏览的次数）
  await Promise.all(
    list.map((item) =>
      prisma.cmsContent.update({ where: { id: item.id }, data: { views: { increment: 1 } } }).catch(() => {}),
    ),
  )

  const listWithViews = list.map((item) => ({
    ...item,
    views: item.views + 1,
  }))

  return ok({ list: listWithViews, total, page, pageSize })
})
