import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.revenue.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const importId = parseInt(id, 10)
  if (isNaN(importId)) return err('无效的 ID')

  const record = await prisma.revenueImport.findUnique({
    where: { id: importId },
    include: {
      rows: {
        include: { mapping: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!record) return err('导入记录不存在', 404)

  const data = {
    ...record,
    totalRevenue: parseFloat(record.totalRevenue.toString()),
    rows: record.rows.map((row) => ({
      ...row,
      douyinRevenue: parseFloat(row.douyinRevenue.toString()),
      qishuiRevenue: parseFloat(row.qishuiRevenue.toString()),
      totalRevenue: parseFloat(row.totalRevenue.toString()),
    })),
  }

  return ok(data)
})
