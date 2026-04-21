import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getCurrentUser, safeHandler, err } from '@/lib/api-utils'
import { verifyLocalPutSig } from '@/lib/signature'
import { checkMagicBytes } from '@/lib/magic-bytes'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_UPLOAD) {
    return NextResponse.json({ code: 404, message: 'Not Found' }, { status: 404 })
  }

  const { userId } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const { path: segments } = await context.params
  const key = decodeURIComponent(segments.join('/'))

  if (key.includes('..')) {
    return err('非法路径', 400)
  }
  if (!key.startsWith('uploads/audio/') && !key.startsWith('uploads/images/')) {
    return err('非法路径', 400)
  }

  // 验签
  const sigErr = verifyLocalPutSig(key, request.nextUrl.searchParams, userId)
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
