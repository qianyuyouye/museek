import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 个人中心 18 条
 * 覆盖：/api/profile (GET/PUT), /api/profile/email, /api/profile/password,
 *      /api/profile/real-name, /api/profile/agency, /api/profile/login-logs
 */

let adminCookie = ''
let creatorCookie = ''
let reviewerCookie = ''

describe('个人中心 · GET /profile', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('TC-PRO-001 admin profile 含 role/permissions/isSuperAdmin', async () => {
    const r = await http('/api/profile', { cookie: adminCookie })
    expectOk(r, 'admin profile')
    const d = r.json.data
    expect(d.account).toBe('admin')
    expect(d.role).toBeTruthy()
    expect(d.isSuperAdmin).toBe(true)
    expect(typeof d.permissions).toBe('object')
  })

  it('TC-PRO-002 creator profile 含 realNameStatus / agencyContract', async () => {
    const r = await http('/api/profile', { cookie: creatorCookie })
    expectOk(r, 'creator profile')
    const d = r.json.data
    expect(d.type).toBe('creator')
    expect(['unverified', 'pending', 'verified', 'rejected']).toContain(d.realNameStatus)
    expect(typeof d.agencyContract).toBe('boolean')
  })

  it('TC-PRO-003 reviewer profile 有效', async () => {
    const r = await http('/api/profile', { cookie: reviewerCookie })
    expectOk(r, 'reviewer profile')
    expect(r.json.data.type).toBe('reviewer')
  })

  it('TC-PRO-004 未登录 → 401', async () => {
    const r = await http('/api/profile')
    expect(r.json.code).toBe(401)
  })
})

describe('个人中心 · PUT /profile', () => {
  it('TC-PRO-010 admin 更新 name', async () => {
    const r = await http('/api/profile', {
      method: 'PUT',
      cookie: adminCookie,
      body: { name: '平台管理员' },
    })
    expectOk(r, 'update name')
  })

  it('TC-PRO-011 creator 空 body → 400', async () => {
    const r = await http('/api/profile', {
      method: 'PUT',
      cookie: creatorCookie,
      body: {},
    })
    expect(r.status).toBe(400)
  })

  it('TC-PRO-012 creator 仅传 email → 400（邮箱需通过 /api/profile/email 验证码更新）', async () => {
    const r = await http('/api/profile', {
      method: 'PUT',
      cookie: creatorCookie,
      body: { email: `c_${Date.now()}@test.com` },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toBe('无更新字段')
  })
})

describe('修改邮箱 /profile/email', () => {
  it('TC-PRO-013 未发送验证码直接提交 → 400', async () => {
    const r = await http('/api/profile/email', {
      method: 'PUT',
      cookie: creatorCookie,
      body: { email: `c_${Date.now()}@test.com`, code: '000000' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('验证码')
  })

  it('TC-PRO-014 邮箱格式非法 → 400', async () => {
    const r = await http('/api/profile/email', {
      method: 'PUT',
      cookie: creatorCookie,
      body: { email: 'not-an-email', code: '123456' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('邮箱格式')
  })

  it('TC-PRO-015 发送验证码后正确提交 → 200', async () => {
    // 1. 发送验证码（不传 phone，接口自动从登录用户获取）
    const sendR = await http('/api/auth/sms/send', {
      method: 'POST',
      cookie: creatorCookie,
      body: { purpose: 'change_phone' },
    })
    // dev 模式（SMS 未配置）下返回 success=true + 固定码 123456
    if (sendR.status === 200 && sendR.json.success) {
      const r = await http('/api/profile/email', {
        method: 'PUT',
        cookie: creatorCookie,
        body: { email: `c_${Date.now()}@test.com`, code: '123456' },
      })
      expectOk(r, 'update email with verification')
    } else {
      // SMS 未配置且非 dev 模式，跳过此测试
      console.warn('跳过 TC-PRO-015：SMS 服务未配置')
    }
  })
})

describe('修改密码 /profile/password', () => {
  it('TC-PRO-020 旧密码错误 → 400', async () => {
    const r = await http('/api/profile/password', {
      method: 'POST',
      cookie: creatorCookie,
      body: { oldPassword: 'WrongOld123', newPassword: 'NewPass123' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('旧密码错误')
  })

  it('TC-PRO-021 新密码少于 8 位 → 400', async () => {
    const r = await http('/api/profile/password', {
      method: 'POST',
      cookie: creatorCookie,
      body: { oldPassword: 'Abc12345', newPassword: 'a1' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('长度')
  })

  it('TC-PRO-022 新密码纯字母 → 400', async () => {
    const r = await http('/api/profile/password', {
      method: 'POST',
      cookie: creatorCookie,
      body: { oldPassword: 'Abc12345', newPassword: 'abcdefgh' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('字母与数字')
  })

  it('TC-PRO-023 admin 旧密码错误 → 400', async () => {
    const r = await http('/api/profile/password', {
      method: 'POST',
      cookie: adminCookie,
      body: { oldPassword: 'wrong', newPassword: 'NewPass123' },
    })
    expect(r.status).toBe(400)
  })
})

describe('实名认证 /profile/real-name', () => {
  it('TC-PRO-030 格式非法身份证 → 400', async () => {
    const r = await http('/api/profile/real-name', {
      method: 'POST',
      cookie: creatorCookie,
      body: { realName: '张三', idCard: '123' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('身份证')
  })

  it('TC-PRO-031 姓名为数字 → 400', async () => {
    const r = await http('/api/profile/real-name', {
      method: 'POST',
      cookie: creatorCookie,
      body: { realName: '12345', idCard: '110101199001011234' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('真实姓名')
  })

  it('TC-PRO-032 管理员调用 → 400 (非实名对象)', async () => {
    const r = await http('/api/profile/real-name', {
      method: 'POST',
      cookie: adminCookie,
      body: { realName: '张三', idCard: '11010119900101123X' },
    })
    expect(r.status).toBe(400)
  })
})

describe('代理协议 + 登录日志', () => {
  it('TC-PRO-040 管理员访问 /profile/agency → 400', async () => {
    const r = await http('/api/profile/agency', {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    })
    expect(r.status).toBe(400)
  })

  it('TC-PRO-050 login-logs 返回数组 ≤10 条', async () => {
    const r = await http('/api/profile/login-logs', { cookie: creatorCookie })
    expectOk(r, 'login logs')
    const list = r.json.data as { time: string; ip: string }[]
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeLessThanOrEqual(10)
  })
})
