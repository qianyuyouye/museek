import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password', () => {
  it('should hash and verify correctly', async () => {
    const hash = await hashPassword('Abc12345')
    expect(hash).not.toBe('Abc12345')
    expect(await verifyPassword('Abc12345', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
