'use client'

import { ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'

interface StatCardProps {
  icon: ReactNode
  label: string
  val: string | number
  sub?: string
  subc?: string
  color: string
  iconBg: string
  page?: string
}

export function StatCard({ icon, label, val, sub, subc, color, iconBg, page }: StatCardProps) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()

  const handleClick = () => {
    if (page) router.push(page)
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--bg3)',
        border: `1px solid ${hovered ? color + '55' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '16px 13px',
        cursor: page ? 'pointer' : 'default',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 8px 24px rgba(0,0,0,0.30), 0 2px 8px ${color}22`
          : '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Top colored bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: color,
          borderRadius: '12px 12px 0 0',
        }}
      />

      <div className="flex items-start gap-3 mt-1">
        {/* Icon container */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            {val}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          {sub && (
            <div style={{ fontSize: 11, color: subc ?? 'var(--text3)', marginTop: 2 }}>{sub}</div>
          )}
        </div>
      </div>
    </div>
  )
}
