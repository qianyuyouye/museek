import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/**
 * 权限粒度回归 8 条：
 * - 超管 isBuiltin 绕过所有权限检查
 * - 精确角色只能访问授权菜单
 * - 同模块 view / operate / manage 粒度独立
 * - profile API 返回 permissions + isSuperAdmin
 */

let adminCookie = ''
let viewerRoleId: number | undefined
let viewerUserId: number | undefined
let viewerCookie = ''
const VIEWER_ACCOUNT = `test_viewer_${Date.now()}`

describe('权限 · 准备夹具', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie

    // 建一个只有 revenue.view + dashboard.view + groups.view 的角色
    const rRole = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `测试查看${Date.now()}`,
        description: 'vitest fixture',
        permissions: {
          'admin.revenue.view': true,
          'admin.dashboard.view': true,
          'admin.groups.view': true,
        },
      },
    })
    expectOk(rRole, 'create role')
    viewerRoleId = rRole.json.data.id

    // 建一个绑定该角色的管理员
    const rAdmin = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: VIEWER_ACCOUNT,
        name: '测试查看员',
        password: 'Abc12345',
        roleId: viewerRoleId,
      },
    })
    expectOk(rAdmin, 'create admin')
    viewerUserId = rAdmin.json.data.id

    const rLogin = await http('/api/auth/login', {
      method: 'POST',
      body: { account: VIEWER_ACCOUNT, password: 'Abc12345', portal: 'admin' },
    })
    expectOk(rLogin, 'viewer login')
    const setCookie = rLogin.headers.get('set-cookie') ?? ''
    viewerCookie = setCookie
      .split(',')
      .map((p) => p.trim().split(';')[0])
      .filter((c) => c.startsWith('access_token='))
      .join('; ')
  })

  afterAll(async () => {
    // 清理
    if (viewerUserId) await http(`/api/admin/admins/${viewerUserId}`, { method: 'DELETE', cookie: adminCookie })
    if (viewerRoleId) await http(`/api/admin/roles/${viewerRoleId}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('TC-SUPP-A1 superadmin 访问 songs → 200', async () => {
    const r = await http('/api/admin/songs', { cookie: adminCookie })
    expectOk(r, 'admin songs')
  })

  it('TC-SUPP-A1 viewer 访问 dashboard（有权）→ 200', async () => {
    const r = await http('/api/admin/dashboard', { cookie: viewerCookie })
    expectOk(r, 'viewer dashboard')
  })

  it('TC-SUPP-A1 viewer 访问 groups GET（有 view）→ 200', async () => {
    const r = await http('/api/admin/groups', { cookie: viewerCookie })
    expectOk(r, 'viewer groups get')
  })

  it('TC-SUPP-A1 viewer POST groups（无 manage）→ 403', async () => {
    const r = await http('/api/admin/groups', {
      method: 'POST',
      cookie: viewerCookie,
      body: { name: 'should-fail' },
    })
    expect(r.json.code).toBe(403)
    expect(r.json.message).toContain('admin.groups.manage')
  })

  it('TC-SUPP-A1 viewer 访问 songs（无权限）→ 403', async () => {
    const r = await http('/api/admin/songs', { cookie: viewerCookie })
    expect(r.json.code).toBe(403)
    expect(r.json.message).toContain('admin.songs.view')
  })

  it('TC-SUPP-A1 viewer DELETE groups（无 manage）→ 403', async () => {
    const r = await http('/api/admin/groups/1', { method: 'DELETE', cookie: viewerCookie })
    expect(r.json.code).toBe(403)
  })

  it('TC-A-14-002 内置超管角色不可删', async () => {
    const r = await http('/api/admin/roles/1', { method: 'DELETE', cookie: adminCookie })
    expect(r.json.code).toBe(400)
    expect(r.json.message).toContain('内置')
  })

  it('profile 返回 permissions + isSuperAdmin', async () => {
    const rAdmin = await http('/api/profile', { cookie: adminCookie })
    expectOk(rAdmin, 'admin profile')
    expect(rAdmin.json.data.isSuperAdmin).toBe(true)

    const rViewer = await http('/api/profile', { cookie: viewerCookie })
    expectOk(rViewer, 'viewer profile')
    expect(rViewer.json.data.isSuperAdmin).toBe(false)
    expect(rViewer.json.data.permissions).toMatchObject({ 'admin.revenue.view': true })
  })
})
