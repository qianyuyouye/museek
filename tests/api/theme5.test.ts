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

import { signPutUrl, signGetUrl, verifyLocalPutSig, verifyLocalGetSig } from '@/lib/signature'

describe('lib/signature HMAC local mode', () => {
  const key = 'uploads/audio/20260421_abc.mp3'

  it('signPutUrl 返回含 sig/exp/uid/type 的 uploadUrl', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const u = new URL(uploadUrl, 'http://x')
    expect(u.pathname).toBe('/api/upload/local/' + key)
    expect(u.searchParams.get('sig')).toMatch(/^[0-9a-f]{64}$/)
    expect(u.searchParams.get('exp')).toMatch(/^\d+$/)
    expect(u.searchParams.get('uid')).toBe('42')
    expect(u.searchParams.get('type')).toBe('audio')
  })

  it('verifyLocalPutSig 正确签名返回 null', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 42)).toBeNull()
  })

  it('verifyLocalPutSig 过期签名返回错误', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio', ttlSec: -1 })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 42)).toMatch(/过期|expired/i)
  })

  it('verifyLocalPutSig uid 不匹配返回错误', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 99)).toMatch(/用户|不匹配/)
  })

  it('verifyLocalPutSig type/key 目录不符返回错误', async () => {
    // key 是 uploads/audio/... 但 type 签成了 image
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'image' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 42)).toMatch(/类型|目录/)
  })

  it('signGetUrl 绑 userId 带 uid 参数', async () => {
    const url = await signGetUrl(key, { userId: 42 })
    const q = new URL(url, 'http://x').searchParams
    expect(q.get('uid')).toBe('42')
    expect(q.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('signGetUrl 不绑 userId（匿名）不含 uid', async () => {
    const url = await signGetUrl(key)
    const q = new URL(url, 'http://x').searchParams
    expect(q.get('uid')).toBeNull()
    expect(q.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('verifyLocalGetSig 匿名签名（无 uid）有效', async () => {
    const url = await signGetUrl(key)
    const q = new URL(url, 'http://x').searchParams
    expect(verifyLocalGetSig(key, q)).toBeNull()
  })

  it('verifyLocalGetSig 过期返回错误', async () => {
    const url = await signGetUrl(key, { ttlSec: -1 })
    const q = new URL(url, 'http://x').searchParams
    expect(verifyLocalGetSig(key, q)).toMatch(/过期|expired/i)
  })

  it('verifyLocalGetSig 篡改 sig 返回错误', async () => {
    const url = await signGetUrl(key)
    const q = new URL(url, 'http://x').searchParams
    q.set('sig', '0'.repeat(64))
    expect(verifyLocalGetSig(key, q)).toMatch(/签名|无效/)
  })

  it('verifyLocalPutSig 篡改 sig 为非 hex 返回错误不抛异常', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    q.set('sig', 'zzzz')
    expect(verifyLocalPutSig(key, q, 42)).toMatch(/签名|无效/)
  })
})
