import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-baseline gap-0">
        <h1 className="text-lg font-bold text-[var(--text)]">{title}</h1>
        {subtitle && (
          <span className="ml-2 text-xs font-normal text-[var(--text3)]">{subtitle}</span>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
