import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import path from 'path'
import { safeHandler, err } from '@/lib/api-utils'
import { verifyLocalGetSig, signGetUrl } from '@/lib/signature'
import { getSetting, SETTING_KEYS } from '@/lib/system-settings'

const CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export const GET = safeHandler(async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params
  const key = decodeURIComponent(segments.join('/'))

  // 路径穿越硬防
  if (key.includes('..')) return err('非法路径', 400)
  if (!key.startsWith('uploads/audio/') && !key.startsWith('uploads/images/')) {
    return err('非法路径', 400)
  }

  // OSS 模式兜底：重定向到 OSS 签名直链
  const cfg = await getSetting<{ mode?: string }>(SETTING_KEYS.STORAGE_CONFIG, {})
  const mode = cfg.mode ?? (process.env.OSS_BUCKET ? 'oss' : 'local')
  if (mode === 'oss') {
    const ossUrl = await signGetUrl(key, { ttlSec: 3600 })
    return NextResponse.redirect(ossUrl, 302)
  }

  // 验签
  const sigErr = verifyLocalGetSig(key, request.nextUrl.searchParams)
  if (sigErr) return err(sigErr, 403)

  const root = path.resolve(process.cwd(), process.env.STORAGE_ROOT || './storage')
  const fullPath = path.resolve(root, key)
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    return err('非法路径', 400)
  }
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    return err('文件不存在', 404)
  }

  const ext = path.extname(key).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'
  const buffer = await readFile(fullPath)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  })
})
