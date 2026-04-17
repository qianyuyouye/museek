import { describe, it, expect } from 'vitest'
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode('test-secret')

describe('JWT auth', () => {
  it('should sign and verify access token', async () => {
    const payload = { sub: 1, type: 'creator', phone: '13800001234', portal: 'creator' }
    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET)

    const { payload: decoded } = await jwtVerify(token, SECRET)
    expect(decoded.sub).toBe(1)
    expect(decoded.portal).toBe('creator')
  })

  it('should sign and verify admin token', async () => {
    const payload = { sub: 1, account: 'admin', roleId: 1, portal: 'admin' }
    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET)

    const { payload: decoded } = await jwtVerify(token, SECRET)
    expect(decoded.sub).toBe(1)
    expect(decoded.portal).toBe('admin')
  })

  it('should reject expired token', async () => {
    const payload = { sub: 1, portal: 'creator' }
    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('0s')
      .sign(SECRET)

    await new Promise(r => setTimeout(r, 1100))
    await expect(jwtVerify(token, SECRET)).rejects.toThrow()
  })
})
