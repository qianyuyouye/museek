'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ value, onChange, placeholder = '搜索...', className = '' }: SearchBarProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div className={`relative ${className}`}>
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none select-none"
      >
        <Search className="w-4 h-4" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderColor: focused ? 'var(--accent)' : 'var(--border)',
          outline: 'none',
          transition: 'border-color 0.18s ease',
        }}
        className="w-full rounded-lg border-[1.5px] bg-[var(--bg3)] py-2.5 pl-[38px] pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text3)]"
      />
    </div>
  )
}
