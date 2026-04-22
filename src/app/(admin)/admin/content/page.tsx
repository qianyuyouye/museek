'use client'

import { useState } from 'react'
import { FileText, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { AdminModal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { FileUploader } from '@/components/admin/file-uploader'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, btnPrimary, btnGhost, inputCls, labelCls, selectCls } from '@/lib/ui-tokens'

// ── Types ────────────────────────────────────────────────────────

interface CmsItem {
  id: number
  title: string
  cover: string | null
  category: string
  type: 'video' | 'article'
  status: 'published' | 'draft' | 'archived'
  views: number
  content: string | null
  videoUrl: string | null
  sections: string[] | null
  duration: string | null
  level: string | null
  author: string | null
  tags: string | null
  summary: string | null
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────────

const CATEGORIES = ['音乐教程', '乐理知识', '创作技巧', 'AI音乐', '行业动态']
const LEVELS = ['入门', '进阶', '高级']
const PER_PAGE = 8

// Strip /api/files/ prefix for the FileUploader, add it back for display
function stripApiPrefix(url: string | null): string | null {
  if (!url) return null
  return url.startsWith('/api/files/') ? url.replace('/api/files/', '') : url
}

// ── Step Indicator ───────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = ['基本信息', '内容编辑', '高级选项']
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.slice(0, total).map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === current
        const isDone = stepNum < current
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: isActive ? 'var(--accent)' : isDone ? 'var(--green)' : 'var(--bg4)',
                  color: isActive || isDone ? '#fff' : 'var(--text3)',
                  border: isDone ? 'none' : '1px solid var(--border)',
                }}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span className="text-xs" style={{ color: isActive ? 'var(--text)' : 'var(--text3)' }}>{label}</span>
            </div>
            {i < total - 1 && <div className="flex-1 h-px mx-2 bg-[var(--border)]" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export default function AdminContentPage() {
  const [tab, setTab] = useState<'all' | 'video' | 'article'>('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' }>({ msg: '', kind: 'ok' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CmsItem | null>(null)

  // Step state
  const [step, setStep] = useState(1)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [formType, setFormType] = useState<'video' | 'article'>('article')
  const [formContent, setFormContent] = useState('')
  const [formCover, setFormCover] = useState<string | null>(null)
  const [formVideoUrl, setFormVideoUrl] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [formAuthor, setFormAuthor] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formSummary, setFormSummary] = useState('')
  const [formSections, setFormSections] = useState('')
  const [saving, setSaving] = useState(false)

  const typeParam = tab === 'all' ? '' : `&type=${tab}`

  const { data, loading, refetch } = useApi<{ list: CmsItem[]; total: number }>(
    `/api/admin/content?page=${page}&pageSize=${PER_PAGE}${typeParam}`,
    [tab, page]
  )

  const items = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast({ msg: '', kind: 'ok' }), 3000)
  }

  function resetForm() {
    setFormTitle('')
    setFormCategory(CATEGORIES[0])
    setFormType('article')
    setFormContent('')
    setFormCover(null)
    setFormVideoUrl('')
    setFormDuration('')
    setFormLevel('')
    setFormAuthor('')
    setFormTags('')
    setFormSummary('')
    setFormSections('')
    setStep(1)
    setShowAdvanced(false)
  }

  function openCreateModal() {
    setEditingItem(null)
    resetForm()
    setModalOpen(true)
  }

  function openEditModal(item: CmsItem) {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormCategory(item.category)
    setFormType(item.type)
    setFormContent(item.content || '')
    setFormCover(stripApiPrefix(item.cover))
    setFormVideoUrl(item.videoUrl || '')
    setFormDuration(item.duration || '')
    setFormLevel(item.level || '')
    setFormAuthor(item.author || '')
    setFormTags(item.tags || '')
    setFormSummary(item.summary || '')
    setFormSections((item.sections || []).join('\n'))
    setStep(1)
    setShowAdvanced(false)
    setModalOpen(true)
  }

  function nextStep() {
    if (step === 1) {
      if (!formTitle.trim()) {
        showToast('请输入标题', 'err')
        return
      }
      if (formType === 'video' && !formVideoUrl.trim() && editingItem?.status === 'published') {
        showToast('已发布的视频必须填写 videoUrl', 'err')
        return
      }
    }
    setStep((s) => Math.min(3, s + 1))
  }

  function prevStep() {
    setStep((s) => Math.max(1, s - 1))
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      showToast('请输入标题', 'err')
      return
    }
    setSaving(true)
    const payload = {
      title: formTitle,
      category: formCategory,
      type: formType,
      content: formContent,
      cover: formCover ? `/api/files/${formCover}` : null,
      videoUrl: formVideoUrl || null,
      duration: formDuration || null,
      level: formLevel || null,
      author: formAuthor || null,
      tags: formTags || null,
      summary: formSummary || null,
      sections: formSections,
    }
    let res
    if (editingItem) {
      res = await apiCall(`/api/admin/content/${editingItem.id}`, 'PUT', payload)
    } else {
      res = await apiCall('/api/admin/content', 'POST', { ...payload, status: 'draft' })
    }
    setSaving(false)
    if (res.ok) {
      showToast(editingItem ? '内容已更新' : '内容已创建')
      setModalOpen(false)
      refetch()
    } else {
      showToast(res.message || '操作失败', 'err')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('确认删除该内容？学习记录也会一并清除。')) return
    const res = await apiCall(`/api/admin/content/${id}`, 'DELETE')
    if (res.ok) {
      showToast('已删除')
      refetch()
    } else {
      showToast(res.message || '删除失败', 'err')
    }
  }

  async function toggleStatus(id: number) {
    const item = items.find((r) => r.id === id)
    if (!item) return
    const action = item.status === 'published' ? 'unpublish' : 'publish'
    const res = await apiCall(`/api/admin/content/${id}/publish`, 'POST', { action })
    if (res.ok) {
      showToast(item.status === 'published' ? '已下架' : '已发布')
      refetch()
    } else {
      showToast(res.message || '操作失败', 'err')
    }
  }

  // Tab counts
  const countKey = items.length + '|' + items.map((x) => x.status).join(',')
  const { data: allData } = useApi<{ total: number }>('/api/admin/content?pageSize=1', [countKey])
  const { data: videoData } = useApi<{ total: number }>('/api/admin/content?type=video&pageSize=1', [countKey])
  const { data: articleData } = useApi<{ total: number }>('/api/admin/content?type=article&pageSize=1', [countKey])

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
      {toast.msg && (
        <div
          className={`fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border text-sm font-medium shadow-lg ${
            toast.kind === 'err'
              ? 'border-[var(--red)] text-[var(--red)]'
              : 'border-[var(--green)] text-[var(--green)]'
          }`}
        >
          {toast.msg}
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
      <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(99,102,241,0.05)]">
        {/* Tab bar */}
        <div className="flex items-center px-5 border-b border-[var(--border)] bg-[var(--bg3)]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1) }}
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
              <span className="ml-1 text-xs" style={{ color: tab === t.key ? 'var(--accent)' : 'var(--text3)' }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[var(--bg4)]">
              {['封面', '标题', '栏目', '类型', '作者', '浏览量', '状态', '操作'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text2)] border-b border-[var(--border)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--bg4)]">
                <td className="px-4 py-3.5">
                  {row.cover ? (
                    <img
                      src={row.cover}
                      alt=""
                      className="w-10 h-10 rounded object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <FileText className="w-4 h-4 text-[var(--text3)]" />
                  )}
                </td>
                <td className="px-4 py-3.5 font-medium text-[var(--text)]">{row.title}</td>
                <td className="px-4 py-3.5 text-[var(--text2)]">{row.category}</td>
                <td className="px-4 py-3.5 text-[var(--text2)]">{row.type === 'video' ? '视频' : '图文'}</td>
                <td className="px-4 py-3.5 text-[var(--text2)]">{row.author || '-'}</td>
                <td className="px-4 py-3.5 text-[var(--text2)]">{(row.views ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3.5">
                  {row.status === 'published' && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-medium text-[var(--green)] bg-[rgba(85,239,196,.1)]">已发布</span>
                  )}
                  {row.status === 'draft' && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-medium text-[var(--orange)] bg-[rgba(253,203,110,.08)]">草稿</span>
                  )}
                  {row.status === 'archived' && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-medium text-[var(--text3)] bg-[var(--bg4)]">已归档</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-1">
                    <button className="px-3 py-1 border-0 rounded-md bg-transparent text-[var(--accent)] text-xs font-medium cursor-pointer transition-colors hover:bg-[var(--bg4)]" onClick={() => openEditModal(row)}>编辑</button>
                    <button className={`px-3 py-1 border-0 rounded-md bg-transparent text-xs font-medium cursor-pointer transition-colors hover:bg-[var(--bg4)] ${row.status === 'published' ? 'text-[var(--text2)]' : 'text-[var(--green2)]'}`} onClick={() => toggleStatus(row.id)}>{row.status === 'published' ? '下架' : '发布'}</button>
                    <button className="px-3 py-1 border-0 rounded-md bg-transparent text-[var(--red)] text-xs font-medium cursor-pointer transition-colors hover:bg-[rgba(255,107,107,.06)]" onClick={() => handleDelete(row.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-5 py-3 flex justify-between items-center border-t border-[var(--border)] bg-[var(--bg4)]">
          <span className="text-xs text-[var(--text3)]">
            第 {total === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} 条/总共 {total} 条
          </span>
          <div className="flex items-center gap-[3px]">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`w-7 h-7 border border-[var(--border)] rounded-md bg-[var(--bg3)] flex items-center justify-center text-[13px] ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-[var(--text2)]'}`}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const n = i + 1
              return (
                <button key={n} onClick={() => setPage(n)} className={`w-7 h-7 rounded-md border text-[12.5px] cursor-pointer ${n === page ? 'border-[var(--accent)] bg-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)]'}`}>{n}</button>
              )
            })}
            {totalPages > 5 && <span className="text-[var(--text3)] text-xs px-0.5">···</span>}
            {totalPages > 5 && (
              <button onClick={() => setPage(totalPages)} className="w-7 h-7 border border-[var(--border)] rounded-md bg-[var(--bg3)] text-[var(--text2)] text-xs cursor-pointer">{totalPages}</button>
            )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`w-7 h-7 border border-[var(--border)] rounded-md bg-[var(--bg3)] flex items-center justify-center text-[13px] ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-[var(--text2)]'}`}>›</button>
            <span className="ml-2 text-[11.5px] text-[var(--text3)] bg-[var(--bg4)] px-2.5 py-[3px] rounded-md border border-[var(--border)]">8 条/页</span>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? '编辑内容' : '新建内容'}
        width={720}
      >
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          <StepIndicator current={step} total={3} />

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>标题 <span className="text-[var(--red)]">*</span></label>
                <input className={inputCls} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="请输入标题" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>栏目</label>
                  <select className={selectCls} value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>类型</label>
                  <select className={selectCls} value={formType} onChange={(e) => setFormType(e.target.value as 'video' | 'article')}>
                    <option value="article">图文</option>
                    <option value="video">视频</option>
                  </select>
                </div>
                <div>
                  <FileUploader type="image" value={formCover} onChange={setFormCover} label="封面" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className={btnGhost} onClick={() => setModalOpen(false)}>取消</button>
                <button className={btnPrimary} onClick={nextStep}>下一步</button>
              </div>
            </div>
          )}

          {/* Step 2: Content */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              {formType === 'video' ? (
                <>
                  <div>
                    <label className={labelCls}>视频 URL <span className="text-[var(--red)]">*（发布时必填）</span></label>
                    <input
                      className={inputCls}
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      placeholder="请填写 OSS/CDN 外部链接，如 https://..."
                    />
                    <p className="text-[11px] text-[var(--text3)] mt-1">视频文件较大，请上传到 OSS 或外部视频平台后填写链接</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>时长</label>
                      <input className={inputCls} value={formDuration} onChange={(e) => setFormDuration(e.target.value)} placeholder="如 45分钟" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>大纲章节（每行一条，可选）</label>
                    <textarea
                      className={`${inputCls} min-h-[80px] resize-y`}
                      value={formSections}
                      onChange={(e) => setFormSections(e.target.value)}
                      placeholder={'章节 1\n章节 2\n章节 3'}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>正文内容</label>
                  <RichTextEditor value={formContent} onChange={setFormContent} placeholder="请输入正文内容..." minHeight={280} />
                </div>
              )}
              <div className="flex justify-between gap-2 mt-4">
                <button className={btnGhost} onClick={prevStep}>上一步</button>
                <button className={btnPrimary} onClick={nextStep}>下一步</button>
              </div>
            </div>
          )}

          {/* Step 3: Advanced Options */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-[var(--text2)] cursor-pointer bg-transparent border-0"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)' }} />
                {showAdvanced ? '收起' : '展开'}高级选项
              </button>

              {showAdvanced && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>难度级别</label>
                      <select className={selectCls} value={formLevel} onChange={(e) => setFormLevel(e.target.value)}>
                        <option value="">未分级</option>
                        {LEVELS.map((l) => (<option key={l} value={l}>{l}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>作者/讲师</label>
                      <input className={inputCls} value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} placeholder="作者姓名" />
                    </div>
                    <div>
                      <label className={labelCls}>标签（逗号分隔）</label>
                      <input className={inputCls} value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="AI,编曲,入门" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>摘要</label>
                    <input className={inputCls} value={formSummary} onChange={(e) => setFormSummary(e.target.value)} placeholder="一句话简介（列表/卡片展示）" />
                  </div>
                </>
              )}

              <div className="flex justify-between gap-2 mt-4">
                <button className={btnGhost} onClick={prevStep}>上一步</button>
                <button className={`${btnPrimary} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={saving} onClick={handleSave}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  )
}
