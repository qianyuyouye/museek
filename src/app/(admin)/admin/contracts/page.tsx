'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, FileDown } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, Column } from '@/components/ui/data-table'
import { AdminModal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { useApi } from '@/lib/use-api'
import { pageWrap, btnPrimary, btnGhost, kvRow, kvLabel, paginationBtn, paginationBtnActive } from '@/lib/ui-tokens'
import { SETTING_KEYS } from '@/lib/settings-keys'

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

interface AgreementData {
  key: string
  label: string
  content: string
  version: string
  updatedAt: string
}

const EDITOR_TABS = [
  { key: SETTING_KEYS.AGENCY_TERMS, label: '代理发行协议' },
  { key: SETTING_KEYS.SERVICE_AGREEMENT, label: '用户服务协议' },
  { key: SETTING_KEYS.PRIVACY_POLICY, label: '隐私政策' },
] as const

const TABS = [
  ...EDITOR_TABS,
  { key: 'records', label: '签署记录' },
] as const

type TabKey = (typeof TABS)[number]['key']

const PAGE_SIZE = 8

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    const sanitized = s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@') ? "'" + s : s
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  const csv = [headers.join(','), ...data.map(row => headers.map(h => escape(row[h])).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminContractsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>(SETTING_KEYS.AGENCY_TERMS)
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')
  const [detail, setDetail] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)

  // Agreement editor state
  const [editorContent, setEditorContent] = useState('')
  const [editorVersion, setEditorVersion] = useState('')
  const [editorUpdatedAt, setEditorUpdatedAt] = useState('')
  const [contentDirty, setContentDirty] = useState(false)

  // Load agreement data when switching editor tabs
  const { data: agreementData, loading: agreementLoading, refetch: refetchAgreement } = useApi<AgreementData>(
    activeTab !== 'records' ? `/api/admin/agreements/${activeTab}` : '',
    [activeTab]
  )

  // Sync editor state when data loads
  useEffect(() => {
    if (agreementData) {
      setEditorContent(agreementData.content)
      setEditorVersion(agreementData.version)
      setEditorUpdatedAt(agreementData.updatedAt)
      setContentDirty(false)
    }
  }, [agreementData])

  const { data: studentsData, loading: studentsLoading } = useApi<{ list: Student[]; total: number }>(
    activeTab === 'records' ? '/api/admin/students?pageSize=500' : ''
  )
  const allStudents = studentsData?.list ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSaveAgreement() {
    if (!activeTab || activeTab === 'records') return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/agreements/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorContent, version: editorVersion }),
      })
      const json = await res.json()
      if (res.ok) {
        showToast('协议已保存')
        setContentDirty(false)
        refetchAgreement()
      } else {
        showToast(json.message || '保存失败')
      }
    } catch {
      showToast('保存出错')
    } finally {
      setSaving(false)
    }
  }

  const agencyStudents = allStudents.filter((s) => s.agencyContract)

  const tabCounts: Record<TabKey, number> = {
    [SETTING_KEYS.AGENCY_TERMS]: 0,
    [SETTING_KEYS.SERVICE_AGREEMENT]: 0,
    [SETTING_KEYS.PRIVACY_POLICY]: 0,
    records: agencyStudents.length,
  }

  const isEditorTab = activeTab !== 'records'

  const columns: Column<Student>[] = [
    { key: 'name', title: '学生姓名', render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span> },
    { key: 'phone', title: '手机号' },
    { key: 'agencySignedAt', title: '签署时间', render: (v) => <span>{(v as string) || '—'}</span> },
    { key: 'id', title: '协议版本', render: () => <span>{agreementData?.version || 'v1.0'}</span> },
    {
      key: 'id', title: '分成比例', render: (_v, row) => {
        const r = row as Student
        return <span>{r.agencySignedAt ? '学生70%' : '未签署'} <span style={{ color: 'var(--text3)' }}>·</span> 平台{r.agencySignedAt ? '30%' : '—'}</span>
      },
    },
    {
      key: 'id', title: '操作', render: (_v, row) => (
        <button className="bg-transparent border-0 p-0 cursor-pointer text-sm text-[var(--accent)]" onClick={(e) => { e.stopPropagation(); setDetail(row as Student) }}>查看详情</button>
      ),
    },
  ]

  function renderPagination() {
    const currentData = activeTab === 'records' ? agencyStudents : []
    const totalItems = currentData.length
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
    const startItem = (page - 1) * PAGE_SIZE + 1
    const endItem = Math.min(page * PAGE_SIZE, totalItems)
    if (totalItems <= PAGE_SIZE) return null

    const pages: (number | '...')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i)
      else if (pages[pages.length - 1] !== '...') pages.push('...')
    }

    return (
      <div className="flex items-center justify-end gap-1 mt-4 text-sm text-[var(--text2)]">
        <span className="mr-2">第 {startItem}-{endItem} 条/总共 {totalItems} 条</span>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`${paginationBtn} ${page === 1 ? 'opacity-40 cursor-not-allowed' : ''}`}>&lt;</button>
        {pages.map((p, i) => p === '...' ? (<span key={`dots-${i}`} className="px-1">···</span>) : (<button key={p} onClick={() => setPage(p)} className={`${paginationBtn} ${p === page ? paginationBtnActive : ''}`}>{p}</button>))}
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`${paginationBtn} ${page === totalPages ? 'opacity-40 cursor-not-allowed' : ''}`}>&gt;</button>
        <span className="ml-2 text-sm">{PAGE_SIZE} 条/页</span>
      </div>
    )
  }

  const editorLoading = agreementLoading && isEditorTab
  const recordsLoading = studentsLoading && activeTab === 'records'

  if (editorLoading || recordsLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  return (
    <div className={pageWrap}>
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">{toast}</div>
      )}

      <PageHeader
        title="合同管理"
        subtitle={isEditorTab ? '协议内容编辑' : '协议签署管理'}
        actions={
          activeTab === 'records' ? (
            <button className={btnPrimary} onClick={() => {
              const exportData = agencyStudents.map((s) => ({
                '创作者姓名': s.name,
                '手机号': s.phone,
                '签署时间': s.agencySignedAt ? new Date(s.agencySignedAt).toLocaleString('zh-CN') : '',
                '协议版本': agreementData?.version || 'v1.0',
                '分成比例': '学生70% · 平台30%',
              }))
              if (exportData.length === 0) { showToast('暂无已签约数据'); return }
              downloadCSV(exportData, `合同台账_已签名单_${new Date().toISOString().slice(0, 10)}.csv`)
              showToast(`已导出 ${exportData.length} 条签约记录`)
            }}>导出已签名单</button>
          ) : (
            <button className={btnPrimary} disabled={saving || !contentDirty} onClick={handleSaveAgreement}>
              {saving ? '保存中...' : '保存协议'}
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-8 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as TabKey); setPage(1) }}
            className="bg-transparent border-0 py-2.5 text-sm cursor-pointer flex items-center gap-1.5 transition-all"
            style={{
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text3)',
            }}
          >
            {tab.label}
            <span className="text-sm" style={{ color: activeTab === tab.key ? 'var(--accent)' : 'var(--text3)' }}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Editor Tabs */}
      {isEditorTab && (
        <div className="bg-[var(--bg3)] rounded-b-xl border border-[var(--border)] border-t-0 p-5">
          {/* Version info */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="text-[var(--text3)]">当前版本：</span>
            <input
              className="w-20 px-2 py-1 border border-[var(--border)] rounded text-sm"
              value={editorVersion}
              onChange={(e) => { setEditorVersion(e.target.value); setContentDirty(true) }}
              placeholder="1.0"
            />
            {editorUpdatedAt && (
              <span className="text-[var(--text3)]">最后更新：{editorUpdatedAt.replace('T', ' ').slice(0, 19)}</span>
            )}
          </div>

          <RichTextEditor
            value={editorContent}
            onChange={(html) => { setEditorContent(html); setContentDirty(true) }}
            placeholder="请输入协议正文内容..."
            minHeight={400}
          />
        </div>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div className="bg-[var(--bg3)] rounded-b-xl border border-[var(--border)] border-t-0">
          <DataTable
            columns={columns}
            data={agencyStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
            rowKey={(r) => r.id}
          />
          <div className="px-4 pb-4">{renderPagination()}</div>
        </div>
      )}

      {/* 协议详情 Modal */}
      <AdminModal open={!!detail} onClose={() => setDetail(null)} title={detail ? `协议详情 · ${detail.name}` : ''} width={480}>
        {detail && (
          <div className="flex flex-col gap-3 text-sm">
            {[
              { k: '学生姓名', v: detail.name },
              { k: '手机号', v: detail.phone },
              { k: '签署时间', v: detail.agencySignedAt ?? '未签署' },
              { k: '协议类型', v: TABS.find((t) => t.key === activeTab)?.label ?? '—' },
              { k: '协议版本', v: agreementData?.version || 'v1.0' },
              { k: '分成比例', v: detail.agencySignedAt ? '学生 70% · 平台 30%' : '未签署，无分成' },
              { k: '作品数', v: String(detail.songCount ?? 0) },
              { k: '协议状态', v: detail.agencyContract ? '已签署' : '未签署' },
            ].map((row) => (
              <div key={row.k} className={kvRow}>
                <span className={kvLabel}>{row.k}</span>
                <span className="font-medium">{row.v}</span>
              </div>
            ))}
            <div className="text-xs text-[var(--text3)] mt-2 leading-relaxed">完整协议原文和盖章版本请联系法务部获取存档 PDF。</div>
            <button className="text-xs text-[var(--accent)] cursor-pointer flex items-center gap-1 mt-1" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => window.location.href = '/admin/songs'}>
              <FileDown className="w-3 h-3" />前往歌曲库管理下载该创作者作品的发行证书
            </button>
          </div>
        )}
      </AdminModal>
    </div>
  )
}
