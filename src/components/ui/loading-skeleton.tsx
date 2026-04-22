'use client'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
  variant?: 'card' | 'text' | 'table' | 'circle'
  count?: number
}

export function Skeleton({ className = '', style, variant = 'text', count = 1 }: SkeletonProps) {
  const base = 'bg-[var(--bg4)] rounded animate-skeleton-pulse'
  const variants: Record<string, string> = {
    card: 'h-32 rounded-xl',
    text: 'h-4 w-full',
    table: 'h-10 w-full',
    circle: 'h-10 w-10 rounded-full',
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${base} ${variants[variant]} ${className}`}
          style={style}
        />
      ))}
    </>
  )
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton variant="circle" />
      <Skeleton variant="text" className="w-2/3" />
      <Skeleton variant="text" />
      <Skeleton variant="text" className="w-4/5" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-5">
      {/* Header row */}
      <div className="flex gap-4">
        <Skeleton variant="text" className="h-3 w-20" />
        <Skeleton variant="text" className="h-3 w-32" />
        <Skeleton variant="text" className="h-3 w-24" />
        <Skeleton variant="text" className="h-3 w-16" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton variant="text" className="h-4 w-20" />
          <Skeleton variant="text" className="h-4 w-32" />
          <Skeleton variant="text" className="h-4 w-24" />
          <Skeleton variant="text" className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
