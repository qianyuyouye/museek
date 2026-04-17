'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/admin/page-header'
import { DataTable, Column } from '@/components/admin/data-table'
import { useApi } from '@/lib/use-api'
import { pageWrap, cardCls } from '@/lib/ui-tokens'

// ── Types ────────────────────────────────────────────────────────

interface Teacher {
  id: number
  name: string
  adminLevel: string | null
  reviewCount?: number
  avgTimeSeconds?: number
  avgScore?: number
  recommendRate?: number
}

const columns: Column<Teacher>[] = [
  {
    key: 'name',
    title: '老师姓名',
    render: (v, row) => {
      const r = row as unknown as Teacher
      return (
        <span style={{ fontWeight: 600 }}>
          {v as string}
          {r.adminLevel === 'group_admin' && (
            <span style={{ marginLeft: 6 }}>🔰</span>
          )}
        </span>
      )
    },
  },
  {
    key: 'reviewCount',
    title: '批改数量',
    render: (v) => <span>{(v as number) ?? 0}</span>,
  },
  {
    key: 'avgTimeSeconds',
    title: '平均用时',
    render: (v) => {
      const seconds = (v as number) ?? 0
      const minutes = Math.floor(seconds / 60)
      return <span>{minutes}分钟</span>
    },
  },
  {
    key: 'avgScore',
    title: '平均评分',
    render: (v) => {
      const score = (v as number) ?? 0
      const color = score >= 80 ? 'var(--green2)' : 'var(--orange)'
      return <span style={{ color, fontWeight: 500 }}>{score}分</span>
    },
  },
  {
    key: 'recommendRate',
    title: '推荐发行率',
    render: (v) => <span>{(v as number) ?? 0}%</span>,
  },
]

export default function AdminTeachersPage() {
  const { data: teachersData, loading } = useApi<{ list: Teacher[] }>(
    '/api/admin/accounts?tab=reviewer&pageSize=100'
  )
  const teachers = teachersData?.list ?? []

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  return (
    <div className={pageWrap}>
      <PageHeader
        title="老师绩效"
        subtitle="评审工作量统计"
        actions={
          <Link
            href="/admin/accounts"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] shadow-[0_2px_8px_rgba(99,102,241,0.25)] no-underline"
          >
            👥 管理老师账号 →
          </Link>
        }
      />

      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">老师绩效</h3>
        </div>
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={teachers as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as Teacher).id}
        />
      </div>
    </div>
  )
}
