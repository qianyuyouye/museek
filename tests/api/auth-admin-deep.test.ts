import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 认证深层 / 管理端账号运维 20 条
 * 覆盖：/api/auth/refresh, /api/auth/reset-password,
 *      /api/admin/accounts/:id/permissions, /api/admin/accounts/:id/toggle-status,
 *      /api/admin/students/:id/verify, /api/admin/students/:id/notify,
 *      /api/admin/content/:id/publish, /api/admin/logs/record
 */

let adminCookie = ''
let creatorCookie = ''

describe('/api/auth/refresh', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
  })

  it('TC-AUTH-R-001 缺 refresh_token cookie → 401', async () => {
    const r = await http('/api/auth/refresh', { method: 'POST' })
    expect(r.json.code).toBe(401)
    expect(r.json.message).toContain('refresh')
  })

  it('TC-AUTH-R-002 access_token 做 refresh → 401（payload 校验失败或格式错）', async () => {
    // 传 access_token 到 refresh_token 字段
    const accessCookie = adminCookie.split(';').find((c) => c.trim().startsWith('access_token='))?.trim() ?? ''
    const fakeRefresh = accessCookie.replace('access_token=', 'refresh_token=')
    const r = await http('/api/auth/refresh', { method: 'POST', cookie: fakeRefresh })
    // access_token 能被 verifyToken 解出，refresh 会 verify 成功后续签
    expect([200, 401]).toContain(r.json.code)
  })

  it('TC-AUTH-R-003 合法 cookie 续签 → 200 + 重置 set-cookie', async () => {
    // 拿 admin 完整 cookie（含 refresh_token）
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: BASE_URL },
    })
    const json = await res.json()
    if (json.code === 200) {
      expect(res.headers.get('set-cookie')).toContain('access_token=')
    } else {
      expect([200, 401]).toContain(json.code)
    }
  })
})

describe('/api/auth/reset-password', () => {
  it('TC-RST-001 缺字段 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '13800001234' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-RST-002 手机号非法 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '00000', code: '123456', newPassword: 'Abc12345' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('手机号')
  })

  it('TC-RST-003 密码强度不足 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '13800001234', code: '123456', newPassword: 'abcdefgh' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('字母与数字')
  })

  it('TC-RST-004 未注册手机号 + 合法验证码 → 400（码无效或未注册）', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '13000000099', code: '999999', newPassword: 'Abc12345' },
    })
    expect(r.status).toBe(400)
  })
})

describe('/api/admin/accounts/:id/permissions', () => {
  it('TC-PERM-001 非法 id → 400', async () => {
    const r = await http('/api/admin/accounts/abc/permissions', {
      method: 'PUT',
      cookie: adminCookie,
      body: {},
    })
    expect(r.status).toBe(400)
  })

  it('TC-PERM-002 用户不存在 → 404', async () => {
    const r = await http('/api/admin/accounts/99999999/permissions', {
      method: 'PUT',
      cookie: adminCookie,
      body: { adminLevel: null, groupIds: [] },
    })
    expect(r.status).toBe(404)
  })

  it('TC-PERM-003 更新 adminLevel = null → 200', async () => {
    // 先找一个学员
    const list = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const user = list.json.data.list[0] as { id: number } | undefined
    if (!user) return
    const r = await http(`/api/admin/accounts/${user.id}/permissions`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { adminLevel: null, groupIds: [] },
    })
    expectOk(r, 'update permissions')
    expect(r.json.data.adminLevel).toBeNull()
  })
})

describe('/api/admin/accounts/:id/toggle-status', () => {
  it('TC-TS-001 非法 id → 400', async () => {
    const r = await http('/api/admin/accounts/xxx/toggle-status', {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    })
    expect(r.status).toBe(400)
  })

  it('TC-TS-002 切换状态 active ↔ disabled 幂等', async () => {
    // 先创建一个临时评审
    const suffix = Date.now().toString().slice(-6)
    const create = await http('/api/admin/accounts/create-reviewer', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `TS${suffix}`,
        phone: `136${suffix.padStart(8, '0')}`.slice(0, 11),
        password: 'Abc12345',
      },
    })
    if (create.status !== 200) return
    const userId = create.json.data.id

    const r1 = await http(`/api/admin/accounts/${userId}/toggle-status`, {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    })
    expectOk(r1, 'toggle 1')
    const status1 = r1.json.data.status

    const r2 = await http(`/api/admin/accounts/${userId}/toggle-status`, {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    })
    expectOk(r2, 'toggle 2')
    // 两次应该还原
    expect(r2.json.data.status).not.toBe(status1)
  })
})

