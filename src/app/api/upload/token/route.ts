import { NextRequest } from 'next/server'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { validateUpload, createUploadToken } from '@/lib/upload'

/** 获取上传凭证：前端拿到 uploadUrl 后直接 PUT 文件 */
export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const body = await request.json()
  // 兼容两套命名：{fileName, fileSize, type} 与 {name, size, kind}
  const fileName: string | undefined = body.fileName ?? body.name
  const fileSize: number | undefined = body.fileSize ?? body.size
  const type: string | undefined = body.type ?? body.kind

  if (!fileName || !fileSize || !type) return err('缺少 fileName/fileSize/type（或别名 name/size/kind）')
  if (type !== 'audio' && type !== 'image') return err('type 必须是 audio 或 image')

  const error = validateUpload(fileName, fileSize, type)
  if (error) return err(error)

  const token = await createUploadToken(fileName, type, userId)
  return ok(token)
})
