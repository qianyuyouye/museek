import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'

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

/**
 * 按 URL 与 HTTP method 兜底推断权限 key（6 种 action）。
 * 推荐所有受保护 API 显式传 key，infer 仅作为兜底。
 * 约定：/api/admin/{module}/... → admin.{module}.{action}
 */
function inferPermissionKey(request: NextRequest): string {
  const path = request.nextUrl.pathname
  const search = request.nextUrl.searchParams
  const method = request.method.toUpperCase()
  const m = path.match(/^\/api\/admin\/([^\/]+)/)
  if (!m) return 'admin.unknown.view'

  // module 段归一化（连字符 → 下划线；content → cms）
  const rawModule = m[1]
  let moduleName =
    rawModule === 'content' ? 'cms'
    : rawModule === 'publish-confirm' ? 'publish_confirm'
    : rawModule === 'batch-download' ? 'batch_download'
    : rawModule

  // songs 子路径的模块纠偏
  if (rawModule === 'songs') {
    // if (/\/isrc(\b|\/|$)/.test(path)) moduleName = 'isrc'
    // agency-pdf 走 songs.export，下面 GET 分支会命中
  }

  // 按 method + 路径特征定 action
  const isExport = search.get('export') === '1' || /\/(export|agency-pdf)(\b|\/|$)/.test(path)
  const isSettle = /\/(pay|settle-status)(\b|\/|$)/.test(path)
  const isOperate = /\/(status|verify|notify|publish|sync|toggle-status|reset-password)(\b|\/|$)/.test(path)

  let action: string
  if (method === 'GET') {
    action = isExport ? 'export' : 'view'
  } else if (method === 'DELETE') {
    action = 'manage'
  } else if (method === 'PUT' || method === 'PATCH') {
    action = isSettle ? 'settle' : 'edit'
  } else {
    // POST
    if (isSettle) action = 'settle'
    else if (isOperate) action = 'operate'
    else action = 'manage'
  }

  return `admin.${moduleName}.${action}`
}

/**
 * 管理端权限粒度鉴权：portal='admin' + role.permissions[key]=true
 * 内置角色（is_builtin=true，即超级管理员）自动放行。
 * 权限 key 格式：{portal}.{menu}.{action}，如 admin.revenue.settle
 * key 省略时按 URL + HTTP method 自动推断。
 */
export async function requirePermission(request: NextRequest, key?: string) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'admin') {
    return { error: NextResponse.json({ code: 403, message: '无权限' }, { status: 403 }) }
  }
  const admin = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: { role: { select: { isBuiltin: true, permissions: true } } },
  })
  if (!admin || !admin.status) {
    return { error: NextResponse.json({ code: 403, message: '账号已禁用' }, { status: 403 }) }
  }
  if (admin.role.isBuiltin) return { userId, portal }
  const resolved = key ?? inferPermissionKey(request)
  const perms = (admin.role.permissions ?? {}) as Record<string, boolean>
  if (perms[resolved] !== true) {
    return { error: NextResponse.json({ code: 403, message: `无权限：${resolved}` }, { status: 403 }) }
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

/** 解析分页参数；NaN/非法值回退到默认 */
export function parsePagination(searchParams: URLSearchParams) {
  const rawPage = parseInt(searchParams.get('page') || '1', 10)
  const rawPageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1
  const pageSize = Number.isFinite(rawPageSize) ? Math.min(100, Math.max(1, rawPageSize)) : 20
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
