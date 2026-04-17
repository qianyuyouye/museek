import type { NextRequest } from 'next/server'
import { prisma } from './prisma'

export async function logAction(opts: {
  operatorId?: number | null
  operatorName?: string
  action: string
  targetType?: string
  targetId?: string
  detail?: object
  ip?: string
}) {
  await prisma.operationLog.create({
    data: {
      operatorId: opts.operatorId,
      operatorName: opts.operatorName || '',
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      detail: opts.detail || undefined,
      ip: opts.ip || '',
    },
  })
}

/** 管理端写操作日志便捷包装：从 request header 解析操作者 + IP，查 admin 名称 */
export async function logAdminAction(
  request: NextRequest,
  opts: {
    action: string
    targetType?: string
    targetId?: string | number | null
    detail?: object
  },
) {
  try {
    const userId = request.headers.get('x-user-id')
    const operatorId = userId ? parseInt(userId, 10) : null
    if (!operatorId || isNaN(operatorId)) return

    const admin = await prisma.adminUser.findUnique({
      where: { id: operatorId },
      select: { account: true, name: true },
    })
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''

    await prisma.operationLog.create({
      data: {
        operatorId,
        operatorName: admin?.name || admin?.account || '',
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId == null ? undefined : String(opts.targetId),
        detail: opts.detail || undefined,
        ip,
      },
    })
  } catch (e) {
    // 日志失败不影响主业务
    console.error('[logAdminAction]', e)
  }
}
