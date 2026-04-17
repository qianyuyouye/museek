import { NextResponse } from 'next/server'
import { clearAuthCookies } from '@/lib/auth'
import { safeHandler } from '@/lib/api-utils'

export const POST = safeHandler(async function POST() {
  await clearAuthCookies()
  return NextResponse.json({ code: 200, message: '已退出登录' })
})
