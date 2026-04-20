import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/** 用户组 + 作业管理 15 条 */

let adminCookie = ''
let createdGroupId: number | undefined
let createdAssignmentId: number | undefined
const SUFFIX = Date.now().toString().slice(-6)

describe('用户组 CRUD', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('GET /api/admin/groups 列表 + 分页', async () => {
    const r = await http('/api/admin/groups?page=1&pageSize=5', { cookie: adminCookie })
    expectOk(r, 'groups list')
    expect(typeof r.json.data.total).toBe('number')
    expect(r.json.data.pageSize).toBeLessThanOrEqual(5)
  })

  it('POST /api/admin/groups 创建 → 自动生成邀请码', async () => {
    const r = await http('/api/admin/groups', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: `auto${SUFFIX}`, description: 'vitest' },
    })
    expectOk(r, 'create group')
    expect(r.json.data.inviteCode).toMatch(/^[A-Z0-9]{6,}$/)
    createdGroupId = r.json.data.id
  })

  it('POST /api/admin/groups 缺组名 → 400', async () => {
    const r = await http('/api/admin/groups', { method: 'POST', cookie: adminCookie, body: {} })
    expect(r.status).toBe(400)
  })

  it('POST /api/admin/groups 邀请码冲突 → 400', async () => {
    const r = await http('/api/admin/groups', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'dup', inviteCode: 'E2ETEST1' },
    })
    expect(r.status).toBe(400)
  })

  it('GET /api/admin/groups/:id 详情', async () => {
    expect(createdGroupId).toBeTruthy()
    const r = await http(`/api/admin/groups/${createdGroupId}`, { cookie: adminCookie })
    expectOk(r, 'group detail')
    expect(r.json.data.name).toContain(SUFFIX)
  })

  it('PUT /api/admin/groups/:id 更新描述', async () => {
    expect(createdGroupId).toBeTruthy()
    const r = await http(`/api/admin/groups/${createdGroupId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { description: 'updated by vitest' },
    })
    expectOk(r, 'update group')
  })

  it('GET /api/admin/groups/:id/members 成员列表', async () => {
    expect(createdGroupId).toBeTruthy()
    const r = await http(`/api/admin/groups/${createdGroupId}/members`, { cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  it('DELETE /api/admin/groups/:id 清理', async () => {
    expect(createdGroupId).toBeTruthy()
    const r = await http(`/api/admin/groups/${createdGroupId}`, { method: 'DELETE', cookie: adminCookie })
    expect([200, 400]).toContain(r.status)  // 若有成员则 400
  })
})

describe('作业 CRUD', () => {
  it('GET /api/admin/assignments 列表', async () => {
    const r = await http('/api/admin/assignments', { cookie: adminCookie })
    expectOk(r, 'assignments list')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('POST /api/admin/assignments 创建', async () => {
    const r = await http('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        groupId: 1,
        title: `vitest-as-${SUFFIX}`,
        description: 'auto',
        deadline: '2099-12-31',
      },
    })
    expectOk(r, 'create assignment')
    createdAssignmentId = r.json.data.id
  })

  it('POST 缺 title → 400', async () => {
    const r = await http('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { groupId: 1, deadline: '2099-12-31' },
    })
    expect(r.status).toBe(400)
  })

  it('GET /api/admin/assignments/:id 详情', async () => {
    expect(createdAssignmentId).toBeTruthy()
    const r = await http(`/api/admin/assignments/${createdAssignmentId}`, { cookie: adminCookie })
    expectOk(r, 'assignment detail')
  })

  it('PUT 关闭作业 → status=closed', async () => {
    expect(createdAssignmentId).toBeTruthy()
    const r = await http(`/api/admin/assignments/${createdAssignmentId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { status: 'closed', title: `vitest-as-${SUFFIX}`, deadline: '2099-12-31' },
    })
    expectOk(r, 'close')
    expect(r.json.data.status).toBe('closed')
  })

  it('PUT 配置表单字段（按组级）', async () => {
    expect(createdAssignmentId).toBeTruthy()
    const r = await http(`/api/admin/assignments/${createdAssignmentId}/fields`, {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        fields: [
          { fieldKey: 'song_title', fieldLabel: '标题', fieldType: 'text', required: true, displayOrder: 1 },
        ],
      },
    })
    expectOk(r, 'fields')
    expect(r.json.data.length).toBeGreaterThan(0)
  })

  it('DELETE 清理作业', async () => {
    expect(createdAssignmentId).toBeTruthy()
    const r = await http(`/api/admin/assignments/${createdAssignmentId}`, { method: 'DELETE', cookie: adminCookie })
    expect([200, 400]).toContain(r.status)
  })

  it('TC-ASN-NOTIFY 作业创建后广播 tpl.assignment_created 给组成员', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    const group = await prisma.group.findUnique({ where: { inviteCode: 'E2ETEST1' } })
    const { cookie: admC } = await adminLogin()
    const r = await http('/api/admin/assignments', {
      method: 'POST',
      cookie: admC,
      body: { title: '通知测试作业', description: '做一做', groupId: group!.id, deadline: '2099-12-31' },
    })
    expectOk(r, 'assignment create')

    const asnId = (r.json.data as { id: number }).id
    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'assignment', targetId: String(asnId) } })
    expect(notes.length).toBe(1)
    expect(notes[0].title).toContain('通知测试作业')
    expect(notes[0].type).toBe('assignment')

    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.assignment.delete({ where: { id: asnId } })
  })
})
