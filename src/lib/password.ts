import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Theme 8: 统一密码强度校验。全平台所有密码入口必须经过此函数。
 * 规则（PRD §10.6 + GAP-ADMIN-009）：
 * - 长度 ≥ 8
 * - 同时包含字母与数字
 * 返回 null 表示通过，字符串表示错误原因。
 */
export function validatePassword(password: string | undefined | null): string | null {
  if (!password || password.length < 8) return '密码长度不能少于 8 位'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码必须同时包含字母与数字'
  return null
}
