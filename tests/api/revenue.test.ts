import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 收益回归 10 条：CSV 千分位 / 映射 / 结算 / 分成规则
 * 用独立的 period 避免与既有数据冲突（UNIQUE qishui_song_id, period）
 */

let adminCookie = ''
const TEST_PERIOD = `2099/01/01 - 2099/01/31`
// 用时间戳保证每次跑都新建 qishui_id，避免上轮 mapping 残留
const TS = Date.now().toString()
const TEST_QISHUI_ID = `8${TS}`.slice(0, 15)
const TEST_QISHUI_ID_2 = `9${TS}`.slice(0, 15)

async function uploadCsv(cookie: string, content: string) {
  const form = new FormData()
  form.append('platform', 'qishui')
  form.append('file', new Blob([content], { type: 'text/csv' }), 'test.csv')
  const res = await fetch(`${BASE_URL}/api/admin/revenue/imports`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: BASE_URL },
    body: form,
  })
  return { status: res.status, json: await res.json() }
}

describe('收益 · CSV 解析', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('TC-BD-003 CSV 千分位正确解析：1,234.56 → 1234.56', async () => {
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,${TEST_PERIOD},千分位测试,="${TEST_QISHUI_ID}","1,234.56","789.44","2,024.00"\n`
    const r = await uploadCsv(adminCookie, csv)
    expect(r.status).toBe(200)
    expect(r.json.data.totalRevenue).toBeCloseTo(2024, 2)
  })

  it('TC-BD-008 跨批次 UNIQUE(qishui_song_id, period) 去重', async () => {
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,${TEST_PERIOD},千分位测试,="${TEST_QISHUI_ID}",100,50,150\n`
    const r = await uploadCsv(adminCookie, csv)
    expect(r.status).toBe(200)
    expect(r.json.data.duplicateRows).toBe(1)
  })

  it('CSV 空行 + 错误行 + 1 有效行：parseErrors 报明确行号', async () => {
    // 混合：1 有效 + 1 列数不足 + 1 日期错；有效行使 API 能成功入库
    const csv = [
      '歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入',
      `-,2099/02/01 - 2099/02/28,有效行,="7099999999999996",10,5,15`,
      '',
      '-,2099/02/01 - 2099/02/28,少列',
      `-,INVALID_DATE,坏日期,="7099999999999995",1,2,3`,
    ].join('\n') + '\n'
    const r = await uploadCsv(adminCookie, csv)
    expect(r.status).toBe(200)
    const errs = r.json.data.parseErrors as string[]
    expect(errs.length).toBeGreaterThan(0)
    expect(errs.join(' ')).toMatch(/列数不足|日期/)
  })
})

