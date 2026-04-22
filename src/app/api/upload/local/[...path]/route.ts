import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { safeHandler, err } from '@/lib/api-utils'
import { verifyLocalPutSig } from '@/lib/signature'
import { checkMagicBytes } from '@/lib/magic-bytes'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_UPLOAD) {
    return NextResponse.json({ code: 404, message: 'Not Found' }, { status: 404 })
  }

  // 此路由在 PUBLIC_PATHS 中，不走 middleware cookie 鉴权，
  // 安全由 URL 中的 HMAC 签名保障（verifyLocalPutSig 会校验 userId/portal 匹配）。
  const rawUid = request.nextUrl.searchParams.get('uid')
  const rawPortal = request.nextUrl.searchParams.get('portal')
  if (!rawUid || !rawPortal) return err('缺少签名参数', 403)
  const userId = parseInt(rawUid, 10)
  if (Number.isNaN(userId)) return err('非法签名', 403)
  const portal = rawPortal as 'admin' | 'creator' | 'reviewer'

  const { path: segments } = await context.params
  const key = decodeURIComponent(segments.join('/'))

  if (key.includes('..')) {
    return err('非法路径', 400)
  }
  if (!key.startsWith('uploads/audio/') && !key.startsWith('uploads/images/')) {
    return err('非法路径', 400)
  }

  // 验签（含 portal）
  const sigErr = verifyLocalPutSig(key, request.nextUrl.searchParams, userId, portal)
  if (sigErr) return err(sigErr, 403)

  const type: 'audio' | 'image' = key.startsWith('uploads/audio/') ? 'audio' : 'image'

  const buffer = Buffer.from(await request.arrayBuffer())

  // magic-bytes
  const magicErr = checkMagicBytes(buffer, type)
  if (magicErr) return err(magicErr, 400)

  const root = path.resolve(process.cwd(), process.env.STORAGE_ROOT || './storage')
  const fullPath = path.resolve(root, key)

  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    return err('非法路径', 400)
  }

  const dir = path.dirname(fullPath)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(fullPath, buffer)

  return NextResponse.json({ code: 200, data: { key, size: buffer.length } })
})
