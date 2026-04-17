'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { DataTable, Column } from '@/components/admin/data-table'
import { useApi } from '@/lib/use-api'

// ── Types ────────────────────────────────────────────────────────

interface Student {
  id: number
  name: string
  phone: string
  agencyContract: boolean
  agencySignedAt?: string | null
  songCount: number
  totalRevenue?: number
  createdAt?: string
}

const btnPrimary =
  'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0'

const TABS = [
  { key: 'agency', label: '代理发行协议' },
  { key: 'service', label: '用户服务协议' },
  { key: 'privacy', label: '隐私政策' },
] as const

type TabKey = (typeof TABS)[number]['key']

const PAGE_SIZE = 8

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${String(row[h] ?? '')}"`).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminContractsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('agency')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')

  const { data: studentsData, loading } = useApi<{ list: Student[]; total: number }>(
    '/api/admin/students?pageSize=500'
  )
  const allStudents = studentsData?.list ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Data per tab
  const agencyStudents = useMemo(
    () => allStudents.filter((s) => s.agencyContract),
    [allStudents]
  )

  const tabCounts: Record<TabKey, number> = {
    agency: agencyStudents.length,
    service: allStudents.length,
    privacy: allStudents.length,
  }

  const currentData = activeTab === 'agency' ? agencyStudents : allStudents
  const totalPages = Math.max(1, Math.ceil(currentData.length / PAGE_SIZE))
  const pagedData = currentData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function switchTab(key: TabKey) {
    setActiveTab(key)
    setPage(1)
  }

  // Table columns
  const columns: Column<Student>[] = [
    {
      key: 'name',
      title: '学生姓名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    { key: 'phone', title: '手机号' },
    {
      key: 'agencySignedAt',
      title: '签署时间',
      render: (v) => <span>{(v as string) || '—'}</span>,
    },
    {
      key: 'id',
      title: '协议版本',
      render: () => <span>v1.0</span>,
    },
    {
      key: 'id',
      title: '分成比例',
      render: () => (
        <span>
          学生70% <span style={{ color: 'var(--text3)' }}>·</span> 平台30%
        </span>
      ),
    },
    {
      key: 'songCount',
      title: '操作',
      render: (_v, row) => (
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#6366f1',
            cursor: 'pointer',
            fontSize: 13,
            padding: 0,
          }}
          onClick={(e) => {
            e.stopPropagation()
            showToast(`正在查看 ${(row as Student).name} 的协议详情`)
          }}
        >
          查看详情
        </button>
      ),
    },
  ]

  // Pagination rendering
  function renderPagination() {
    if (currentData.length <= PAGE_SIZE) return null

    const totalItems = currentData.length
    const startItem = (page - 1) * PAGE_SIZE + 1
    const endItem = Math.min(page * PAGE_SIZE, totalItems)

    const pages: (number | '...')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          marginTop: 16,
          fontSize: 13,
          color: 'var(--text2)',
        }}
      >
        <span style={{ marginRight: 8 }}>
          第 {startItem}-{endItem} 条/总共 {totalItems} 条
        </span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            width: 28,
            height: 28,
            border: '1px solid #e8edf5',
            borderRadius: 4,
            background: 'white',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: page === 1 ? '#ccc' : 'var(--text2)',
          }}
        >
          &lt;
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} style={{ padding: '0 4px' }}>
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 28,
                height: 28,
                border: p === page ? '1px solid #6366f1' : '1px solid #e8edf5',
                borderRadius: 4,
                background: p === page ? '#6366f1' : 'white',
                color: p === page ? 'white' : 'var(--text2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: p === page ? 600 : 400,
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            width: 28,
            height: 28,
            border: '1px solid #e8edf5',
            borderRadius: 4,
            background: 'white',
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: page === totalPages ? '#ccc' : 'var(--text2)',
          }}
        >
          &gt;
        </button>
        <span style={{ marginLeft: 8, fontSize: 13 }}>{PAGE_SIZE} 条/页</span>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="合同台账"
        subtitle="协议签署管理"
        actions={
          <button
            className={btnPrimary}
            onClick={() => {
              const exportData = agencyStudents.map((s) => ({
                '创作者姓名': s.name,
                '手机号': s.phone,
                '签署时间': s.agencySignedAt ?? '',
                '协议版本': 'v1.0',
                '分成比例': '学生70% · 平台30%',
              }))
              if (exportData.length === 0) {
                showToast('暂无已签约数据')
                return
              }
              downloadCSV(exportData as unknown as Record<string, unknown>[], `合同台账_已签名单_${new Date().toISOString().slice(0, 10)}.csv`)
              showToast(`已导出 ${exportData.length} 条签约记录`)
            }}
          >
            📥 导出已签名单
          </button>
        }
      />

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          borderBottom: '1px solid #e8edf5',
          marginBottom: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              padding: '10px 0',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#1a1a2e' : '#8c95a6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.18s ease',
            }}
          >
            {tab.label}
            <span
              style={{
                fontSize: 13,
                color: activeTab === tab.key ? '#6366f1' : '#8c95a6',
              }}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        style={{
          background: 'white',
          borderRadius: '0 0 12px 12px',
          border: '1px solid #e8edf5',
          borderTop: 'none',
        }}
      >
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={pagedData as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as Student).id}
        />
        <div style={{ padding: '0 16px 16px' }}>{renderPagination()}</div>
      </div>
    </div>
  )
}