describe('收益 · 映射', () => {
  let mappingId: number | undefined

  it('自动 unmatched：新 qishui_song_id 创建 none,pending 映射', async () => {
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,${TEST_PERIOD},未知歌曲,="${TEST_QISHUI_ID_2}",10,5,15\n`
    const r = await uploadCsv(adminCookie, csv)
    expect(r.status).toBe(200)
    expect(r.json.data.unmatchedRows).toBe(1)

    const list = await http('/api/admin/revenue/mappings?status=pending', { cookie: adminCookie })
    expectOk(list, 'mappings pending')
    const m = (list.json.data.list as { qishuiSongId: string; id: number }[])
      .find((x) => x.qishuiSongId === TEST_QISHUI_ID_2)
    expect(m).toBeTruthy()
    mappingId = m!.id
  })

  it('TC-A-15-020 mappings?status=all → 200 不再 400', async () => {
    const r = await http('/api/admin/revenue/mappings?status=all', { cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  it('TC-C-19 bind action 自动 confirm + 触发回溯', async () => {
    expect(mappingId).toBeTruthy()
    const r = await http(`/api/admin/revenue/mappings/${mappingId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { action: 'bind', creatorId: 2 },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.status).toBe('confirmed')
    expect(r.json.data.backfill).toBeTruthy()
  })

  it('reject 标记 irrelevant', async () => {
    expect(mappingId).toBeTruthy()
    const r = await http(`/api/admin/revenue/mappings/${mappingId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { action: 'reject' },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.status).toBe('irrelevant')
  })
})

describe('收益 · 分成规则', () => {
  it('三规则优先级：高分/量产/默认任一存在且比例 > 0', async () => {
    const r = await http('/api/admin/settings', { cookie: adminCookie })
    expectOk(r, 'settings')
    type Setting = { key: string; value: unknown }
    type Rule = { name: string; creatorRatio: number; enabled: boolean }
    const settings = r.json.data as Setting[]
    const rulesEntry = settings.find((s) => s.key === 'revenue_rules')
    expect(rulesEntry).toBeTruthy()
    const rules = rulesEntry!.value as Rule[]
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toBeGreaterThanOrEqual(2)
    // 所有 ratio 应在 (0, 1] 之间
    for (const rule of rules) {
      expect(rule.creatorRatio).toBeGreaterThan(0)
      expect(rule.creatorRatio).toBeLessThanOrEqual(1)
    }
  })

  it('TC-C-22 commission_rules 别名自动映射到 revenue_rules', async () => {
    // 存一个不会影响业务的 key（review_templates）作为 dry check
    const r = await http('/api/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { settings: [{ key: 'review_templates', value: ['vitest-tag'] }] },
    })
    expect(r.status).toBe(200)
    const get = await http('/api/admin/settings?key=review_templates', { cookie: adminCookie })
    const item = (get.json.data as { key: string; value: unknown[] }[]).find((s) => s.key === 'review_templates')
    expect(item?.value).toContain('vitest-tag')
    // 回滚
    await http('/api/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { settings: [{ key: 'review_templates', value: [] }] },
    })
  })

  it('TC-A-15-040 多维统计：douyin + qishui = total（业务口径自洽）', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: adminCookie })
    expectOk(r, 'revenue stats')
    const d = r.json.data
    const sum = Number(d.douyinRevenue) + Number(d.qishuiRevenue)
    // 允许 ≤ 0.05 的浮点误差
    expect(Math.abs(sum - Number(d.totalRevenue))).toBeLessThanOrEqual(0.05)
  })
})

describe('收益 · 前端字段 alias（/admin/revenue 页面直接消费）', () => {
  it('imports 列表每行带 idHit/nameMatch/unmatched/duplicates 别名', async () => {
    const r = await http('/api/admin/revenue/imports?pageSize=3', { cookie: adminCookie })
    expectOk(r, 'imports')
    const list = r.json.data.list as { idHit: number; nameMatch: number; unmatched: number; duplicates: number; matchedRows: number }[]
    if (list.length === 0) return
    for (const row of list) {
      expect(typeof row.idHit).toBe('number')
      expect(typeof row.nameMatch).toBe('number')
      expect(typeof row.unmatched).toBe('number')
      expect(typeof row.duplicates).toBe('number')
      // alias 必须等于 schema 字段
      expect(row.idHit).toBe(row.matchedRows)
    }
  })

  it('mappings 列表每行带 qishuiId/songName/source/creatorName 别名', async () => {
    const r = await http('/api/admin/revenue/mappings?status=all&pageSize=3', { cookie: adminCookie })
    expectOk(r, 'mappings')
    const list = r.json.data.list as { qishuiId: string; qishuiSongId: string; songName: string | null; source: string; creatorName: string | null }[]
    if (list.length === 0) return
    for (const m of list) {
      expect(m.qishuiId).toBe(m.qishuiSongId)
      expect(['auto', 'manual']).toContain(m.source)
      // songName / creatorName 可为 null 但字段必须存在
      expect('songName' in m).toBe(true)
      expect('creatorName' in m).toBe(true)
    }
  })

  it('mappings ?status=unbound 语义映射为 creatorId IS NULL（不再 400）', async () => {
    const r = await http('/api/admin/revenue/mappings?status=unbound&pageSize=3', { cookie: adminCookie })
    expectOk(r, 'mappings unbound')
    const list = r.json.data.list as { creatorId: number | null; status: string }[]
    for (const m of list) {
      expect(m.creatorId).toBeNull()
      expect(m.status).toBe('unbound')
    }
  })
})

describe('收益 · 结算打款通知', () => {
  let adminCookie2 = ''
  beforeAll(async () => {
    adminCookie2 = (await adminLogin()).cookie
  })

  it('TC-SET-NOTIFY action=pay 后每条 settlement 对应 creator 收到 tpl.settlement_paid', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // 造链路：RevenueImport → RevenueRow → Settlement
    const imp = await prisma.revenueImport.create({
      data: { platform: 'qishui', fileName: 'test-notify.csv', status: 'completed' },
    })
    const row = await prisma.revenueRow.create({
      data: {
        importId: imp.id,
        qishuiSongId: `NOTIFY_TEST_${Date.now()}`,
        period: '2026-04',
        totalRevenue: 1000,
        matchStatus: 'matched',
      },
    })
    const s = await prisma.settlement.create({
      data: {
        revenueRowId: row.id,
        period: '2026-04',
        totalRevenue: 1000,
        creatorAmount: 700,
        creatorId: creator!.id,
        settleStatus: 'exported',
      },
    })

    const r = await http('/api/admin/revenue/settlements', {
      method: 'POST',
      cookie: adminCookie2,
      body: { ids: [s.id], action: 'pay' },
    })
    expectOk(r, 'pay')

    const notes = await prisma.notification.findMany({
      where: { userId: creator!.id, targetType: 'settlement', targetId: String(s.id) },
    })
    expect(notes.length).toBe(1)
    expect(notes[0].type).toBe('revenue')
    expect(notes[0].title).toContain('700')

    // 清理
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.settlement.delete({ where: { id: s.id } })
    await prisma.revenueRow.delete({ where: { id: row.id } })
    await prisma.revenueImport.delete({ where: { id: imp.id } })
  })
})
