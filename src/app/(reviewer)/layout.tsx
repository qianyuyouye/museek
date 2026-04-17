import { ReviewerSidebar } from '@/components/layout/reviewer-sidebar'

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <ReviewerSidebar />
      <main className="ml-[200px] min-h-screen p-6">{children}</main>
    </div>
  )
}
