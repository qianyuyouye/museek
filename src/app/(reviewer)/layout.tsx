'use client'

import { useEffect, useState } from 'react'
import { ReviewerSidebar } from '@/components/layout/reviewer-sidebar'
import { GlobalToast } from '@/components/layout/global-toast'

function ReviewerGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => {
        if (!r.ok) throw new Error('unauthorized')
        return r.json()
      })
      .then((j) => {
        if (j.code === 200 && j.data?.type === 'reviewer') {
          setReady(true)
        } else {
          window.location.href = '/review/login'
        }
      })
      .catch(() => {
        window.location.href = '/review/login'
      })
  }, [])

  if (!ready) return null
  return <>{children}</>
}

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GlobalToast />
      <ReviewerSidebar />
      <main className="ml-[220px] min-h-screen p-6">
        <ReviewerGuard>{children}</ReviewerGuard>
      </main>
    </div>
  )
}
