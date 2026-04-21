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

  it('POST /api/upload/token 返回 uploadUrl + key', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'demo.mp3', fileSize: 1024, type: 'audio' },
    })
    expectOk(r, '获取 upload token')
    expect(r.json.data.key).toMatch(/^uploads\/audio\/\d{8}_[0-9a-f]{16}\.mp3$/)
    expect(r.json.data.uploadUrl).toContain('/api/upload/local/' + r.json.data.key)
    expect(r.json.data.uploadUrl).toMatch(/sig=[0-9a-f]{64}/)
    expect(r.json.data.method).toBe('PUT')
  })

  it('POST /api/upload/token 非法扩展名 400', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'demo.exe', fileSize: 1024, type: 'audio' },
    })
    expectCode(r, 400)
  })

  it('POST /api/upload/token 超大尺寸 400', async () => {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'demo.mp3', fileSize: 100 * 1024 * 1024, type: 'audio' },
    })
    expectCode(r, 400)
  })

  describe('/api/upload/local PUT', () => {
    async function getToken(type: 'audio' | 'image', fileName: string) {
      const r = await http('/api/upload/token', {
        method: 'POST',
        cookie: creatorCookie,
        body: { fileName, fileSize: 1024, type },
      })
      expectOk(r)
      return r.json.data as { uploadUrl: string; key: string }
    }

    it('合法 token + 合法 MP3 头 → 200 + 文件落盘', async () => {
      const { uploadUrl, key } = await getToken('audio', 'ok.mp3')
      const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(1021)])
      const res = await fetch(BASE_URL + uploadUrl, {
        method: 'PUT',
        headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
        body,
      })
      expect(res.status).toBe(200)
      const fs = await import('fs')
      const path = await import('path')
      const root = process.env.STORAGE_ROOT || './storage'
      expect(fs.existsSync(path.resolve(root, key))).toBe(true)
    })

    it('SVG 伪装成 mp3 → 400', async () => {
      const { uploadUrl } = await getToken('audio', 'fake.mp3')
      const body = Buffer.concat([Buffer.from('<?xml version="1.0"?><svg>'), Buffer.alloc(1000)])
      const res = await fetch(BASE_URL + uploadUrl, {
        method: 'PUT',
        headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
        body,
      })
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.message).toMatch(/不匹配/)
    })

    it('过期 token PUT → 403', async () => {
      const { uploadUrl } = await getToken('audio', 'expire.mp3')
      // 篡改 exp 参数为过去时间
      const u = new URL(uploadUrl, BASE_URL)
      u.searchParams.set('exp', '1')
      const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(100)])
      const res = await fetch(u.toString(), {
        method: 'PUT',
        headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
        body,
      })
      expect(res.status).toBe(403)
    })

    it('他人 token（uid 不匹配）PUT → 403', async () => {
      const { uploadUrl } = await getToken('audio', 'other.mp3')
      // 用 admin cookie 拿 creator 的 token
      const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(100)])
      const res = await fetch(BASE_URL + uploadUrl, {
        method: 'PUT',
        headers: { 'Cookie': adminCookie, 'Origin': BASE_URL },
        body,
      })
      expect(res.status).toBe(403)
    })

    it('路径穿越 `..` → 400', async () => {
      const { uploadUrl } = await getToken('audio', 'trav.mp3')
      const u = new URL(uploadUrl, BASE_URL)
      const traverse = u.pathname.replace('uploads/audio', 'uploads/audio/..')
      const res = await fetch(BASE_URL + traverse + u.search, {
        method: 'PUT',
        headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
        body: Buffer.alloc(100),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('/api/files GET 网关', () => {
    it('合法签名 → 200 + 正确 Content-Type', async () => {
      // 先上传一个文件
      const tokenR = await http('/api/upload/token', {
        method: 'POST',
        cookie: creatorCookie,
        body: { fileName: 'getme.mp3', fileSize: 1024, type: 'audio' },
      })
      expectOk(tokenR)
      const { uploadUrl, key } = tokenR.json.data
      const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(1021)])
      const putRes = await fetch(BASE_URL + uploadUrl, {
        method: 'PUT',
        headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
        body,
      })
      expect(putRes.status).toBe(200)

      // signGetUrl 生成 GET 链接
      const { signGetUrl } = await import('@/lib/signature')
      const getUrl = await signGetUrl(key, { userId: creatorUserId })

      const getRes = await fetch(BASE_URL + getUrl)
      expect(getRes.status).toBe(200)
      expect(getRes.headers.get('content-type')).toContain('audio/mpeg')
    })

    it('过期签名 → 403', async () => {
      const { signGetUrl } = await import('@/lib/signature')
      const url = await signGetUrl('uploads/audio/x.mp3', { ttlSec: -1 })
      const res = await fetch(BASE_URL + url)
      expect(res.status).toBe(403)
    })

    it('篡改 sig → 403', async () => {
      const { signGetUrl } = await import('@/lib/signature')
      const url = await signGetUrl('uploads/audio/x.mp3')
      const tampered = url.replace(/sig=[0-9a-f]+/, 'sig=' + '0'.repeat(64))
      const res = await fetch(BASE_URL + tampered)
      expect(res.status).toBe(403)
    })

    it('路径 `..` → 400', async () => {
      const { signGetUrl } = await import('@/lib/signature')
      // 先拿一个合法 key 的签名参数，再手动拼入含 .. 的路径（不走 URL 构造函数，避免 normalize）
      const url = await signGetUrl('uploads/audio/x.mp3')
      const qStart = url.indexOf('?')
      const qs = qStart !== -1 ? url.slice(qStart) : ''
      // 直接拼接，绕过 URL normalize
      const rawUrl = BASE_URL + '/api/files/uploads/../secret.env' + qs
      const res = await fetch(rawUrl)
      expect(res.status).toBe(400)
    })

    it('文件不存在 → 404', async () => {
      const { signGetUrl } = await import('@/lib/signature')
      const url = await signGetUrl('uploads/audio/nonexistent_' + Date.now() + '.mp3')
      const res = await fetch(BASE_URL + url)
      expect(res.status).toBe(404)
    })
  })

  describe('creator/upload 写入 key 协议', () => {
    it('POST /api/creator/upload 接收 audioUrl=key（无前导 /），落库即 key', async () => {
      const key = 'uploads/audio/testkey_' + Date.now() + '.mp3'
      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: {
          title: '测试 Theme 5 key 协议',
          lyricist: '张三',
          composer: '张三',
          performer: '张三',
          genre: '流行',
          bpm: 120,
          contribution: 'lead',
          audioUrl: key,
          coverUrl: null,
          aiTools: ['suno'],
          styleDesc: 'test',
          creationDesc: 'test',
          lyrics: 'test',
        },
      })
      expectOk(r, 'creator upload')
      const song = await prisma.platformSong.findFirst({
        where: { userId: creatorUserId, title: '测试 Theme 5 key 协议' },
        orderBy: { id: 'desc' },
      })
      expect(song?.audioUrl).toBe(key)
      // 清理
      if (song) await prisma.platformSong.delete({ where: { id: song.id } })
    })
  })
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

