import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const imports = await prisma.revenueImport.findMany({
    where: { platform: { not: 'qishui' } },
    orderBy: { importedAt: 'desc' },
  })

  const list = imports.map((r) => ({
    id: r.id,
    platform: r.platform,
    fileName: r.fileName,
    totalRows: r.totalRows,
    matchedRows: r.matchedRows,
    totalRevenue: parseFloat(r.totalRevenue.toString()),
    status: r.status,
  }))

  return ok({ imports: list })
})
