import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, parsePagination, safeHandler} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const actionType = searchParams.get('actionType')
  const search = searchParams.get('search')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const where: Prisma.OperationLogWhereInput = {}
  const conditions: Prisma.OperationLogWhereInput[] = []

  if (actionType) {
    conditions.push({ action: actionType })
  }

  if (search) {
    conditions.push({
      OR: [
        { operatorName: { contains: search } },
        { action: { contains: search } },
      ],
    })
  }

  if (startDate) {
    conditions.push({ createdAt: { gte: new Date(`${startDate}T00:00:00`) } })
  }

  if (endDate) {
    conditions.push({ createdAt: { lte: new Date(`${endDate}T23:59:59`) } })
  }

  if (conditions.length > 0) {
    where.AND = conditions
  }

  const [list, total] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.operationLog.count({ where }),
  ])

  return ok({ list, total, page, pageSize })
})
