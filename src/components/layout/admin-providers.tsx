'use client'

import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { AdminRouteGuard } from './admin-route-guard'
import { GlobalToast } from './global-toast'

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <GlobalToast />
      <AdminRouteGuard>{children}</AdminRouteGuard>
    </ConfirmProvider>
  )
}
