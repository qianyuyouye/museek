import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const [imports, total] = await Promise.all([
    prisma.revenueImport.findMany({
      orderBy: { importedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.revenueImport.count(),
  ])

  const list = imports.map((r) => ({
    ...r,
    totalRevenue: parseFloat(r.totalRevenue.toString()),
  }))

  return ok({ list, total, page, pageSize })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { fileName, period, platform } = body

  if (!fileName || !period || !platform) {
    return err('fileName, period, platform 必填')
  }

  const record = await prisma.revenueImport.create({
    data: {
      fileName,
      period,
      platform,
      status: 'completed',
      importedBy: auth.userId,
    },
  })

  return ok({
    ...record,
    totalRevenue: parseFloat(record.totalRevenue.toString()),
  })
})
