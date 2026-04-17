import { NextRequest, NextResponse } from 'next/server'

/** 从 middleware 注入的 header 获取当前用户信息 */
export function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const portal = request.headers.get('x-user-portal')
  return {
    userId: userId ? parseInt(userId, 10) : null,
    portal: portal as 'admin' | 'creator' | 'reviewer' | null,
  }
}

/** 管理端鉴权：必须是 admin portal */
export function requireAdmin(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'admin') {
    return { error: NextResponse.json({ code: 403, message: '无权限' }, { status: 403 }) }
  }
  return { userId, portal }
}

/** 统一成功响应 */
export function ok(data: unknown = null) {
  return NextResponse.json({ code: 200, data })
}

/** 统一错误响应 */
export function err(message: string, status = 400) {
  return NextResponse.json({ code: status, message }, { status })
}

/** 解析分页参数 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** 获取客户端 IP */
export function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || ''
}

/** 安全包装 handler，捕获未处理异常，避免 500 泄露堆栈 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (...args: any[]) => Promise<any>

export function safeHandler<T extends RouteHandler>(handler: T): T {
  const wrapped = async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      const request = args[0] as NextRequest
      console.error('[API Error]', request.method, request.nextUrl.pathname, error)
      return NextResponse.json({ code: 500, message: '服务器内部错误' }, { status: 500 })
    }
  }
  return wrapped as T
}
