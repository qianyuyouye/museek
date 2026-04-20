import { ReviewerSidebar } from '@/components/layout/reviewer-sidebar'
import { GlobalToast } from '@/components/layout/global-toast'

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GlobalToast />
      <ReviewerSidebar />
      <main className="ml-[200px] min-h-screen p-6">{children}</main>
    </div>
  )
}
