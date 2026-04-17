import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminProviders } from '@/components/layout/admin-providers'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AdminSidebar />
      <main className="ml-[200px] min-h-screen p-6">
        <AdminProviders>{children}</AdminProviders>
      </main>
    </div>
  )
}
