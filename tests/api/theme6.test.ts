import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorUserId = 0

describe('Theme 6 field-contract + defaults + copyright', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const login = await creatorLogin()
    creatorCookie = login.cookie
    creatorUserId = login.userId!
  })

  it.skip('placeholder', () => {})

  // Patch B1 & B2 tests
  // Patch C tests
  // Patch D tests
})
