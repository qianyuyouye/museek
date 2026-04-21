import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { sanitizeHtml } from '@/lib/sanitize'

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

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.cms.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const contentId = Number(id)
  if (isNaN(contentId)) return err('无效的内容 ID')

  const item = await prisma.cmsContent.findUnique({ where: { id: contentId } })
  if (!item) return err('内容不存在', 404)

  // 访问详情时 views +1
  await prisma.cmsContent.update({ where: { id: item.id }, data: { views: { increment: 1 } } })

  return ok({ ...item, views: item.views + 1 })
})

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.cms.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const contentId = Number(id)
  if (isNaN(contentId)) return err('无效的内容 ID')

  const existing = await prisma.cmsContent.findUnique({ where: { id: contentId } })
  if (!existing) return err('内容不存在', 404)

  const body = await request.json()
  const {
    title, cover, category, type, content, videoUrl, status,
    sections, duration, level, author, tags, summary,
  } = body

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (cover !== undefined) data.cover = cover || null
  if (category !== undefined) data.category = category
  if (type !== undefined) {
    if (!['video', 'article'].includes(type)) return err('类型必须为 video 或 article')
    data.type = type
  }
  if (content !== undefined) data.content = content ? sanitizeHtml(content) : null
  if (videoUrl !== undefined) data.videoUrl = videoUrl || null
  if (sections !== undefined) {
    const s = normalizeSections(sections)
    data.sections = s === null ? null : s
  }
  if (duration !== undefined) data.duration = duration || null
  if (level !== undefined) data.level = level || null
  if (author !== undefined) data.author = author || null
  if (tags !== undefined) data.tags = tags || null
  if (summary !== undefined) data.summary = summary || null
  if (status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(status)) {
      return err('状态必须为 draft / published / archived')
    }
    // video 类型 published 前校验 videoUrl
    if (status === 'published') {
      const mergedType = (data.type as string) ?? existing.type
      const mergedVideoUrl = (data.videoUrl as string | null | undefined) ?? existing.videoUrl
      if (mergedType === 'video' && !mergedVideoUrl) {
        return err('视频类型发布时必须提供 videoUrl')
      }
    }
    data.status = status
  }

  const updated = await prisma.cmsContent.update({
    where: { id: contentId },
    data,
  })

  await logAdminAction(request, {
    action: 'update_content',
    targetType: 'cms_content',
    targetId: contentId,
    detail: { title: existing.title, changes: Object.keys(data) },
  })
  return ok(updated)
})

export const DELETE = safeHandler(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.cms.manage')
  if ('error' in auth) return auth.error

  const { id } = await params
  const contentId = Number(id)
  if (isNaN(contentId)) return err('无效的内容 ID')

  const existing = await prisma.cmsContent.findUnique({ where: { id: contentId } })
  if (!existing) return err('内容不存在', 404)

  // 先删学习记录（外键 RESTRICT）
  await prisma.learningRecord.deleteMany({ where: { contentId } })
  await prisma.cmsContent.delete({ where: { id: contentId } })

  await logAdminAction(request, {
    action: 'delete_content',
    targetType: 'cms_content',
    targetId: contentId,
    detail: { title: existing.title, type: existing.type },
  })
  return ok()
})
