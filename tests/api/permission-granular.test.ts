import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, adminLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 细粒度权限 10 条
 * 测试普通管理员（非超管）按角色 permissions 精确放行/拦截
 */

let adminCookie = ''
let limitedCookie = ''
let limitedAccount = ''
let limitedAdminId = 0
let limitedRoleId = 0

describe('细粒度权限 · 普通管理员', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie

    // 1. 创建一个只给 dashboard.view 权限的角色
    const SUFFIX = Date.now().toString().slice(-6)
    const roleRes = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `Lim${SUFFIX}`.slice(0, 8),
        description: 'vitest limited',
        permissions: {
          'admin.dashboard.view': true,
          // 显式不给 songs.view / revenue.view 等
        },
      },
    })
    expect(roleRes.status).toBe(200)
    limitedRoleId = roleRes.json.data.id

    // 2. 创建普通管理员绑定该角色
    limitedAccount = `lim${SUFFIX}`
    const adminRes = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: limitedAccount,
        name: '受限管理员',
        password: 'Abc12345',
        roleId: limitedRoleId,
      },
    })
    expect(adminRes.status).toBe(200)
    limitedAdminId = adminRes.json.data.id

    // 3. 该管理员登录
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: limitedAccount, password: 'Abc12345', portal: 'admin' }),
    })
    const sc = loginRes.headers.get('set-cookie') ?? ''
    limitedCookie = sc.split(',').map(p => p.trim().split(';')[0]).filter(c => c.startsWith('access_token=')).join('; ')
    expect(limitedCookie).toContain('access_token=')
  })

  afterAll(async () => {
    if (limitedAdminId) await http(`/api/admin/admins/${limitedAdminId}`, { method: 'DELETE', cookie: adminCookie })
    if (limitedRoleId) await http(`/api/admin/roles/${limitedRoleId}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('TC-GRN-001 已授予 dashboard.view → 200', async () => {
    const r = await http('/api/admin/dashboard', { cookie: limitedCookie })
    expectOk(r, 'granted dashboard')
  })

  it('TC-GRN-002 未授予 songs.view → 403', async () => {
    const r = await http('/api/admin/songs', { cookie: limitedCookie })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('admin.songs.view')
  })

  it('TC-GRN-003 未授予 revenue.view → 403', async () => {
    const r = await http('/api/admin/revenue/imports', { cookie: limitedCookie })
    expect(r.status).toBe(403)
  })

  it('TC-GRN-004 未授予 content.view → 403', async () => {
    const r = await http('/api/admin/content', { cookie: limitedCookie })
    expect(r.status).toBe(403)
  })

  it('TC-GRN-005 未授予 groups.view → 403', async () => {
    const r = await http('/api/admin/groups', { cookie: limitedCookie })
    expect(r.status).toBe(403)
  })

  it('TC-GRN-006 未授予 logs.view → 403（审计日志只对超管）', async () => {
    const r = await http('/api/admin/logs', { cookie: limitedCookie })
    expect(r.status).toBe(403)
  })

  it('TC-GRN-007 未授予 songs.operate（写）→ 403', async () => {
    const r = await http('/api/admin/songs/1/status', {
      method: 'POST',
      cookie: limitedCookie,
      body: { action: 'archive' },
    })
    expect(r.status).toBe(403)
  })

  it('TC-GRN-008 未授予 roles.view → 403', async () => {
    const r = await http('/api/admin/roles', { cookie: limitedCookie })
    expect(r.status).toBe(403)
  })

  it('TC-GRN-009 授予权限后立即生效（PUT role 加 songs.view）', async () => {
    const put = await http(`/api/admin/roles/${limitedRoleId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        name: 'Lim-x',
        description: 'vitest limited updated',
        permissions: {
          'admin.dashboard.view': true,
          'admin.songs.view': true,
        },
      },
    })
    expectOk(put, 'update role')
    const r = await http('/api/admin/songs?pageSize=1', { cookie: limitedCookie })
    expectOk(r, 'after grant songs.view')
  })

  it('TC-GRN-010 账号禁用后 requirePermission → 403（账号已禁用）', async () => {
    // 切换 status 至 false
    await http(`/api/admin/admins/${limitedAdminId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { status: false },
    })
    const r = await http('/api/admin/dashboard', { cookie: limitedCookie })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('禁用')
    // 恢复
    await http(`/api/admin/admins/${limitedAdminId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { status: true },
    })
  })
})
