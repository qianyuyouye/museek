import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, adminLogin, expectOk, BASE_URL } from './_helpers'
import { PERMISSION_TREE } from '@/lib/constants'

/**
 * 主题3 权限矩阵回归：
 * - edit / export / settle 三种新扩 action 的放行/拦截
 * - 变更权限 Modal type 白名单（后端拒绝非 creator/reviewer）
 * - PERMISSION_TREE 对齐 PRD 附录 G
 * - 超级管理员唯一性
 */

let adminCookie = ''
const SUFFIX = Date.now().toString().slice(-6)
let revenueViewerRoleId = 0
let revenueViewerAdminId = 0
let revenueViewerCookie = ''

async function loginAsAdmin(account: string, password = 'Abc12345'): Promise<string> {
  const r = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password, portal: 'admin' }),
  })
  const sc = r.headers.get('set-cookie') ?? ''
  return sc.split(',').map((p) => p.trim().split(';')[0]).filter((c) => c.startsWith('access_token=')).join('; ')
}

describe('主题3 · 权限矩阵回归', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie

    const roleRes = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `RV${SUFFIX}`.slice(0, 8),
        description: 'vitest revenue-view only',
        permissions: { 'admin.revenue.view': true },
      },
    })
    expectOk(roleRes, 'create revenue-view role')
    revenueViewerRoleId = roleRes.json.data.id

    const adminRes = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: `rv${SUFFIX}`,
        name: '收益查看员',
        password: 'Abc12345',
        roleId: revenueViewerRoleId,
      },
    })
    expectOk(adminRes, 'create revenue-view admin')
    revenueViewerAdminId = adminRes.json.data.id

    revenueViewerCookie = await loginAsAdmin(`rv${SUFFIX}`)
    expect(revenueViewerCookie).toContain('access_token=')
  })

  afterAll(async () => {
    if (revenueViewerAdminId) await http(`/api/admin/admins/${revenueViewerAdminId}`, { method: 'DELETE', cookie: adminCookie })
    if (revenueViewerRoleId) await http(`/api/admin/roles/${revenueViewerRoleId}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('TC-TM3-001 revenue.view 授予 → GET /revenue/stats 200', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: revenueViewerCookie })
    expectOk(r, 'revenue stats get')
  })

  it('TC-TM3-002 revenue.settle 未授予 → POST /revenue/settlements action=pay 403', async () => {
    const r = await http('/api/admin/revenue/settlements', {
      method: 'POST',
      cookie: revenueViewerCookie,
      body: { ids: [1], action: 'pay' },
    })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('admin.revenue.settle')
  })

  it('TC-TM3-003 revenue.edit 未授予 → POST /revenue/settlements action=confirm 403', async () => {
    const r = await http('/api/admin/revenue/settlements', {
      method: 'POST',
      cookie: revenueViewerCookie,
      body: { ids: [1], action: 'confirm' },
    })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('admin.revenue.edit')
  })

  it('TC-TM3-004 songs.export 未授予 → GET /songs/[id]/agency-pdf 403', async () => {
    const r = await http('/api/admin/songs/999999/agency-pdf', {
      cookie: revenueViewerCookie,
      raw: true,
    })
    expect(r.status).toBe(403)
  })

  it('TC-TM3-005 变更权限 type=管理员 → 400', async () => {
    const list = await http('/api/admin/accounts?pageSize=1&tab=creator', { cookie: adminCookie })
    expectOk(list, 'accounts list')
    const userId = list.json.data?.list?.[0]?.id
    if (!userId) {
      console.warn('[TC-TM3-005] no creator user available, skipping')
      return
    }
    const r = await http(`/api/admin/accounts/${userId}/permissions`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { type: '管理员', adminLevel: null, groupIds: [] },
    })
    expect(r.json.code).toBe(400)
    expect(r.json.message).toContain('用户类型')
  })

  it('TC-TM3-006 权限树 admin 子树含 PRD 附录 G 定义的 underscore 规范 key', () => {
    const adminPortal = PERMISSION_TREE.find((p) => p.key === 'admin')!
    const treeKeys = new Set(adminPortal.children.map((c) => c.key))
    for (const k of ['admin.cms', 'admin.publish_confirm', 'admin.batch_download']) {
      expect(treeKeys.has(k)).toBe(true)
    }
    const revenue = adminPortal.children.find((c) => c.key === 'admin.revenue')!
    expect(revenue.actions).toContain('settle')
    expect(revenue.actions).toContain('export')
  })

  it('TC-TM3-007 创建第二个 roleId=1 的超管 → 409', async () => {
    const r = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: `dup${SUFFIX}`,
        name: '重复超管',
        password: 'Abc12345',
        roleId: 1,
      },
    })
    expect(r.json.code).toBe(409)
    expect(r.json.message).toContain('超级管理员')
  })
})
