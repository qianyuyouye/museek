import { NextRequest } from 'next/server'
import iconv from 'iconv-lite'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { parseCSV } from '@/lib/csv'
import { isPlatformEnabled } from '@/lib/platforms'
import { loadRevenueRules, resolveCommissionRatio } from '@/lib/commission'

/**
 * 探测字节流编码并解码为 UTF-8 字符串。
 * - UTF-8 BOM (EF BB BF) → utf8 去 BOM
 * - UTF-16LE BOM (FF FE) / UTF-16BE BOM (FE FF) → utf16
 * - 否则：尝试 utf-8 严格解码，失败则回退 GBK（国内 Excel 导出常见）
 */
function decodeCsvBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8')
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return iconv.decode(buf.slice(2), 'utf-16le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return iconv.decode(buf.slice(2), 'utf-16be')
  }
  // 尝试 UTF-8：若遇到替换字符密度过高则视为非 UTF-8
  const utf8Text = buf.toString('utf8')
  const replacementRate =
    (utf8Text.match(/\uFFFD/g)?.length ?? 0) / Math.max(1, utf8Text.length)
  if (replacementRate < 0.002) return utf8Text
  return iconv.decode(buf, 'gbk')
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.revenue.view')
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

  // 前端 UI 习惯名 → schema 字段的 alias（保留原字段避免破坏其他调用方）
  const list = imports.map((r) => ({
    ...r,
    totalRevenue: parseFloat(r.totalRevenue.toString()),
    idHit: r.matchedRows,
    nameMatch: r.suspectRows,
    unmatched: r.unmatchedRows,
    duplicates: r.duplicateRows,
  }))

  return ok({ list, total, page, pageSize })
})

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

    if (!dateRange || !/\d{4}[\/-]\d{1,2}/.test(dateRange)) {
      errors.push(`第 ${i + 1} 行: 日期格式无法识别 "${dateRange}"`)
      continue
    }
    const period = dateRange

    const toNum = (s: string) => parseFloat(s.replace(/[,"']/g, '')) || 0
    const d = toNum(douyin)
    const q = toNum(qishui)
    const tRaw = toNum(total)
    const t = tRaw || d + q

    // col7 = col5 + col6 校验（允许 ¥0.01 四舍五入偏差）
    if (tRaw > 0 && Math.abs(tRaw - (d + q)) > 0.02) {
      errors.push(
        `第 ${i + 1} 行: 总收入与抖音+汽水对不上（${tRaw.toFixed(2)} vs ${(d + q).toFixed(2)}），已按子项求和修正`,
      )
    }

    rows.push({ qishuiSongId, songName, period, douyinRevenue: d, qishuiRevenue: q, totalRevenue: t })
  }
  return { rows, errors }
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.revenue.operate')
  if ('error' in auth) return auth.error

  const contentType = request.headers.get('content-type') ?? ''

  // 兼容旧 JSON 调用：仅手动创建批次记录（主要给测试/迁移用）
  if (contentType.includes('application/json')) {
    const body = await request.json()
    const { fileName, period, platform } = body
    if (!fileName || !platform) return err('fileName, platform 必填')
    if (typeof platform !== 'string' || !(await isPlatformEnabled(platform, { allowLegacyKeys: true }))) {
      return err('无效的平台')
    }
    const record = await prisma.revenueImport.create({
      data: {
        fileName,
        period: period ?? null,
        platform,
        status: 'completed',
        importedBy: auth.userId,
      },
    })
    await logAdminAction(request, {
      action: 'create_revenue_import',
      targetType: 'revenue_import',
      targetId: record.id,
      detail: { fileName, platform, period: period ?? null, mode: 'json' },
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
  if (!(await isPlatformEnabled(platformStr, { allowLegacyKeys: true }))) return err('无效的平台')
  if (platformStr !== 'qishui') return err('其他平台收益导入暂未开放，请先使用汽水音乐 CSV 模板导入')

  const ab = await file.arrayBuffer()
  const text = decodeCsvBuffer(Buffer.from(ab))
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

  // 对无映射的 songId 按歌名在 platform_songs 做模糊匹配（PRD §6.1 Step 3）
  const songNameByQishuiId = new Map<string, string>()
  for (const p of parsed) {
    if (p.songName && !songNameByQishuiId.has(p.qishuiSongId)) {
      songNameByQishuiId.set(p.qishuiSongId, p.songName)
    }
  }

  const newMappingsData: Prisma.SongMappingCreateManyInput[] = []
  const now = new Date()
  for (const qishuiSongId of songIds) {
    if (mappingMap.has(qishuiSongId)) continue
    const songName = songNameByQishuiId.get(qishuiSongId)
    if (!songName) {
      newMappingsData.push({
        qishuiSongId,
        qishuiSongName: null,
        matchType: 'none',
        status: 'pending',
      })
      continue
    }
    // take: 2 只需判断是否唯一命中，避免歌名过宽时加载大量记录
    const hits = await prisma.platformSong.findMany({
      where: { title: { contains: songName } },
      select: { id: true, userId: true },
      take: 2,
    })
    if (hits.length === 1) {
      newMappingsData.push({
        qishuiSongId,
        qishuiSongName: songName,
        platformSongId: hits[0].id,
        creatorId: hits[0].userId,
        matchType: 'auto_exact',
        status: 'confirmed',
        confirmedAt: now,
        // confirmedBy 外键指向 users 表；admin 操作时留 null 避免 FK 约束失败
      })
    } else if (hits.length > 1) {
      newMappingsData.push({
        qishuiSongId,
        qishuiSongName: songName,
        matchType: 'auto_fuzzy',
        status: 'suspect',
      })
    } else {
      newMappingsData.push({
        qishuiSongId,
        qishuiSongName: songName,
        matchType: 'none',
        status: 'pending',
      })
    }
  }

  if (newMappingsData.length > 0) {
    await prisma.songMapping.createMany({ data: newMappingsData, skipDuplicates: true })
    const created = await prisma.songMapping.findMany({
      where: { qishuiSongId: { in: newMappingsData.map((m) => m.qishuiSongId) } },
      select: { id: true, qishuiSongId: true, status: true },
    })
    for (const m of created) {
      if (!mappingMap.has(m.qishuiSongId)) mappingMap.set(m.qishuiSongId, m)
    }
  }

  // 建 import + rows
  const imp = await prisma.revenueImport.create({
    data: {
      platform: platformStr,
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
  let irrelevant = 0

  const rowsToCreate = parsed.map((p) => {
    const mapping = mappingMap.get(p.qishuiSongId)
    let matchStatus: 'matched' | 'suspect' | 'unmatched' | 'irrelevant'
    if (mapping && mapping.status === 'confirmed') {
      matchStatus = 'matched'
      matched++
    } else if (mapping && mapping.status === 'suspect') {
      matchStatus = 'suspect'
      suspect++
    } else if (mapping && mapping.status === 'irrelevant') {
      // 已标记无关：自动跳过，不算入未匹配队列（PRD §6.4）
      matchStatus = 'irrelevant'
      irrelevant++
    } else {
      // 无映射 或 pending 映射 → 未匹配
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

  // 补零：不同汽水后台上传的歌曲分散在多个 CSV 中，
  // 需要确保当月所有已映射歌曲都有收益记录（缺失的补 0）
  const csvSongIds = new Set(parsed.map((p) => p.qishuiSongId))
  const allConfirmedMappings = await prisma.songMapping.findMany({
    where: { status: 'confirmed' },
    select: { id: true, qishuiSongId: true, qishuiSongName: true, creatorId: true, platformSongId: true },
  })
  const missingConfirmedSongIds = allConfirmedMappings
    .filter((m) => !csvSongIds.has(m.qishuiSongId))
    .map((m) => m.qishuiSongId)

  // 查这些 songId 在本周期是否已有 RevenueRow（可能来自之前的其他批次导入）
  const existingRowsForPeriod = await prisma.revenueRow.findMany({
    where: {
      qishuiSongId: { in: missingConfirmedSongIds },
      period: firstPeriod,
    },
    select: { qishuiSongId: true },
  })
  const alreadyHasRow = new Set(existingRowsForPeriod.map((r) => r.qishuiSongId))

  const zeroRows: Prisma.RevenueRowCreateManyInput[] = []
  for (const m of allConfirmedMappings) {
    if (csvSongIds.has(m.qishuiSongId)) continue
    if (alreadyHasRow.has(m.qishuiSongId)) continue
    zeroRows.push({
      importId: imp.id,
      qishuiSongId: m.qishuiSongId,
      songName: m.qishuiSongName,
      period: firstPeriod,
      douyinRevenue: 0,
      qishuiRevenue: 0,
      totalRevenue: 0,
      mappingId: m.id,
      matchStatus: 'matched',
    })
    matched++
  }

  if (zeroRows.length > 0) {
    await prisma.revenueRow.createMany({ data: zeroRows, skipDuplicates: true })
  }

  const final = await prisma.revenueImport.update({
    where: { id: imp.id },
    data: {
      totalRows: rowsToCreate.length + zeroRows.length,
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

  await logAdminAction(request, {
    action: 'import_revenue_csv',
    targetType: 'revenue_import',
    targetId: final.id,
    detail: {
      fileName: final.fileName,
      platform: final.platform,
      period: final.period,
      totalRows: final.totalRows,
      matchedRows: final.matchedRows,
      suspectRows: final.suspectRows,
      unmatchedRows: final.unmatchedRows,
      duplicateRows: final.duplicateRows,
      totalRevenue: parseFloat(final.totalRevenue.toString()),
    },
  })
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
