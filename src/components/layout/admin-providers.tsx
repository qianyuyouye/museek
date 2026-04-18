'use client'

import { ConfirmProvider } from '@/components/admin/confirm-dialog'
import { AdminRouteGuard } from './admin-route-guard'

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <AdminRouteGuard>{children}</AdminRouteGuard>
    </ConfirmProvider>
  )
}
