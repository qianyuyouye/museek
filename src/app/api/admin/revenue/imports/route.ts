import { NextRequest } from 'next/server'
import { Prisma, RevenuePlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, parsePagination, safeHandler } from '@/lib/api-utils'
import { parseCSV } from '@/lib/csv'
import { loadRevenueRules, resolveCommissionRatio } from '@/lib/commission'

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

const VALID_PLATFORMS = new Set<string>([
  'qishui', 'qq_music', 'netease', 'spotify', 'apple_music', 'kugou',
])

interface ParsedRow {
  qishuiSongId: string
  songName: string
  period: string
  douyinRevenue: number
  qishuiRevenue: number
  totalRevenue: number
}

/**
 * 解析汽水导出的 CSV。列顺序：
 *   类型 | 起止日期 | 歌曲名称 | 歌曲ID | 抖音收入 | 汽水收入 | 总收入
 * 歌曲ID 可能被 Excel 公式包裹：="7604694471591200818"
 * 起止日期示例：2026/02/01 - 2026/02/28
 */
function parseQishuiCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const table = parseCSV(text)
  const rows: ParsedRow[] = []
  const errors: string[] = []
  // 首行是表头，从第 2 行起
  for (let i = 1; i < table.length; i++) {
    const r = table[i]
    if (!r || r.every((c) => !c || !c.trim())) continue
    if (r.length < 7) {
      errors.push(`第 ${i + 1} 行: 列数不足（${r.length}/7）`)
      continue
    }

    const dateRange = r[1]?.trim() ?? ''
    const songName = r[2]?.trim() ?? ''
    const rawId = r[3]?.trim() ?? ''
    const douyin = r[4]?.trim() ?? '0'
    const qishui = r[5]?.trim() ?? '0'
    const total = r[6]?.trim() ?? '0'

    const idMatch = rawId.match(/(\d{6,})/)
    if (!idMatch) {
      errors.push(`第 ${i + 1} 行: 歌曲ID 无法识别 "${rawId}"`)
      continue
    }
    const qishuiSongId = idMatch[1]

    const dateMatch = dateRange.match(/(\d{4})[\/-](\d{1,2})/)
    if (!dateMatch) {
      errors.push(`第 ${i + 1} 行: 日期格式无法识别 "${dateRange}"`)
      continue
    }
    const period = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}`

    const d = parseFloat(douyin) || 0
    const q = parseFloat(qishui) || 0
    const t = parseFloat(total) || d + q

    rows.push({ qishuiSongId, songName, period, douyinRevenue: d, qishuiRevenue: q, totalRevenue: t })
  }
  return { rows, errors }
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const contentType = request.headers.get('content-type') ?? ''

  // 兼容旧 JSON 调用：仅手动创建批次记录（主要给测试/迁移用）
  if (contentType.includes('application/json')) {
    const body = await request.json()
    const { fileName, period, platform } = body
    if (!fileName || !platform) return err('fileName, platform 必填')
    const record = await prisma.revenueImport.create({
      data: {
        fileName,
        period: period ?? null,
        platform,
        status: 'completed',
        importedBy: auth.userId,
      },
    })
    return ok({ ...record, totalRevenue: parseFloat(record.totalRevenue.toString()) })
  }

  if (!contentType.includes('multipart/form-data')) {
    return err('请使用 multipart/form-data 上传 CSV 文件')
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const platformStr = (formData.get('platform') as string | null) ?? 'qishui'

  if (!file) return err('请选择 CSV 文件')
  if (!VALID_PLATFORMS.has(platformStr)) return err('无效的平台')

  const text = await file.text()
  const { rows: parsed, errors: parseErrors } = parseQishuiCsv(text)

  if (parsed.length === 0) {
    return err(parseErrors[0] ?? 'CSV 无有效数据行', 400)
  }

  const firstPeriod = parsed[0].period
  let totalRevenue = 0
  for (const p of parsed) totalRevenue += p.totalRevenue

  // 查映射
  const songIds = Array.from(new Set(parsed.map((p) => p.qishuiSongId)))
  const existingMappings = await prisma.songMapping.findMany({
    where: { qishuiSongId: { in: songIds } },
    select: { id: true, qishuiSongId: true, status: true },
  })
  const mappingMap = new Map(existingMappings.map((m) => [m.qishuiSongId, m]))

  // 建 import + rows
  const imp = await prisma.revenueImport.create({
    data: {
      platform: platformStr as RevenuePlatform,
      fileName: file.name,
      period: firstPeriod,
      totalRows: parsed.length,
      totalRevenue: new Prisma.Decimal(totalRevenue.toFixed(2)),
      status: 'processing',
      importedBy: auth.userId,
    },
  })

  let matched = 0
  let suspect = 0
  let unmatched = 0

  const rowsToCreate = parsed.map((p) => {
    const mapping = mappingMap.get(p.qishuiSongId)
    let matchStatus: 'matched' | 'suspect' | 'unmatched'
    if (mapping && mapping.status === 'confirmed') {
      matchStatus = 'matched'
      matched++
    } else if (mapping) {
      matchStatus = 'suspect'
      suspect++
    } else {
      matchStatus = 'unmatched'
      unmatched++
    }
    return {
      importId: imp.id,
      qishuiSongId: p.qishuiSongId,
      songName: p.songName,
      period: p.period,
      douyinRevenue: new Prisma.Decimal(p.douyinRevenue.toFixed(2)),
      qishuiRevenue: new Prisma.Decimal(p.qishuiRevenue.toFixed(2)),
      totalRevenue: new Prisma.Decimal(p.totalRevenue.toFixed(2)),
      mappingId: mapping?.id ?? null,
      matchStatus,
    }
  })

  // @@unique([qishuiSongId, period]) — 二次导入同周期会被跳过
  const created = await prisma.revenueRow.createMany({
    data: rowsToCreate,
    skipDuplicates: true,
  })
  const duplicateRows = rowsToCreate.length - created.count

  const final = await prisma.revenueImport.update({
    where: { id: imp.id },
    data: {
      totalRows: rowsToCreate.length,
      matchedRows: matched,
      suspectRows: suspect,
      unmatchedRows: unmatched,
      duplicateRows,
      status: 'completed',
    },
  })

  // 对匹配成功（confirmed）的行自动生成 Settlement，按 PRD §6.2 规则表选比例
  if (matched > 0) {
    const matchedRows = await prisma.revenueRow.findMany({
      where: { importId: imp.id, matchStatus: 'matched' },
      include: { mapping: { select: { creatorId: true, platformSongId: true } } },
    })
    const rules = await loadRevenueRules(prisma)
    const settlementsData = [] as Prisma.SettlementCreateManyInput[]
    for (const r of matchedRows) {
      const creatorId = r.mapping?.creatorId
      if (!creatorId) continue
      const ratio = await resolveCommissionRatio(
        prisma,
        { creatorId, songId: r.mapping?.platformSongId ?? null },
        rules,
      )
      settlementsData.push({
        revenueRowId: r.id,
        qishuiSongId: r.qishuiSongId,
        songName: r.songName,
        period: r.period,
        douyinRevenue: r.douyinRevenue,
        qishuiRevenue: r.qishuiRevenue,
        totalRevenue: r.totalRevenue,
        creatorId,
        platformRatio: ratio.platformRatio,
        creatorRatio: ratio.creatorRatio,
        creatorAmount: r.totalRevenue.mul(ratio.creatorRatio),
        settleStatus: 'pending',
      })
    }
    if (settlementsData.length > 0) {
      await prisma.settlement.createMany({ data: settlementsData, skipDuplicates: true })
    }
  }

  return ok({
    id: final.id,
    fileName: final.fileName,
    period: final.period,
    platform: final.platform,
    totalRows: final.totalRows,
    matchedRows: final.matchedRows,
    suspectRows: final.suspectRows,
    unmatchedRows: final.unmatchedRows,
    duplicateRows: final.duplicateRows,
    totalRevenue: parseFloat(final.totalRevenue.toString()),
    parseErrors,
  })
})
