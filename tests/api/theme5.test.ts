import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk, expectCode, BASE_URL } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorUserId = 0
let reviewerCookie = ''

describe('Theme 5 upload-security chain', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const c = await creatorLogin()
    creatorCookie = c.cookie
    creatorUserId = c.userId!
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('smoke: cookie 可用', () => {
    expect(adminCookie).toContain('access_token=')
    expect(creatorCookie).toContain('access_token=')
    expect(reviewerCookie).toContain('access_token=')
    expect(creatorUserId).toBeGreaterThan(0)
  })
  // Patch A/B/C/D/E 各组测试分别追加
})
