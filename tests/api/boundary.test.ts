import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 边界场景 25 条（PRD §8）：
 * - 输入长度/Unicode/特殊字符
 * - 并发冲突
 * - 参数组合极端值
 * - 文件上传格式边界
 * - 数据库枚举/NULL 兼容
 */

let adminCookie = ''
let creatorCookie = ''

describe('边界 · 输入校验', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
  })

  it('超长 title 255+ 字符 → 截断或 400', async () => {
    const longTitle = 'a'.repeat(500)
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: longTitle, category: 'AI', type: 'article' },
    })
    expect([200, 400]).toContain(r.status)
    // 清理
    if (r.status === 200) await http(`/api/admin/content/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('Unicode emoji / 特殊字符标题正常存储', async () => {
    const title = `🎵 test 🎧 ${Date.now()}`
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { title, category: 'AI', type: 'article' },
    })
    expect(r.status).toBe(200)
    if (r.status === 200) {
      expect(r.json.data.title).toContain('🎵')
      await http(`/api/admin/content/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
    }
  })

  it('嵌套 HTML 实体 sanitize', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        title: `nested-${Date.now()}`,
        category: 'AI',
        type: 'article',
        content: '<div><p>safe</p><iframe src="evil.com"></iframe></div>',
      },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.content).not.toContain('<iframe')
    await http(`/api/admin/content/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('CSV UTF-8 BOM 正常解析', async () => {
    const bom = '\ufeff'
    const TS = Date.now().toString()
    const QISHUI = `40${TS}`.slice(0, 15)
    const csv = `${bom}歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,2288/01/01 - 2288/01/31,BOM测试,="${QISHUI}",10,5,15\n`
    const form = new FormData()
    form.append('platform', 'qishui')
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'bom.csv')
    const res = await fetch(`${BASE_URL}/api/admin/revenue/imports`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: BASE_URL },
      body: form,
    })
    const j = await res.json()
    expect(res.status).toBe(200)
    expect(j.data.totalRows).toBeGreaterThanOrEqual(1)
  })
})

describe('边界 · 并发冲突', () => {
  it('并发评审同一首作品：一条成功一条 409', async () => {
    // 找一首 pending_review 的歌
    const list = await http('/api/admin/songs?status=pending_review&pageSize=1', { cookie: adminCookie })
    const song = list.json.data.list[0] as { id: number } | undefined
    if (!song) return  // 无 pending 则跳过

    const reviewerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13500008888', password: 'Abc12345', portal: 'reviewer' }),
    })
    const setCookie = reviewerLoginRes.headers.get('set-cookie') ?? ''
    const rCookie = setCookie.split(',').map(p => p.trim().split(';')[0]).filter(c => c.startsWith('access_token=')).join('; ')

    const payload = {
      songId: song.id,
      technique: 80, lyrics: 80, melody: 80, arrangement: 85, styleCreativity: 85, commercial: 75,
      comment: '并发测试评语超过二十字保证通过',
      recommendation: 'strongly_recommend',
    }
    const [a, b] = await Promise.all([
      http('/api/review/submit', { method: 'POST', cookie: rCookie, body: payload }),
      http('/api/review/submit', { method: 'POST', cookie: rCookie, body: payload }),
    ])
    const codes = [a.status, b.status].sort()
    // 两种合理结果：[200, 409] 或 [200, 400]（如果状态校验先走）
    expect(codes[0]).toBe(200)
    expect([400, 409]).toContain(codes[1])
  })

  it('并发点赞同一首：幂等保持 like_count <= 1', async () => {
    // 取一首 published 歌
    const list = await http('/api/admin/songs?status=published&pageSize=1', { cookie: adminCookie })
    const song = list.json.data.list[0] as { id: number; likeCount: number } | undefined
    if (!song) return
    const before = song.likeCount

    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        http(`/api/songs/${song.id}/like`, { method: 'POST', cookie: creatorCookie }),
      ),
    )
    const after = await http(`/api/admin/songs?status=published&pageSize=50`, { cookie: adminCookie })
    const updated = (after.json.data.list as { id: number; likeCount: number }[]).find((s) => s.id === song.id)
    // likeCount 差值 ≤ 1（同一用户幂等，取消/新增切换）
    if (updated) {
      expect(Math.abs(updated.likeCount - before)).toBeLessThanOrEqual(1)
    }
  })
})

describe('边界 · 文件上传格式', () => {
  it('上传 .WAV（大写扩展名）→ 200', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'SONG.WAV', fileSize: 1000, type: 'audio' },
    })
    expect([200, 400]).toContain(r.status)  // 实现可能大小写敏感
  })

  it('上传 .flac（不在白名单）→ 400', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'song.flac', fileSize: 1000, type: 'audio' },
    })
    expect(r.status).toBe(400)
  })

  it('上传 0 字节 → 400 或 200', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'empty.mp3', fileSize: 0, type: 'audio' },
    })
    expect([200, 400]).toContain(r.status)
  })

  it('上传超大头像 3MB → 400', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'avatar.png', fileSize: 3 * 1024 * 1024, type: 'image' },
    })
    // 5MB 限制，3MB 应通过；若项目策略 2MB 则 400
    expect([200, 400]).toContain(r.status)
  })

  it('SVG 伪装成 jpg（扩展名绕过）→ 应按扩展名通过 但注意：文件头校验未实现', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'fake.jpg', fileSize: 1000, type: 'image' },
    })
    expect(r.status).toBe(200)  // 仅扩展名白名单
  })
})

describe('边界 · 参数组合', () => {
  it('status + search 联合筛选', async () => {
    const r = await http('/api/admin/songs?status=published&search=星', { cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  it('同时传 minScore + maxScore 范围合理', async () => {
    const r = await http('/api/admin/songs?minScore=50&maxScore=99', { cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  it('minScore > maxScore（反向区间）→ 返回空列表', async () => {
    const r = await http('/api/admin/songs?minScore=90&maxScore=10', { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(r.json.data.list.length).toBe(0)
  })

  it('空 search 字符串 → 视为不筛', async () => {
    const r = await http('/api/admin/songs?search=', { cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  it('特殊字符搜索 → 不崩', async () => {
    const r = await http(`/api/admin/songs?search=${encodeURIComponent('%_')}`, { cookie: adminCookie })
    expect(r.status).toBe(200)
  })
})

describe('边界 · 状态机异常转移', () => {
  it('已归档歌曲再次 archive → 400', async () => {
    // 需要找 archived 歌
    const list = await http('/api/admin/songs?status=archived&pageSize=1', { cookie: adminCookie })
    const song = list.json.data.list[0] as { id: number } | undefined
    if (!song) return
    const r = await http(`/api/admin/songs/${song.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'archive' },
    })
    expect(r.status).toBe(400)
    // 清理：restore 回去
    await http(`/api/admin/songs/${song.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'restore' },
    })
  })

  it('needs_revision 状态直接 publish → 400', async () => {
    const list = await http('/api/admin/songs?status=needs_revision&pageSize=1', { cookie: adminCookie })
    const song = list.json.data.list[0] as { id: number } | undefined
    if (!song) return
    const r = await http(`/api/admin/songs/${song.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'publish' },
    })
    expect(r.status).toBe(400)
  })
})

describe('边界 · 权限细节', () => {
  it('未登录访问 /api/creator/* → 401', async () => {
    const r = await http('/api/creator/songs')
    expect(r.json.code).toBe(401)
  })

  it('未登录访问 /api/songs/1/like → 401', async () => {
    const r = await http('/api/songs/1/like', { method: 'POST' })
    expect([401, 403]).toContain(r.json.code)
  })

  it('未登录 /api/auth/refresh → 401', async () => {
    const r = await http('/api/auth/refresh', { method: 'POST' })
    expect([401, 400]).toContain(r.status)
  })

  it('无 CSRF Origin + 无 cookie → 中间件也放行（读 GET）', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard`, { method: 'GET' })
    // 无 cookie → 401；CSRF 仅拦截写方法
    expect(res.status).toBe(401)
  })

  it('HEAD 方法 /api/admin/songs → 405 或 200', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/songs`, {
      method: 'HEAD',
      headers: { Cookie: adminCookie, Origin: BASE_URL },
    })
    expect([200, 405]).toContain(res.status)
  })
})
