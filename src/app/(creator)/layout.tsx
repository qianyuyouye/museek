import { CreatorSidebar } from '@/components/layout/creator-sidebar'
import { GlobalToast } from '@/components/layout/global-toast'

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GlobalToast />
      <CreatorSidebar />
      <main className="ml-[200px] min-h-screen p-6">{children}</main>
    </div>
  )
}
