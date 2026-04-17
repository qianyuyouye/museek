import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getCurrentUser, safeHandler } from '@/lib/api-utils'

/** 开发环境本地文件存储：接收 PUT 请求保存到 public/ */
export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  // 生产环境禁用本地上传，必须走 OSS
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ code: 404, message: 'Not Found' }, { status: 404 })
  }

  const { userId } = getCurrentUser(request)
  if (!userId) {
    return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
  }

  const { path: segments } = await context.params
  const filePath = decodeURIComponent(segments.join('/'))

  // 安全检查：不允许路径穿越
  if (filePath.includes('..')) {
    return NextResponse.json({ code: 400, message: '非法路径' }, { status: 400 })
  }

  const publicDir = path.resolve(process.cwd(), 'public')
  const fullPath = path.resolve(publicDir, filePath)

  // 确保解析后的路径仍在 public 目录内
  if (!fullPath.startsWith(publicDir + path.sep) && fullPath !== publicDir) {
    return NextResponse.json({ code: 400, message: '非法路径' }, { status: 400 })
  }
  const dir = path.dirname(fullPath)

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const buffer = Buffer.from(await request.arrayBuffer())
  await writeFile(fullPath, buffer)

  return NextResponse.json({ code: 200, data: { url: `/${filePath}`, size: buffer.length } })
})
