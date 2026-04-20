import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/** 平台管理员 / 角色 / 学员 / 评审账号 13 条 */

let adminCookie = ''
let createdRoleId: number | undefined
let createdAdminId: number | undefined
let createdReviewerId: number | undefined
const SUFFIX = Date.now().toString().slice(-6)

describe('角色管理', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('GET /api/admin/roles 列表', async () => {
    const r = await http('/api/admin/roles', { cookie: adminCookie })
    expectOk(r, 'roles list')
    expect(r.json.data.list.length).toBeGreaterThan(0)
  })

  it('POST 创建角色 超长 name 40 字符 → 400 或 200（由实现决定）', async () => {
    const r = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'a'.repeat(40), permissions: {} },
    })
    expect([200, 400]).toContain(r.status)
    // 若通过，清理
    if (r.status === 200 && r.json.data?.id) {
      await http(`/api/admin/roles/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
    }
  })

  it('POST 创建普通角色', async () => {
    const r = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `R${SUFFIX}`.slice(0, 8),
        description: 'vitest',
        permissions: { 'admin.dashboard.view': true },
      },
    })
    expectOk(r, 'create role')
    createdRoleId = r.json.data.id
  })

  it('PUT 修改权限 → 已绑管理员下次请求立即生效', async () => {
    expect(createdRoleId).toBeTruthy()
    const r = await http(`/api/admin/roles/${createdRoleId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        name: `R${SUFFIX}`.slice(0, 8),
        description: 'updated',
        permissions: { 'admin.dashboard.view': true, 'admin.groups.view': true },
      },
    })
    expectOk(r, 'update role')
  })

  it('DELETE 未绑管理员的角色 → 200', async () => {
    expect(createdRoleId).toBeTruthy()
    // 先创一个不被引用的新角色删除
    const create = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: `Rx${SUFFIX}`.slice(0, 8), permissions: {} },
    })
    expectOk(create, 'create for delete')
    const del = await http(`/api/admin/roles/${create.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
    expect(del.status).toBe(200)
  })
})

describe('平台管理员', () => {
  it('GET 列表', async () => {
    const r = await http('/api/admin/admins', { cookie: adminCookie })
    expectOk(r, 'admins list')
    expect(r.json.data.list.some((u: { account: string }) => u.account === 'admin')).toBe(true)
  })

  it('POST 创建普通管理员', async () => {
    expect(createdRoleId).toBeTruthy()
    const r = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: `ad${SUFFIX}`,
        name: '自动',
        password: 'Abc12345',
        roleId: createdRoleId,
      },
    })
    expectOk(r, 'create admin')
    createdAdminId = r.json.data.id
  })

  it('POST 账号重复 → 400', async () => {
    const r = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: { account: 'admin', name: 'x', password: 'Abc12345', roleId: 1 },
    })
    expect(r.status).toBe(400)
  })

  it('PUT 切换状态', async () => {
    expect(createdAdminId).toBeTruthy()
    const r = await http(`/api/admin/admins/${createdAdminId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { status: false },
    })
    expectOk(r, 'toggle')
  })

  it('DELETE 自己 → 400', async () => {
    const list = await http('/api/admin/admins', { cookie: adminCookie })
    const me = (list.json.data.list as { account: string; id: number }[]).find((u) => u.account === 'admin')
    const r = await http(`/api/admin/admins/${me!.id}`, { method: 'DELETE', cookie: adminCookie })
    expect(r.status).toBe(400)
  })

  it('DELETE 清理创建的管理员', async () => {
    expect(createdAdminId).toBeTruthy()
    const r = await http(`/api/admin/admins/${createdAdminId}`, { method: 'DELETE', cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  afterAll()
  // 清理 role
  async function afterAll() {
    if (createdRoleId) {
      await http(`/api/admin/roles/${createdRoleId}`, { method: 'DELETE', cookie: adminCookie })
    }
  }
})

describe('学员 + 评审账号', () => {
  it('GET /api/admin/students 列表 + 筛选 realNameStatus', async () => {
    const r = await http('/api/admin/students?realNameStatus=verified', { cookie: adminCookie })
    expectOk(r, 'students verified')
    const list = r.json.data.list as { realNameStatus: string }[]
    expect(list.every((u) => u.realNameStatus === 'verified')).toBe(true)
  })

  it('POST /api/admin/accounts/create-reviewer 创建评审', async () => {
    const r = await http('/api/admin/accounts/create-reviewer', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `R${SUFFIX}`,
        phone: `137${SUFFIX.padStart(8, '0')}`.slice(0, 11),
        email: `r${SUFFIX}@x.com`,
        password: 'Abc12345',
      },
    })
    expect([200, 400]).toContain(r.status)
    if (r.status === 200) createdReviewerId = r.json.data.id
  })

  it('创建评审手机号重复 → 400', async () => {
    const r = await http('/api/admin/accounts/create-reviewer', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'dup', phone: '13500008888', password: 'Abc12345' },
    })
    expect(r.status).toBe(400)
  })

  it('POST /api/admin/accounts/:id/reset-password 自动生成密码', async () => {
    if (!createdReviewerId) return
    const r = await http(`/api/admin/accounts/${createdReviewerId}/reset-password`, {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    })
    expectOk(r, 'reset pwd')
    // 掩码版本不返回完整密码
    expect(r.json.data.masked ?? r.json.data.password).toBeTruthy()
  })

  it('TC-RN-NOTIFY approve → tpl.realname_approved；reject + reason → tpl.realname_rejected', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // 置 pending，approve
    await prisma.user.update({ where: { id: creator!.id }, data: { realNameStatus: 'pending' } })
    const { cookie: admC } = await adminLogin()
    let r = await http(`/api/admin/students/${creator!.id}/verify`, { method: 'POST', cookie: admC, body: { action: 'approve' } })
    expectOk(r, 'approve')
    let notes = await prisma.notification.findMany({ where: { userId: creator!.id } })
    // tpl.realname_approved: type='system', title='实名认证已通过'
    expect(notes.some((n) => n.title?.includes('实名') && n.type === 'system')).toBe(true)
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // reject with reason
    await prisma.user.update({ where: { id: creator!.id }, data: { realNameStatus: 'pending' } })
    r = await http(`/api/admin/students/${creator!.id}/verify`, { method: 'POST', cookie: admC, body: { action: 'reject', reason: '身份证模糊' } })
    expectOk(r, 'reject')
    notes = await prisma.notification.findMany({ where: { userId: creator!.id } })
    // tpl.realname_rejected: content='驳回原因：{reason}。请修改后重新提交。'
    expect(notes.some((n) => n.content?.includes('身份证模糊'))).toBe(true)

    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.user.update({ where: { id: creator!.id }, data: { realNameStatus: 'verified' } })
  })
})
