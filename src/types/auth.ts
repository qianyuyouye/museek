export type Portal = 'admin' | 'creator' | 'reviewer'

export interface UserJwtPayload {
  sub: number
  type: 'creator' | 'reviewer'
  phone: string
  adminLevel?: 'group_admin' | 'system_admin' | null
  portal: 'creator' | 'reviewer'
}

export interface AdminJwtPayload {
  sub: number
  account: string
  roleId: number
  portal: 'admin'
}

export type JwtPayload = UserJwtPayload | AdminJwtPayload

export function isAdminPayload(payload: JwtPayload): payload is AdminJwtPayload {
  return payload.portal === 'admin'
}

export function isUserPayload(payload: JwtPayload): payload is UserJwtPayload {
  return payload.portal === 'creator' || payload.portal === 'reviewer'
}
