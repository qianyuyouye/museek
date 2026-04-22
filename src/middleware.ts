import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { ipRateLimit } from '@/lib/rate-limit'

// Theme 8: 切到 Node runtime，支持在 middleware 里查 TokenBlacklist + rate_limits DB 表
// Next.js 15 稳定支持。

// SECRET 延迟到首次请求时计算，避免 build 阶段 throw
let _secret: Uint8Array | null = null
let _warnedFallback = false
function SECRET(): Uint8Array {
  if (_secret) return _secret
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }
  if (!jwtSecret && !_warnedFallback) {
    console.warn('\n[middleware] ⚠️  JWT_SECRET 未设置，正在使用 fallback-dev-secret（仅开发环境可用）')
    _warnedFallback = true
  }
  _secret = new TextEncoder().encode(jwtSecret || 'fallback-dev-secret')
  return _secret
}

const PUBLIC_PATHS = [
  '/admin/login', '/creator/login', '/review/login',
  '/api/auth',
  // 公开只读接口（作品广场 + 已发布内容）
  '/api/content',
  '/api/songs/published',
  '/api/files',
  // 签名上传（upload/local 路径有 HMAC 签名鉴权）
  '/api/upload/local/',
]

function getLoginPath(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin/login'
  if (pathname.startsWith('/review')) return '/review/login'
  if (pathname.startsWith('/creator')) return '/creator/login'
  return '/creator/login'
}

function getClientIpFromRequest(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || ''
}

const isTestBypass = () => process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api/')

  // 静态资源直通
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/logo') || pathname === '/') {
    return NextResponse.next()
  }

  // Theme 8: 全局 API 限流 60/min/IP（PRD §10.6）
  if (isApiRoute && !isTestBypass()) {
    const ip = getClientIpFromRequest(request)
    if (ip && (await ipRateLimit(ip, 'api:all', 60, 60 * 1000))) {
      return NextResponse.json({ code: 429, message: '请求过于频繁，请稍后再试' }, { status: 429 })
    }
  }

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Theme 8: CSRF 严格模式 —— origin 和 referer 都缺失直接 403
  // 注意：TEST_MODE 不绕过 CSRF（测试套件专门构造跨源场景验证 403）
  if (isApiRoute && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')
    if (!origin && !referer) {
      return NextResponse.json({ code: 403, message: 'CSRF 检查失败：缺少来源头' }, { status: 403 })
    }
    const allowedOrigins = [`http://${host}`, `https://${host}`]
    const originOk = !origin || allowedOrigins.includes(origin)
    const refererOk = !referer || allowedOrigins.some(a => referer.startsWith(a))
    if ((origin && !originOk) || (!origin && referer && !refererOk)) {
      return NextResponse.json({ code: 403, message: 'CSRF 检查失败：来源不可信' }, { status: 403 })
    }
  }

  const token = request.cookies.get('access_token')?.value
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
    }
    return NextResponse.redirect(new URL(getLoginPath(pathname), request.url))
  }

  try {
    const { payload } = await jwtVerify(token, SECRET())
    const portal = payload.portal as string
    const jti = payload.jti as string | undefined

    // Theme 8: blacklist 校验（logout 后的 token 即使未自然过期也拒绝）
    if (jti) {
      const blacklisted = await prisma.tokenBlacklist.findUnique({ where: { jti } })
      if (blacklisted) {
        if (isApiRoute) {
          return NextResponse.json({ code: 401, message: '登录已失效' }, { status: 401 })
        }
        const response = NextResponse.redirect(new URL(getLoginPath(pathname), request.url))
        response.cookies.delete('access_token')
        response.cookies.delete('refresh_token')
        return response
      }
    }

    if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && portal !== 'admin') {
      if (isApiRoute) {
        return NextResponse.json({ code: 401, message: '无权限' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    if ((pathname.startsWith('/creator') || pathname.startsWith('/api/creator')) && portal !== 'creator') {
      if (isApiRoute) {
        return NextResponse.json({ code: 401, message: '无权限' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/creator/login', request.url))
    }
    if ((pathname.startsWith('/review') || pathname.startsWith('/api/review')) && portal !== 'reviewer') {
      if (isApiRoute) {
        return NextResponse.json({ code: 401, message: '无权限' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/review/login', request.url))
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', String(payload.sub))
    requestHeaders.set('x-user-portal', portal)

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  } catch {
    if (isApiRoute) {
      return NextResponse.json({ code: 401, message: 'token 已过期' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL(getLoginPath(pathname), request.url))
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs',
}
