import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// SECRET 延迟到首次请求时计算，避免 build 阶段 throw
let _secret: Uint8Array | null = null
function SECRET(): Uint8Array {
  if (_secret) return _secret
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('JWT_SECRET environment variable is required in production')
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
]

function getLoginPath(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin/login'
  if (pathname.startsWith('/review')) return '/review/login'
  if (pathname.startsWith('/creator')) return '/creator/login'
  return '/creator/login'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname === '/') {
    return NextResponse.next()
  }

  const isApiRoute = pathname.startsWith('/api/')

  // CSRF 防护：对所有写方法 API 校验 Origin/Referer 是否同源
  // 同源规则：Origin 或 Referer 必须以 host 开头
  if (isApiRoute && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')
    const allowedOrigins = [
      `http://${host}`,
      `https://${host}`,
    ]
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
}
