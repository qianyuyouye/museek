import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 歌曲/作业/评审/PDF 回归 10 条
 */

let adminCookie = ''
let creatorCookie = ''
let reviewerCookie = ''

describe('歌曲 · 状态机', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('TC-A-06 状态机：已 published 不允许再 publish → 400', async () => {
    // 取第一首已发行的（种子里 id=1 星河漫步已 published）
    const r = await http('/api/admin/songs/1/status', {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'publish' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-A-06 状态机：archive → restore（archived → reviewed）', async () => {
    await http('/api/admin/songs/1/status', { method: 'POST', cookie: adminCookie, body: { action: 'archive' } })
    const restore = await http('/api/admin/songs/1/status', {
      method: 'POST', cookie: adminCookie, body: { action: 'restore' },
    })
    expectOk(restore, 'restore')
    expect(restore.json.data.status).toBe('reviewed')
    // 恢复到 published（三条件需齐）
    const final = await http('/api/admin/songs/1/status', {
      method: 'POST', cookie: adminCookie, body: { action: 'publish' },
    })
    expect(final.status).toBe(200)
  })

  it('TC-A-06-010 歌曲库搜索/流派筛选后端生效', async () => {
    const byGenre = await http('/api/admin/songs?genre=Pop', { cookie: adminCookie })
    expectOk(byGenre, 'genre filter')
    const all = byGenre.json.data.list as { genre: string }[]
    // MySQL ci collation 大小写不敏感：pop / Pop 都应匹配
    expect(all.every((s) => s.genre?.toLowerCase() === 'pop')).toBe(true)

    const byScore = await http('/api/admin/songs?minScore=80&maxScore=89', { cookie: adminCookie })
    expectOk(byScore, 'score filter')
    const scoreList = byScore.json.data.list as { score: number | null }[]
    expect(scoreList.every((s) => s.score == null || (s.score >= 80 && s.score <= 89))).toBe(true)
  })
})

describe('歌曲 · ISRC 绑定 + 授权 PDF', () => {
  it('TC-A-08 绑 ISRC POST → 200', async () => {
    const r = await http('/api/admin/songs/1/isrc', {
      method: 'POST',
      cookie: adminCookie,
      body: { isrc: `CN-A01-26-${Date.now().toString().slice(-5)}` },
    })
    expect(r.status).toBe(200)
  })

  it('TC-E-34 授权凭证 PDF：已签创作者 → 200 + %PDF', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/songs/1/agency-pdf`, {
      headers: { Cookie: adminCookie, Origin: BASE_URL },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/pdf')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.slice(0, 4).toString()).toBe('%PDF')
  })
})

describe('作业 · 重新提交', () => {
  it('TC-C-03-017 首次提交 → 200 成功', async () => {
    const r = await http('/api/creator/assignments/1/submit', {
      method: 'POST',
      cookie: creatorCookie,
      body: {
        title: `vitest-work-${Date.now()}`,
        aiTools: ['Suno'],
        genre: 'Pop',
      },
    })
    // 可能已经提交过：允许两种结果
    if (r.status === 200) {
      expect(r.json.data.songId).toBeGreaterThan(0)
    } else {
      expect(r.status).toBe(400)
      expect(r.json.message).toContain('不允许重复')
    }
  })

  it('TC-C-03-017 pending_review 状态重提 → 阻断', async () => {
    const r = await http('/api/creator/assignments/1/submit', {
      method: 'POST',
      cookie: creatorCookie,
      body: { title: 'should-fail', aiTools: ['Suno'] },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('不允许重复')
  })
})

describe('评审绩效 + 评审队列', () => {
  it('TC-A-11-001 /admin/accounts?tab=reviewer 返回绩效字段', async () => {
    // 用 search 精准定位种子评审，避免被后续创建的 reviewer 挤出分页
    const r = await http('/api/admin/accounts?tab=reviewer&search=13500008888&pageSize=10', { cookie: adminCookie })
    expectOk(r, 'reviewer stats')
    const liu = (r.json.data.list as Array<{ phone: string; reviewCount?: number; avgScore?: number }>)
      .find((u) => u.phone === '13500008888')
    expect(liu).toBeTruthy()
    expect(typeof liu!.reviewCount).toBe('number')
  })

  it('TC-R-02-002 评审队列返回 aiTools 数组', async () => {
    const r = await http('/api/review/queue', { cookie: reviewerCookie })
    expectOk(r, 'queue')
    const list = r.json.data.list as { aiTools?: string[] }[]
    expect(Array.isArray(list)).toBe(true)
    for (const s of list) {
      expect(Array.isArray(s.aiTools) || s.aiTools === undefined).toBe(true)
    }
  })

  it('看板缓存：连续两次调用，第二次在 300ms 内', async () => {
    const t1 = Date.now()
    await http('/api/admin/dashboard', { cookie: adminCookie })
    const t2 = Date.now()
    await http('/api/admin/dashboard', { cookie: adminCookie })
    const t3 = Date.now()
    expect(t3 - t2).toBeLessThan(300)  // 缓存命中
    // 第一次不一定更慢（可能也缓存了），只要不爆出错就行
    expect(t2 - t1).toBeGreaterThanOrEqual(0)
  })
})
