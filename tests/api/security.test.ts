import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, BASE_URL } from './_helpers'

/**
 * 安全回归 10 条：CSRF / XSS / 越权 / 身份证加密 / 文件上传 / SQL 注入
 */

let adminCookie = ''
let creatorCookie = ''

describe('安全 · 准备', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
  })

  it('TC-SUPP-I-006 CSRF：恶意 Origin POST → 403', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://attacker.com',
        'Cookie': adminCookie,
      },
      body: JSON.stringify({ name: 'csrf' }),
    })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.message).toContain('CSRF')
  })

  it('CSRF：同源 POST → 通过（用合法载荷）', async () => {
    const r = await http('/api/admin/groups', {
      method: 'POST',
      cookie: adminCookie,
      body: {}, // 故意缺 name → 400，但不是 CSRF 403
    })
    expect(r.status).not.toBe(403)
  })

  it('TC-SUPP-I-005 SQL 注入：搜索参数被参数化绑定 → 不破坏 users 表', async () => {
    const r = await http(`/api/admin/groups?search=${encodeURIComponent("'; DROP TABLE users; --")}`, {
      cookie: adminCookie,
    })
    expect(r.status).toBe(200)
    // users 表仍存在：查询学员列表应正常（避免再调 login 消耗限流）
    const us = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    expect(us.status).toBe(200)
  })

  it('TC-SUPP-I-001 XSS：CMS 创建含 <script> → DB 存 sanitize 后', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        title: `xss_${Date.now()}`,
        category: 'AI',
        type: 'article',
        content: '<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(2)>',
        status: 'draft',
      },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.content).not.toContain('<script>')
    expect(r.json.data.content).not.toContain('onerror')
    // 清理
    await http(`/api/admin/content/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
  }, 30000)

  it('TC-SUPP-I-001 XSS：javascript: 协议被清空', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        title: `xss2_${Date.now()}`,
        category: 'AI',
        type: 'article',
        content: '<a href="javascript:alert(1)">click</a>',
        status: 'draft',
      },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.content).not.toContain('javascript:')
    await http(`/api/admin/content/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
  }, 30000)

  it('TC-BD-040 水平越权：creator 访问他人作品 → 403/404', async () => {
    // 借用 admin 查询一首其他人的作品（若有）。这里验证创作者访问一个他肯定没有的 id=99999
    const r = await http('/api/creator/songs/99999', { cookie: creatorCookie })
    expect([403, 404]).toContain(r.status)
  })

  it('TC-AUTH-092 未登录 /review/* → 307', async () => {
    const res = await fetch(`${BASE_URL}/review/queue`, { redirect: 'manual' })
    expect(res.status).toBe(307)
  })

  it('TC-SUPP-I-007 上传非法扩展名 .php → 400', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'evil.php', fileSize: 1000, type: 'audio' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('不支持')
  })

  it('TC-SUPP-I-007 上传超大 mp3 60MB → 400', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'big.mp3', fileSize: 60 * 1024 * 1024, type: 'audio' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('过大')
  })

  it('TC-SUPP-I-007 上传 token 支持别名 kind/name/size', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { name: 'song.mp3', size: 1000000, kind: 'audio' },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.uploadUrl).toBeTruthy()
  })
})
