'use client'

interface TabItem {
  key: string
  label: string
  count?: number
}

interface AdminTabProps {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function AdminTab({ tabs, active, onChange }: AdminTabProps) {
  return (
    <div className="bg-[var(--bg4)] rounded-lg p-1 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            background: active === tab.key ? 'var(--accent)' : 'transparent',
            color: active === tab.key ? '#fff' : 'var(--text2)',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 13,
            fontWeight: active === tab.key ? 500 : 400,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[11px] opacity-70">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
