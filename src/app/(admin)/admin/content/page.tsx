'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminModal } from '@/components/admin/admin-modal'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

// ── Types ────────────────────────────────────────────────────────

interface CmsItem {
  id: number
  title: string
  cover: string | null
  category: string
  type: 'video' | 'article'
  status: 'published' | 'draft'
  views: number
  content: string | null
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────────

const selectCls = `${inputCls} appearance-none cursor-pointer`

const CATEGORIES = ['音乐教程', '乐理知识', '创作技巧', 'AI音乐', '行业动态']

const PER_PAGE = 8

// ── Main Component ───────────────────────────────────────────────

export default function AdminContentPage() {
  const [tab, setTab] = useState<'all' | 'video' | 'article'>('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CmsItem | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [formType, setFormType] = useState<'video' | 'article'>('article')
  const [formContent, setFormContent] = useState('')
  const [formCover, setFormCover] = useState('')
  const [saving, setSaving] = useState(false)

  const typeParam = tab === 'all' ? '' : `&type=${tab}`

  const { data, loading, refetch } = useApi<{ list: CmsItem[]; total: number }>(
    `/api/admin/content?page=${page}&pageSize=${PER_PAGE}${typeParam}`,
    [tab, page]
  )

  const items = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openCreateModal() {
    setEditingItem(null)
    setFormTitle('')
    setFormCategory(CATEGORIES[0])
    setFormType('article')
    setFormContent('')
    setFormCover('')
    setModalOpen(true)
  }

  function openEditModal(item: CmsItem) {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormCategory(item.category)
    setFormType(item.type)
    setFormContent(item.content || '')
    setFormCover(item.cover || '')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      showToast('请输入标题')
      return
    }
    setSaving(true)
    let res
    if (editingItem) {
      res = await apiCall(`/api/admin/content/${editingItem.id}`, 'PUT', {
        title: formTitle,
        category: formCategory,
        type: formType,
        content: formContent,
        cover: formCover || null,
      })
    } else {
      res = await apiCall('/api/admin/content', 'POST', {
        title: formTitle,
        category: formCategory,
        type: formType,
        content: formContent,
        cover: formCover || null,
        status: 'draft',
      })
    }
    setSaving(false)
    if (res.ok) {
      showToast(editingItem ? '内容已更新' : '内容已创建')
      setModalOpen(false)
      refetch()
    } else {
      showToast(res.message || '操作失败')
    }
  }

  // Toggle publish/unpublish
  async function toggleStatus(id: number) {
    const item = items.find((r) => r.id === id)
    if (!item) return
    const action = item.status === 'published' ? 'unpublish' : 'publish'
    const res = await apiCall(`/api/admin/content/${id}/publish`, 'POST', { action })
    if (res.ok) {
      showToast(item.status === 'published' ? '已下架' : '已发布')
      refetch()
    } else {
      showToast(res.message || '操作失败')
    }
  }

  // We need counts for all tabs - use separate queries for counts
  const { data: allData } = useApi<{ total: number }>('/api/admin/content?pageSize=1')
  const { data: videoData } = useApi<{ total: number }>('/api/admin/content?type=video&pageSize=1')
  const { data: articleData } = useApi<{ total: number }>('/api/admin/content?type=article&pageSize=1')

  // Tab definitions
  const tabs = [
    { key: 'all' as const, label: '全部', count: allData?.total ?? 0 },
    { key: 'video' as const, label: '教学视频', count: videoData?.total ?? 0 },
    { key: 'article' as const, label: '音乐科普', count: articleData?.total ?? 0 },
  ]

  if (loading && items.length === 0) {
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
        title="内容管理"
        subtitle="课程与科普内容管理"
        actions={
          <button className={btnPrimary} onClick={openCreateModal}>
            新建内容
          </button>
        }
      />

      {/* Card wrapper */}
      <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(99,102,241,0.05)]">
        {/* Tab bar */}
        <div className="flex items-center px-5 border-b border-[#f0f4fb] bg-white">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                setPage(1)
              }}
              className="border-0 bg-transparent cursor-pointer whitespace-nowrap transition-all"
              style={{
                padding: '14px 4px',
                marginRight: 26,
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                fontSize: 13.5,
                color: tab === t.key ? 'var(--text)' : 'var(--text3)',
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.label}
              <span
                className="ml-1 text-xs"
                style={{
                  color: tab === t.key ? 'var(--accent)' : '#c8d0dc',
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f8faff]">
              {['标题', '栏目', '类型', '浏览量', '状态', '操作'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text2)] border-b border-[#edf0f9]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#f8f9ff] transition-colors hover:bg-[#f8faff]"
              >
                {/* 标题 */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{row.cover || '📄'}</span>
                    <span className="font-medium text-[var(--text)]">{row.title}</span>
                  </div>
                </td>
                {/* 栏目 */}
                <td className="px-4 py-3.5 text-[var(--text2)]">{row.category}</td>
                {/* 类型 */}
                <td className="px-4 py-3.5 text-[var(--text2)]">
                  {row.type === 'video' ? '视频' : '图文'}
                </td>
                {/* 浏览量 */}
                <td className="px-4 py-3.5 text-[var(--text2)]">
                  {(row.views ?? 0).toLocaleString()}
                </td>
                {/* 状态 */}
                <td className="px-4 py-3.5">
                  {row.status === 'published' ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-medium text-[var(--green)] bg-[#e0f7fa]">
                      已发布
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-medium text-[var(--orange)] bg-[#fef9ec]">
                      草稿
                    </span>
                  )}
                </td>
                {/* 操作 */}
                <td className="px-4 py-3.5">
                  <div className="flex gap-1">
                    <button
                      className="px-3 py-1 border-0 rounded-md bg-transparent text-[var(--accent)] text-xs font-medium cursor-pointer transition-colors hover:bg-[#eef2ff]"
                      onClick={() => openEditModal(row)}
                    >
                      编辑
                    </button>
                    <button
                      className={`px-3 py-1 border-0 rounded-md bg-transparent text-xs font-medium cursor-pointer transition-colors hover:bg-[#f4f7fe] ${
                        row.status === 'published' ? 'text-[var(--text2)]' : 'text-[var(--green2)]'
                      }`}
                      onClick={() => toggleStatus(row.id)}
                    >
                      {row.status === 'published' ? '下架' : '发布'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-5 py-3 flex justify-between items-center border-t border-[#f0f4fb] bg-[#fafbff]">
          <span className="text-xs text-[var(--text3)]">
            第 {total === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} 条/总共 {total} 条
          </span>
          <div className="flex items-center gap-[3px]">
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 border border-[var(--border)] rounded-md bg-white flex items-center justify-center text-[13px]"
              style={{
                cursor: page === 1 ? 'default' : 'pointer',
                color: page === 1 ? '#d1dae8' : 'var(--text2)',
              }}
            >
              ‹
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const n = i + 1
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className="w-7 h-7 rounded-md text-[12.5px] cursor-pointer"
                  style={{
                    border: '1px solid',
                    borderColor: page === n ? 'var(--accent)' : 'var(--border)',
                    background: page === n ? 'var(--accent)' : '#fff',
                    color: page === n ? '#fff' : 'var(--text2)',
                    fontWeight: page === n ? 600 : 400,
                  }}
                >
                  {n}
                </button>
              )
            })}
            {totalPages > 5 && (
              <span className="text-[var(--text3)] text-xs px-0.5">···</span>
            )}
            {totalPages > 5 && (
              <button
                onClick={() => setPage(totalPages)}
                className="w-7 h-7 border border-[var(--border)] rounded-md bg-white text-[var(--text2)] text-xs cursor-pointer"
              >
                {totalPages}
              </button>
            )}
            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 border border-[var(--border)] rounded-md bg-white flex items-center justify-center text-[13px]"
              style={{
                cursor: page === totalPages ? 'default' : 'pointer',
                color: page === totalPages ? '#d1dae8' : 'var(--text2)',
              }}
            >
              ›
            </button>
            {/* Per page label */}
            <span className="ml-2 text-[11.5px] text-[var(--text3)] bg-[#f4f7fe] px-2.5 py-[3px] rounded-md border border-[var(--border)]">
              8 条/页
            </span>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? '编辑内容' : '新建内容'}
        width={560}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>标题 <span className="text-[var(--red)]">*</span></label>
            <input
              className={inputCls}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="请输入标题"
            />
          </div>
          <div>
            <label className={labelCls}>封面（URL 或 Emoji）</label>
            <input
              className={inputCls}
              value={formCover}
              onChange={(e) => setFormCover(e.target.value)}
              placeholder="支持图片 URL 或 emoji（如 🎵），留空默认 📄"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>栏目</label>
              <select className={selectCls} value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>类型</label>
              <select className={selectCls} value={formType} onChange={(e) => setFormType(e.target.value as 'video' | 'article')}>
                <option value="article">图文</option>
                <option value="video">视频</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>内容</label>
            <textarea
              className={`${inputCls} min-h-[120px] resize-y`}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="请输入内容"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button className={btnGhost} onClick={() => setModalOpen(false)}>取消</button>
            <button
              className={`${btnPrimary} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
