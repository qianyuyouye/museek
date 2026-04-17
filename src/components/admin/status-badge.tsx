interface StatusBadgeProps {
  label: string
  color: string
  bg: string
}

export function StatusBadge({ label, color, bg }: StatusBadgeProps) {
  return (
    <span
      className="inline-block rounded-[20px] px-2.5 py-[3px] text-xs font-medium"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}

// Maps realNameStatus string to a colored text span
const REAL_NAME_MAP: Record<string, { label: string; color: string }> = {
  verified: { label: '已认证', color: '#16a34a' },
  pending: { label: '审核中', color: '#d97706' },
  unverified: { label: '未认证', color: '#94a3b8' },
  rejected: { label: '已拒绝', color: '#e53e3e' },
}

interface RealNameBadgeProps {
  status: string
}

export function RealNameBadge({ status }: RealNameBadgeProps) {
  const map = REAL_NAME_MAP[status] ?? { label: status, color: 'var(--text2)' }
  return (
    <span className="text-xs font-medium" style={{ color: map.color }}>
      {map.label}
    </span>
  )
}
