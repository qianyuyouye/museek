import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { sanitizeHtml } from '@/lib/sanitize'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.cms.view')
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

function normalizeSections(input: unknown): string[] | null {
  if (input === null || input === undefined || input === '') return null
  if (Array.isArray(input)) {
    const arr = input.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim())
    return arr.length > 0 ? arr : null
  }
  if (typeof input === 'string') {
    const arr = input.split('\n').map((s) => s.trim()).filter(Boolean)
    return arr.length > 0 ? arr : null
  }
  return null
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.cms.manage')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const {
    title, cover, category, type, content, videoUrl, status,
    sections, duration, level, author, tags, summary,
  } = body

  if (!title) return err('标题不能为空')
  if (typeof title !== 'string' || title.length > 200) return err('标题长度不能超过 200 字符')
  if (!category) return err('分类不能为空')
  if (typeof category !== 'string' || category.length > 50) return err('分类长度不能超过 50 字符')
  if (!type || !['video', 'article'].includes(type)) return err('类型必须为 video 或 article')
  if (status !== undefined && !['draft', 'published', 'archived'].includes(status)) {
    return err('状态必须为 draft / published / archived')
  }
  // video 类型时，视频源必填（除非存为 draft）
  if (type === 'video' && (status === 'published') && !videoUrl) {
    return err('视频类型发布时必须提供 videoUrl')
  }

  const safeContent = content ? sanitizeHtml(content) : null
  const sectionsJson = normalizeSections(sections)

  const item = await prisma.cmsContent.create({
    data: {
      title,
      cover: cover || null,
      category,
      type,
      content: safeContent,
      videoUrl: videoUrl || null,
      sections: sectionsJson === null ? undefined : sectionsJson,
      duration: duration || null,
      level: level || null,
      author: author || null,
      tags: tags || null,
      summary: summary || null,
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