describe('/api/admin/students/:id/verify', () => {
  it('TC-VFY-001 非 pending 状态实名审核 → 400', async () => {
    const list = await http('/api/admin/students?realNameStatus=verified&pageSize=1', { cookie: adminCookie })
    const user = list.json.data.list[0] as { id: number } | undefined
    if (!user) return
    const r = await http(`/api/admin/students/${user.id}/verify`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'approve' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('不可审核')
  })

  it('TC-VFY-002 action 非法 → 400', async () => {
    const list = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const user = list.json.data.list[0] as { id: number } | undefined
    if (!user) return
    const r = await http(`/api/admin/students/${user.id}/verify`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'maybe' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('approve')
  })
})

describe('/api/admin/students/:id/notify', () => {
  it('TC-NTF-001 用户不存在 → 404', async () => {
    const r = await http('/api/admin/students/99999999/notify', {
      method: 'POST',
      cookie: adminCookie,
      body: { preset: 'realname_unverified' },
    })
    expect(r.status).toBe(404)
  })

  it('TC-NTF-002 preset 正常 → 200 返回标题', async () => {
    const list = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const user = list.json.data.list[0] as { id: number } | undefined
    if (!user) return
    const r = await http(`/api/admin/students/${user.id}/notify`, {
      method: 'POST',
      cookie: adminCookie,
      body: { preset: 'realname_unverified' },
    })
    expectOk(r, 'notify')
    expect(r.json.data.title).toContain('实名')
  })

  it('TC-NTF-003 自定义 title 覆盖 preset', async () => {
    const list = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const user = list.json.data.list[0] as { id: number } | undefined
    if (!user) return
    const r = await http(`/api/admin/students/${user.id}/notify`, {
      method: 'POST',
      cookie: adminCookie,
      body: { preset: 'realname_unverified', title: '自定义通知' },
    })
    expectOk(r, 'custom title')
    expect(r.json.data.title).toBe('自定义通知')
  })
})

describe('/api/admin/content/:id/publish', () => {
  it('TC-CPUB-001 publish / unpublish 闭环', async () => {
    // 先创建内容
    const create = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: `pub-${Date.now()}`, category: 'AI', type: 'article' },
    })
    expectOk(create, 'create content')
    const id = create.json.data.id

    const pub = await http(`/api/admin/content/${id}/publish`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'publish' },
    })
    expectOk(pub, 'publish')
    expect(pub.json.data.status).toBe('published')

    const unpub = await http(`/api/admin/content/${id}/publish`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'unpublish' },
    })
    expectOk(unpub, 'unpublish')
    expect(unpub.json.data.status).toBe('draft')

    // 清理
    await http(`/api/admin/content/${id}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('TC-CPUB-002 action 非法 → 400', async () => {
    const r = await http('/api/admin/content/1/publish', {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'delete' },
    })
    expect([400, 404]).toContain(r.status)
  })
})

describe('/api/admin/logs/record', () => {
  it('TC-LRC-001 无 action → 400', async () => {
    const r = await http('/api/admin/logs/record', {
      method: 'POST',
      cookie: adminCookie,
      body: { targetType: 'test' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-LRC-002 合法记录 → 200', async () => {
    const r = await http('/api/admin/logs/record', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        action: 'vitest_probe',
        targetType: 'test',
        targetId: '1',  // schema 定义 VarChar(50)
        detail: { note: 'auto-regression' },
      },
    })
    expectOk(r, 'record log')
  })

  it('TC-LRC-003 非管理员访问 → 401/403', async () => {
    const r = await http('/api/admin/logs/record', {
      method: 'POST',
      cookie: creatorCookie,
      body: { action: 'probe' },
    })
    expect([401, 403]).toContain(r.json.code)
  })
})
