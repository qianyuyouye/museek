'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { DataTable, Column } from '@/components/admin/data-table'
import { AdminModal } from '@/components/admin/admin-modal'
import { useApi } from '@/lib/use-api'
import { pageWrap, btnPrimary } from '@/lib/ui-tokens'

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
  const [detail, setDetail] = useState<Student | null>(null)

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
          className="bg-transparent border-0 p-0 cursor-pointer text-sm text-[var(--accent)]"
          onClick={(e) => {
            e.stopPropagation()
            setDetail(row as Student)
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
      <div className="flex items-center justify-end gap-1 mt-4 text-sm text-[var(--text2)]">
        <span className="mr-2">
          第 {startItem}-{endItem} 条/总共 {totalItems} 条
        </span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="w-7 h-7 rounded border border-[var(--border)] bg-white flex items-center justify-center text-sm"
          style={{
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            color: page === 1 ? '#ccc' : 'var(--text2)',
          }}
        >
          &lt;
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1">
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              className="w-7 h-7 rounded flex items-center justify-center text-sm cursor-pointer"
              style={{
                border: p === page ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: p === page ? 'var(--accent)' : 'white',
                color: p === page ? 'white' : 'var(--text2)',
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
          className="w-7 h-7 rounded border border-[var(--border)] bg-white flex items-center justify-center text-sm"
          style={{
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
            color: page === totalPages ? '#ccc' : 'var(--text2)',
          }}
        >
          &gt;
        </button>
        <span className="ml-2 text-sm">{PAGE_SIZE} 条/页</span>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  return (
    <div className={pageWrap}>
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
      <div className="flex gap-8 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className="bg-transparent border-0 py-2.5 text-sm cursor-pointer flex items-center gap-1.5 transition-all"
            style={{
              borderBottom:
                activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--text)' : '#8c95a6',
            }}
          >
            {tab.label}
            <span
              className="text-sm"
              style={{
                color: activeTab === tab.key ? 'var(--accent)' : '#8c95a6',
              }}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-xl border border-[var(--border)] border-t-0">
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={pagedData as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as Student).id}
        />
        <div className="px-4 pb-4">{renderPagination()}</div>
      </div>

      {/* 协议详情 Modal */}
      <AdminModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `协议详情 · ${detail.name}` : ''}
        width={480}
      >
        {detail && (
          <div className="flex flex-col gap-3 text-sm">
            {[
              { k: '学生姓名', v: detail.name },
              { k: '手机号', v: detail.phone },
              { k: '签署时间', v: detail.agencySignedAt ?? '未签署' },
              { k: '协议类型', v: TABS.find((t) => t.key === activeTab)?.label ?? '—' },
              { k: '协议版本', v: 'v1.0' },
              { k: '分成比例', v: '学生 70% · 平台 30%' },
              { k: '作品数', v: String(detail.songCount ?? 0) },
              { k: '协议状态', v: detail.agencyContract ? '✅ 已签署' : '未签署' },
            ].map((row) => (
              <div
                key={row.k}
                className="flex justify-between items-center px-3 py-2 rounded-md"
                style={{ background: '#f0f4fb' }}
              >
                <span className="text-[var(--text3)]">{row.k}</span>
                <span className="font-medium">{row.v}</span>
              </div>
            ))}
            <div className="text-xs text-[var(--text3)] mt-2 leading-relaxed">
              💡 完整协议原文和盖章版本请联系法务部获取存档 PDF。
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  )
}
