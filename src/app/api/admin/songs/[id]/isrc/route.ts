import { NextRequest } from 'next/server'
import { err, safeHandler } from '@/lib/api-utils'

/**
 * ISRC 绑定接口 — 已停用。
 * 前端已不再调用此接口，保留文件仅作占位提示。
 */
export const POST = safeHandler(async function POST(_request: NextRequest) {
  return err('ISRC 管理功能已停用')
})