import { checkMagicBytes } from '@/lib/magic-bytes'

describe('lib/magic-bytes', () => {
  const mp3_id3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(9)])
  const mp3_sync = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(8)])
  const wav = Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE'),
  ])
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)])
  const webp = Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'),
  ])
  const svg = Buffer.concat([Buffer.from('<?xml version="1.0"?><svg'), Buffer.alloc(20)])
  const tooSmall = Buffer.from([0xff])

  it('合法 MP3 ID3 头', () => {
    expect(checkMagicBytes(mp3_id3, 'audio')).toBeNull()
  })

  it('合法 MP3 帧同步 0xFFFB', () => {
    expect(checkMagicBytes(mp3_sync, 'audio')).toBeNull()
  })

  it('合法 WAV', () => {
    expect(checkMagicBytes(wav, 'audio')).toBeNull()
  })

  it('合法 PNG/JPEG/WEBP', () => {
    expect(checkMagicBytes(png, 'image')).toBeNull()
    expect(checkMagicBytes(jpeg, 'image')).toBeNull()
    expect(checkMagicBytes(webp, 'image')).toBeNull()
  })

  it('SVG 不是 image 被拒', () => {
    expect(checkMagicBytes(svg, 'image')).toMatch(/不匹配|invalid/i)
  })

  it('PNG 伪装成 audio 被拒', () => {
    expect(checkMagicBytes(png, 'audio')).toMatch(/不匹配|invalid/i)
  })

  it('过小 buffer 被拒', () => {
    expect(checkMagicBytes(tooSmall, 'audio')).toMatch(/过小|too small|无法识别/i)
  })
})

import { toSignedUrl } from '@/lib/signed-url'

describe('lib/signed-url', () => {
  it('null 输入返 null', async () => {
    expect(await toSignedUrl(null)).toBeNull()
  })

  it('不带 viewerId → 匿名签名 URL 含 exp/sig 不含 uid', async () => {
    const url = await toSignedUrl('uploads/audio/x.mp3')
    expect(url).toMatch(/^\/api\/files\/uploads\/audio\/x\.mp3\?/)
    const q = new URL(url!, 'http://x').searchParams
    expect(q.get('uid')).toBeNull()
    expect(q.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('带 viewerId → 签名含 uid', async () => {
    const url = await toSignedUrl('uploads/audio/x.mp3', 42)
    const q = new URL(url!, 'http://x').searchParams
    expect(q.get('uid')).toBe('42')
  })

  it('去除前导 / 的兜底', async () => {
    const url = await toSignedUrl('/uploads/audio/x.mp3')
    expect(url).toMatch(/^\/api\/files\/uploads\/audio\/x\.mp3\?/)
  })
})
