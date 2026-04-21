import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(
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

  const body = await request.json()
  const { action } = body

  if (action !== 'publish' && action !== 'unpublish') {
    return err('action 必须为 publish 或 unpublish')
  }

  // 发布时：video 类型必须有 videoUrl
  if (action === 'publish' && existing.type === 'video' && !existing.videoUrl) {
    return err('视频类型发布时必须先填写视频地址 videoUrl')
  }

  // unpublish 走 archived（区分于从未发布的 draft）
  const status = action === 'publish' ? 'published' : 'archived'

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
