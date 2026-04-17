'use client'

import { ConfirmProvider } from '@/components/admin/confirm-dialog'

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return <ConfirmProvider>{children}</ConfirmProvider>
}
