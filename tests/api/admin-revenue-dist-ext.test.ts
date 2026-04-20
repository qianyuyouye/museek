import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/**
 * 发行 / 收益扩展 15 条
 * 覆盖：/api/admin/distributions, /api/admin/distributions/:songId,
 *      /api/admin/publish-confirm/sync,
 *      /api/admin/revenue/other-imports, /api/admin/revenue/platform-settlements,
 *      /api/admin/revenue/imports/:id/detail,
 *      /api/admin/assignments/:id/fields,
 *      /api/admin/songs/:id/agency-pdf
 */

let adminCookie = ''

describe('/api/admin/distributions', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('TC-DIST-001 GET 返回平台矩阵 + songs 列表', async () => {
    const r = await http('/api/admin/distributions', { cookie: adminCookie })
    expectOk(r, 'dist list')
    const d = r.json.data
    expect(Array.isArray(d.songs)).toBe(true)
    expect(Array.isArray(d.platforms)).toBe(true)
    expect(d.platforms).toContain('QQ音乐')
    expect(typeof d.matrix).toBe('object')
  })

  it('TC-DIST-002 每首歌 matrix 行含 5 个平台 key', async () => {
    const r = await http('/api/admin/distributions', { cookie: adminCookie })
    const { songs, platforms, matrix } = r.json.data as {
      songs: { id: number }[]
      platforms: string[]
      matrix: Record<number, Record<string, string>>
    }
    for (const s of songs) {
      for (const p of platforms) {
        expect(matrix[s.id]).toHaveProperty(p)
      }
    }
  })

  it('TC-DIST-003 POST 非法 platform → 400', async () => {
    const r = await http('/api/admin/distributions/1', {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: 'FakePlatform', status: 'submitted' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('平台')
  })

  it('TC-DIST-004 POST 非法 status → 400', async () => {
    const r = await http('/api/admin/distributions/1', {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: 'QQ音乐', status: 'nope' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-DIST-005 POST 歌曲不存在 → 404', async () => {
    const r = await http('/api/admin/distributions/99999999', {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: 'QQ音乐', status: 'submitted' },
    })
    expect(r.status).toBe(404)
  })

  it('TC-DIST-006 GET 单歌 distributions 数组', async () => {
    // 取一首 published 歌
    const list = await http('/api/admin/songs?status=published&pageSize=1', { cookie: adminCookie })
    const song = list.json.data.list[0] as { id: number } | undefined
    if (!song) return
    const r = await http(`/api/admin/distributions/${song.id}`, { cookie: adminCookie })
    expectOk(r, 'single dist')
    expect(Array.isArray(r.json.data)).toBe(true)
  })
})

describe('/api/admin/publish-confirm/sync', () => {
  it('TC-SYNC-001 返回 autoConfirmed / exceptions 计数', async () => {
    const r = await http('/api/admin/publish-confirm/sync', {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    })
    expectOk(r, 'sync')
    expect(typeof r.json.data.autoConfirmed).toBe('number')
    expect(typeof r.json.data.exceptions).toBe('number')
    expect(r.json.data.autoConfirmed).toBeGreaterThanOrEqual(0)
  })
})

describe('/api/admin/revenue/other-imports', () => {
  it('TC-OTHER-001 返回非汽水平台导入列表', async () => {
    const r = await http('/api/admin/revenue/other-imports', { cookie: adminCookie })
    expectOk(r, 'other imports')
    const list = r.json.data.imports as { platform: string }[]
    for (const l of list) expect(l.platform).not.toBe('qishui')
  })
})

describe('/api/admin/revenue/platform-settlements', () => {
  it('TC-PSET-001 返回非汽水结算列表', async () => {
    const r = await http('/api/admin/revenue/platform-settlements', { cookie: adminCookie })
    expectOk(r, 'platform settlements')
    expect(Array.isArray(r.json.data.settlements)).toBe(true)
    // 每项带 status/platform/songTitle 字段
    for (const s of r.json.data.settlements as { status: string; platform: string }[]) {
      expect(typeof s.status).toBe('string')
      expect(s.platform).not.toBe('qishui')
    }
  })
})

describe('/api/admin/revenue/imports/:id/detail', () => {
  it('TC-IMPD-001 不存在 → 404', async () => {
    const r = await http('/api/admin/revenue/imports/99999999/detail', { cookie: adminCookie })
    expect(r.status).toBe(404)
  })

  it('TC-IMPD-002 合法 id 返回三分组（idConfirmed/namePending/unmatched）', async () => {
    const list = await http('/api/admin/revenue/imports?pageSize=1', { cookie: adminCookie })
    const imp = list.json.data.list?.[0] as { id: number } | undefined
    if (!imp) return
    const r = await http(`/api/admin/revenue/imports/${imp.id}/detail`, { cookie: adminCookie })
    expectOk(r, 'detail')
    expect(Array.isArray(r.json.data.idConfirmed)).toBe(true)
    expect(Array.isArray(r.json.data.namePending)).toBe(true)
    expect(Array.isArray(r.json.data.unmatched)).toBe(true)
  })
})

describe('/api/admin/assignments/:id/fields', () => {
  it('TC-FLD-001 不存在作业 GET → 404', async () => {
    const r = await http('/api/admin/assignments/99999999/fields', { cookie: adminCookie })
    expect(r.status).toBe(404)
  })

  it('TC-FLD-002 PUT fields 非数组 → 400', async () => {
    const list = await http('/api/admin/assignments?pageSize=1', { cookie: adminCookie })
    const asn = list.json.data.list?.[0] as { id: number } | undefined
    if (!asn) return
    const r = await http(`/api/admin/assignments/${asn.id}/fields`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { fields: 'invalid' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-FLD-003 GET 合法作业 → 200 + 数组', async () => {
    const list = await http('/api/admin/assignments?pageSize=1', { cookie: adminCookie })
    const asn = list.json.data.list?.[0] as { id: number } | undefined
    if (!asn) return
    const r = await http(`/api/admin/assignments/${asn.id}/fields`, { cookie: adminCookie })
    expectOk(r, 'fields get')
    expect(Array.isArray(r.json.data)).toBe(true)
  })
})

describe('/api/admin/songs/:id/agency-pdf', () => {
  it('TC-PDF-001 未签代理歌曲 → 400', async () => {
    // 找一个未签代理的创作者
    const list = await http('/api/admin/songs?pageSize=50', { cookie: adminCookie })
    const songs = list.json.data.list as { id: number; agencyContract: boolean }[]
    const candidate = songs.find((s) => !s.agencyContract)
    if (!candidate) return
    const res = await fetch(`http://localhost:3000/api/admin/songs/${candidate.id}/agency-pdf`, {
      headers: { Cookie: adminCookie, Origin: 'http://localhost:3000' },
    })
    expect(res.status).toBe(400)
  })

  it('TC-PDF-002 不存在歌曲 → 404', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/songs/99999999/agency-pdf`, {
      headers: { Cookie: adminCookie, Origin: 'http://localhost:3000' },
    })
    expect(res.status).toBe(404)
  })
})
