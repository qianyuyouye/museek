'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const invited = useRef(false)

  useEffect(() => {
    if (invited.current) return
    invited.current = true

    const code = params?.inviteCode as string | undefined
    if (code) {
      localStorage.setItem('inviteCode', code)
      router.replace('/creator/register')
    } else {
      router.replace('/creator/login')
    }
  }, [params?.inviteCode, router])

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-[var(--text2)] text-sm">正在跳转，请稍候...</p>
      </div>
    </div>
  )
}
