import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request)
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
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const contentId = Number(id)
  if (isNaN(contentId)) return err('无效的内容 ID')

  const existing = await prisma.cmsContent.findUnique({ where: { id: contentId } })
  if (!existing) return err('内容不存在', 404)

  const body = await request.json()
  const { title, cover, category, type, content, status } = body

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (cover !== undefined) data.cover = cover || null
  if (category !== undefined) data.category = category
  if (type !== undefined) {
    if (!['video', 'article'].includes(type)) return err('类型必须为 video 或 article')
    data.type = type
  }
  if (content !== undefined) data.content = content || null
  if (status !== undefined) data.status = status

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
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const contentId = Number(id)
  if (isNaN(contentId)) return err('无效的内容 ID')

  const existing = await prisma.cmsContent.findUnique({ where: { id: contentId } })
  if (!existing) return err('内容不存在', 404)

  await prisma.cmsContent.delete({ where: { id: contentId } })

  await logAdminAction(request, {
    action: 'delete_content',
    targetType: 'cms_content',
    targetId: contentId,
    detail: { title: existing.title, type: existing.type },
  })
  return ok()
})
