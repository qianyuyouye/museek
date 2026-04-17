import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const contentId = Number(id)
  if (isNaN(contentId)) return err('无效的内容 ID')

  const existing = await prisma.cmsContent.findUnique({ where: { id: contentId } })
  if (!existing) return err('内容不存在', 404)

  const body = await request.json()
  const { action } = body

  if (action !== 'publish' && action !== 'unpublish') {
    return err('action 必须为 publish 或 unpublish')
  }

  const status = action === 'publish' ? 'published' : 'draft'

  const updated = await prisma.cmsContent.update({
    where: { id: contentId },
    data: { status },
  })

  await logAdminAction(request, {
    action: action === 'publish' ? 'publish_content' : 'unpublish_content',
    targetType: 'cms_content',
    targetId: contentId,
    detail: { title: existing.title },
  })
  return ok(updated)
})
