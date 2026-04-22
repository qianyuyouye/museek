'use client'

import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export interface Column<T> {
  key: string
  title: string
  render?: (value: unknown, row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  rowKey?: (row: T) => string | number
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2.5 text-left text-xs font-medium text-[var(--text2)] border-b border-[var(--border)] whitespace-nowrap"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-10 text-center text-sm text-[var(--text3)]"
              >
                <Inbox size={20} className="mx-auto mb-2 opacity-40" />
                <div>暂无数据</div>
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={rowKey ? rowKey(row) : idx}
                onClick={() => onRowClick?.(row)}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg4)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = ''
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-3 text-sm text-[var(--text)] border-b border-[var(--border)] whitespace-nowrap"
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
