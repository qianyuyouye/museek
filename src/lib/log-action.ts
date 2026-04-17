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
