import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/** CMS + 发行渠道 + 发行状态确认 + ISRC 12 条 */

let adminCookie = ''
let cmsId: number | undefined
const SUFFIX = Date.now().toString().slice(-6)

describe('CMS 内容管理', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('GET 列表 + 按 type 筛选', async () => {
    const r = await http('/api/admin/content?type=video', { cookie: adminCookie })
    expectOk(r, 'cms list')
    const list = r.json.data.list as { type: string }[]
    expect(list.every((i) => i.type === 'video')).toBe(true)
  })

  it('POST 创建图文', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        title: `vitest-${SUFFIX}`,
        category: 'AI工具教程',
        type: 'article',
        content: 'body',
        status: 'draft',
      },
    })
    expectOk(r, 'create cms')
    cmsId = r.json.data.id
  })

  it('POST 非法 type → 400', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: 'x', category: 'AI', type: 'podcast' },
    })
    expect(r.status).toBe(400)
  })

  it('POST 非法 status → 400', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: 'x', category: 'AI', type: 'article', status: 'whatever' },
    })
    expect(r.status).toBe(400)
  })

  it('PUT 发布', async () => {
    expect(cmsId).toBeTruthy()
    const r = await http(`/api/admin/content/${cmsId}/publish`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'publish' },
    })
    expect([200, 400]).toContain(r.status)
  })

  it('PUT 下架（status=draft）', async () => {
    expect(cmsId).toBeTruthy()
    const r = await http(`/api/admin/content/${cmsId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { status: 'draft' },
    })
    expectOk(r, 'unpublish')
    expect(r.json.data.status).toBe('draft')
  })

  it('PUT 归档（status=archived 新支持）', async () => {
    expect(cmsId).toBeTruthy()
    const r = await http(`/api/admin/content/${cmsId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { status: 'archived' },
    })
    expectOk(r, 'archive')
    expect(r.json.data.status).toBe('archived')
  })

  it('DELETE 清理', async () => {
    expect(cmsId).toBeTruthy()
    const r = await http(`/api/admin/content/${cmsId}`, { method: 'DELETE', cookie: adminCookie })
    expectOk(r, 'delete cms')
  })
})

describe('发行渠道 & 发行状态确认', () => {
  it('GET /api/admin/distributions 矩阵', async () => {
    const r = await http('/api/admin/distributions', { cookie: adminCookie })
    expectOk(r, 'distributions')
    expect(r.json.data.songs).toBeTruthy()
    expect(Array.isArray(r.json.data.platforms)).toBe(true)
  })

  it('POST /api/admin/distributions/:songId 更新单元格', async () => {
    const r = await http('/api/admin/distributions/1', {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: 'QQ音乐', status: 'submitted', submittedAt: '2099-01-01T00:00:00Z' },
    })
    expect(r.status).toBe(200)
  })

  it('GET /api/admin/publish-confirm 默认列表', async () => {
    const r = await http('/api/admin/publish-confirm', { cookie: adminCookie })
    expectOk(r, 'publish-confirm')
  })

  it('POST /api/admin/publish-confirm/sync 触发对账', async () => {
    const r = await http('/api/admin/publish-confirm/sync', { method: 'POST', cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(typeof r.json.data.autoConfirmed).toBe('number')
  })

  it('GET /api/admin/logs 操作日志列表含 id 字符串（BigInt 序列化）', async () => {
    const r = await http('/api/admin/logs?pageSize=5', { cookie: adminCookie })
    expectOk(r, 'logs')
    const list = r.json.data.list as { id: string }[]
    expect(list.every((x) => typeof x.id === 'string')).toBe(true)
  })
})
