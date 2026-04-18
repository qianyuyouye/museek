import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const rawPageSize = searchParams.get('pageSize')
  if (!rawPageSize) searchParams.set('pageSize', '8')
  const { page, pageSize, skip } = parsePagination(searchParams)
  const type = searchParams.get('type') as 'video' | 'article' | null
  const category = searchParams.get('category')

  const where: Record<string, unknown> = {}
  if (type) where.type = type
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

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { title, cover, category, type, content, status } = body

  if (!title) return err('标题不能为空')
  if (!category) return err('分类不能为空')
  if (!type || !['video', 'article'].includes(type)) return err('类型必须为 video 或 article')

  const item = await prisma.cmsContent.create({
    data: {
      title,
      cover: cover || null,
      category,
      type,
      content: content || null,
      status: status || 'draft',
      createdBy: auth.userId,
    },
  })

  await logAdminAction(request, {
    action: 'create_content',
    targetType: 'cms_content',
    targetId: item.id,
    detail: { title: item.title, type: item.type, category: item.category },
  })
  return ok(item)
})
