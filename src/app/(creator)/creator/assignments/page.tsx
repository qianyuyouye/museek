'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle, cardCls, btnPrimary, btnGhost, btnSuccess, inputCls, labelCls } from '@/lib/ui-tokens'
import { formatDate } from '@/lib/format'

// ── Status Maps ────────────────────────────────────────────────

const ASN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '进行中', color: 'var(--green2)', bg: 'rgba(85,239,196,0.12)' },
  closed: { label: '已截止', color: 'var(--text3)', bg: 'rgba(107,114,128,0.12)' },
  draft: { label: '草稿', color: 'var(--orange)', bg: 'rgba(253,203,110,0.12)' },
}


// ── API response types ────────────────────────────────────────

interface AssignmentItem {
  id: number
  title: string
  groupId: number
  groupName: string
  description: string
  deadline: string
  status: 'active' | 'closed' | 'draft'
  memberCount: number
  submittedCount: number
  submitted: boolean
  createdAt: string
}

interface AssignmentGroup {
  group: { id: number; name: string }
  assignments: AssignmentItem[]
}

// ── Form field types ──────────────────────────────────────────

interface FormFieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'multi_select'
  options?: string[]
  required: boolean
  defaultValue: string | string[]
}

const DEFAULT_FORM_FIELDS: FormFieldDef[] = [
  { key: 'aiTool', label: '创作工具', type: 'multi_select', options: ['汽水创作实验室', 'Suno'], required: true, defaultValue: [] },
  { key: 'songTitle', label: '歌曲标题', type: 'text', required: true, defaultValue: '' },
  { key: 'performer', label: '表演者', type: 'text', required: true, defaultValue: '' },
  { key: 'lyricist', label: '词作者', type: 'text', required: true, defaultValue: '' },
  { key: 'composer', label: '曲作者', type: 'text', required: true, defaultValue: '' },
  { key: 'lyrics', label: '歌词', type: 'textarea', required: true, defaultValue: '' },
  { key: 'styleDesc', label: '风格描述', type: 'text', required: false, defaultValue: '' },
  { key: 'albumName', label: '专辑名称', type: 'text', required: false, defaultValue: '' },
  { key: 'albumArtist', label: '专辑歌手', type: 'text', required: false, defaultValue: '' },
]

// ── Main Component ─────────────────────────────────────────────

export default function CreatorAssignmentsPage() {
  const { data: assignmentsData, loading, refetch } = useApi<{ list: AssignmentItem[]; total: number }>('/api/creator/assignments')
  // 高级信息预填来源（GAP-CRTR-004）
  const { data: profile } = useApi<{ realName?: string | null; name?: string | null }>('/api/profile')
  const [activeAssignment, setActiveAssignment] = useState<number | null>(null)
  const [submittedView, setSubmittedView] = useState<number | null>(null)
  const [formFields, setFormFields] = useState<FormFieldDef[]>(DEFAULT_FORM_FIELDS)
  const [formData, setFormData] = useState<Record<string, string | string[]>>({})
  const [audioUploaded, setAudioUploaded] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioFileName, setAudioFileName] = useState('')
  const [audioSize, setAudioSize] = useState('')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const audioRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // 预填高级信息：performer / lyricist / composer / albumArtist 用 realName / name，albumName 用 songTitle（仅在字段存在且未填时）
  useEffect(() => {
    if (!profile || activeAssignment === null) return
    const fallback = profile.realName?.trim() || profile.name || ''
    const hasKey = (k: string) => formFields.some((f) => f.key === k)
    setFormData((prev) => {
      const next = { ...prev }
      if (hasKey('performer') && !next.performer) next.performer = fallback
      if (hasKey('lyricist') && !next.lyricist) next.lyricist = fallback
      if (hasKey('composer') && !next.composer) next.composer = fallback
      if (hasKey('albumArtist') && !next.albumArtist) next.albumArtist = fallback
      if (hasKey('albumName') && !next.albumName) next.albumName = (prev.songTitle as string) || ''
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeAssignment, formFields, formData.songTitle])

  async function handleAudioUpload(file: File) {
    setUploading(true)
    try {
      const tokenRes = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, type: 'audio' }),
      })
      const tokenJson = await tokenRes.json()
      if (tokenJson.code !== 200) {
        showToast(`❌ ${tokenJson.message || '获取上传凭证失败'}`)
        return
      }

      const { uploadUrl, fileUrl, headers: extraHeaders } = tokenJson.data

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type, ...extraHeaders },
      })

      if (!putRes.ok) {
        showToast('❌ 文件上传失败')
        return
      }

      setAudioUploaded(true)
      setAudioUrl(fileUrl)
      setAudioFileName(file.name)
      setAudioSize((file.size / 1024 / 1024).toFixed(1) + 'MB')
      showToast(`✅ ${file.name} 上传成功`)
    } catch {
      showToast('❌ 上传出错')
    } finally {
      setUploading(false)
    }
  }

  // Group flat assignment list by groupId
  const allAssignments = assignmentsData?.list ?? []
  const groups: AssignmentGroup[] = (() => {
    const map = new Map<number, AssignmentGroup>()
    for (const a of allAssignments) {
      if (!map.has(a.groupId)) {
        map.set(a.groupId, { group: { id: a.groupId, name: a.groupName }, assignments: [] })
      }
      map.get(a.groupId)!.assignments.push(a)
    }
    return Array.from(map.values())
  })()

  // Load form field config when an assignment is selected
  async function loadFieldsAndOpen(assignmentId: number) {
    setActiveAssignment(assignmentId)
    setFormData({})
    setAudioUploaded(false)
    setAudioUrl('')
    setAudioFileName('')
    setAudioSize('')
    try {
      const res = await fetch(`/api/creator/assignments/${assignmentId}/fields`)
      const json = await res.json()
      if (json.code === 200 && Array.isArray(json.data?.fields) && json.data.fields.length > 0) {
        setFormFields(json.data.fields.map((f: Record<string, unknown>) => ({
          key: f.fieldKey as string,
          label: (f.fieldLabel as string) || (f.fieldKey as string),
          type: (f.fieldType as string) === 'multiselect' ? 'multi_select' : f.fieldType as FormFieldDef['type'],
          options: Array.isArray(f.options) ? f.options as string[] : undefined,
          required: !!f.required,
          defaultValue: f.defaultValue ?? (f.fieldType === 'multi_select' || f.fieldType === 'multiselect' ? [] : ''),
        })))
      } else {
        setFormFields(DEFAULT_FORM_FIELDS)
      }
    } catch {
      setFormFields(DEFAULT_FORM_FIELDS)
    }
  }

  function resetForm() {
    setActiveAssignment(null)
    setFormFields(DEFAULT_FORM_FIELDS)
    setFormData({})
    setAudioUploaded(false)
    setAudioUrl('')
    setAudioFileName('')
    setAudioSize('')
  }

  // ── Toast element ──────────────────────────────────────────

  const toastEl = toast ? (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--text)] text-white px-6 py-3 rounded-xl text-sm font-medium shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-[fadeIn_0.3s]">
      {toast}
    </div>
  ) : null

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  // ── View: Submitted Detail ─────────────────────────────────

  if (submittedView !== null) {
    const asn = allAssignments.find((a) => a.id === submittedView)
    if (!asn) return null

    return (
      <div className={pageWrap}>
        {toastEl}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={textPageTitle}>{asn.title}</h1>
            <p className="mt-1 text-sm text-[var(--text2)]">
              {asn.groupName} · 已提交
            </p>
          </div>
          <button className={btnGhost} onClick={() => setSubmittedView(null)}>
            ← 返回作业列表
          </button>
        </div>

        <div className={cardCls}>
          <div className="text-center py-8">
            <div className="text-[56px]">✅</div>
            <h3 className="text-lg font-semibold mt-3">你已提交本次作业</h3>
            <p className="text-[var(--text3)] mt-2 text-[13px]">
              等待评审中...
            </p>
            <div className="mt-4">
              <button className={btnGhost} onClick={() => setSubmittedView(null)}>
                返回列表
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── View: Submit Form ──────────────────────────────────────

  if (activeAssignment !== null) {
    const asn = allAssignments.find((a) => a.id === activeAssignment)
    if (!asn) return null
    const grp = groups.find((g) => g.assignments.some((a) => a.id === activeAssignment))

    // Already submitted
    if (asn.submitted) {
      return (
        <div className={pageWrap}>
          {toastEl}
          <div className="flex items-center justify-between">
            <div>
              <h1 className={textPageTitle}>{asn.title}</h1>
              <p className="mt-1 text-sm text-[var(--text2)]">
                {grp?.group.name} — 已提交
              </p>
            </div>
            <button className={btnGhost} onClick={resetForm}>
              ← 返回
            </button>
          </div>
          <div className={cardCls}>
            <div className="text-center py-8">
              <div className="text-[56px]">✅</div>
              <h3 className="text-lg font-semibold mt-3">你已提交本次作业</h3>
              <div className="mt-4">
                <button className={btnGhost} onClick={resetForm}>
                  返回列表
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Submission form
    return (
      <div className={pageWrap}>
        {toastEl}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={textPageTitle}>
              提交作业 · {asn.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--text2)]">
              {grp?.group.name} · 截止 {formatDate(asn.deadline)}
            </p>
          </div>
          <button className={btnGhost} onClick={resetForm}>
            ← 返回
          </button>
        </div>

        <div className={cardCls}>
          {/* Audio Upload */}
          <h3 className="text-[15px] font-semibold mb-4">🎵 上传音频文件</h3>
          <input
            ref={audioRef}
            type="file"
            accept=".wav,.mp3,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleAudioUpload(f)
            }}
          />
          <div
            className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer transition-all mb-6 hover:border-[var(--accent)]"
            onClick={() => audioRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) handleAudioUpload(f)
            }}
          >
            {uploading ? (
              <div>
                <span className="text-4xl">⏳</span>
                <p className="mt-1.5 text-[var(--text2)] text-[13px]">上传中...</p>
              </div>
            ) : audioUploaded ? (
              <div>
                <span className="text-4xl">✅</span>
                <p className="mt-1.5 text-[var(--green)] text-[13px]">
                  {audioFileName} 已上传 ({audioSize})
                </p>
              </div>
            ) : (
              <div>
                <span className="text-4xl">🎵</span>
                <p className="mt-1.5 text-[var(--text2)] text-[13px]">
                  点击或拖拽上传音频文件
                </p>
                <p className="text-[11px] text-[var(--text3)]">
                  支持 WAV / MP3，最大 50MB
                </p>
              </div>
            )}
          </div>

          {/* Dynamic Form Fields */}
          <h3 className="text-[15px] font-semibold mb-4">📋 作品元数据</h3>
          <div className="grid grid-cols-2 gap-4">
            {formFields.map((field) => {
              if (field.type === 'textarea') {
                return (
                  <div key={field.key} className="col-span-2">
                    <label className={labelCls}>
                      {field.label}
                      {field.required && <span className="text-[var(--red)]"> *</span>}
                    </label>
                    <textarea
                      className={`${inputCls} min-h-[80px] resize-y`}
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`请输入${field.label}`}
                    />
                  </div>
                )
              }
              if (field.type === 'multi_select' && field.options) {
                const selected = (formData[field.key] as string[] | undefined) ?? []
                return (
                  <div key={field.key} className="col-span-2">
                    <label className={labelCls}>
                      {field.label}
                      {field.required && <span className="text-[var(--red)]"> *</span>}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {field.options.map((opt) => {
                        const active = selected.includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-all ${
                              active
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-white text-[var(--text2)] border-[var(--border)] hover:border-[var(--accent)]'
                            }`}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                [field.key]: active
                                  ? selected.filter((s) => s !== opt)
                                  : [...selected, opt],
                              }))
                            }}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }
              // Default: text input
              return (
                <div key={field.key}>
                  <label className={labelCls}>
                    {field.label}
                    {field.required && <span className="text-[var(--red)]"> *</span>}
                  </label>
                  <input
                    className={inputCls}
                    value={(formData[field.key] as string) || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={`请输入${field.label}`}
                  />
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-2">
            <button className={btnGhost} onClick={resetForm}>
              取消
            </button>
            <button
              className={`${btnSuccess} ${!audioUploaded || submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!audioUploaded || submitting}
              onClick={async () => {
                if (!audioUploaded) {
                  showToast('请先上传音频文件')
                  return
                }
                const missingField = formFields.find((f) => {
                  if (!f.required) return false
                  const val = formData[f.key]
                  if (Array.isArray(val)) return val.length === 0
                  return !val
                })
                if (missingField) {
                  showToast(`请填写${missingField.label}`)
                  return
                }

                setSubmitting(true)
                const res = await apiCall(`/api/creator/assignments/${activeAssignment}/submit`, 'POST', {
                  title: formData.songTitle || formData.title,
                  aiTools: formData.aiTool ? (Array.isArray(formData.aiTool) ? formData.aiTool : [formData.aiTool]) : undefined,
                  performer: formData.performer,
                  lyricist: formData.lyricist,
                  composer: formData.composer,
                  lyrics: formData.lyrics,
                  styleDesc: formData.styleDesc,
                  genre: formData.genre,
                  bpm: formData.bpm,
                  albumName: formData.albumName,
                  albumArtist: formData.albumArtist,
                  audioUrl: audioUrl,
                })
                setSubmitting(false)

                if (res.ok) {
                  showToast('作业提交成功！已进入评审队列')
                  resetForm()
                  refetch()
                } else {
                  showToast(res.message || '提交失败')
                }
              }}
            >
              提交作业
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── View: Assignment List ──────────────────────────────────

  return (
    <div className={pageWrap}>
      {toastEl}
      {/* Header */}
      <div>
        <h1 className={textPageTitle}>作业提交</h1>
        <p className="mt-1 text-sm text-[var(--text2)]">
          {groups.map((g) => g.group.name).join(' · ')} — 共 {allAssignments.length} 个作业
        </p>
      </div>

      {groups.map((grp) => {
        if (grp.assignments.length === 0) return null

        return (
          <div key={grp.group.id}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🏘️</span>
              <span className="text-[15px] font-semibold">{grp.group.name}</span>
              <span className="text-xs text-[var(--text3)]">
                ({grp.assignments.length}个作业)
              </span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
              {grp.assignments.map((asn) => {
                const st = ASN_STATUS[asn.status] || ASN_STATUS.active
                const isOverdue =
                  new Date(asn.deadline) < new Date() && !asn.submitted

                return (
                  <div
                    key={asn.id}
                    className={`${cardCls} cursor-pointer transition-all duration-200 hover:border-[var(--accent)] hover:-translate-y-0.5`}
                  >
                    {/* Status row */}
                    <div className="flex justify-between items-start mb-2.5">
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                        style={{ color: st.color, background: st.bg }}
                      >
                        {st.label}
                      </span>
                      {asn.submitted && (
                        <span className="text-[10px] px-[7px] py-0.5 rounded-full bg-[rgba(85,239,196,0.12)] text-[var(--green2)] font-medium">
                          已提交
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] px-[7px] py-0.5 rounded-full bg-[rgba(255,107,107,0.12)] text-[var(--red)] font-medium">
                          已截止
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="text-base font-semibold mb-1.5">
                      {asn.title}
                    </div>
                    <div className="text-xs text-[var(--text3)] mb-3 leading-relaxed">
                      {asn.description}
                    </div>

                    {/* Meta */}
                    <div className="flex justify-between items-center text-xs text-[var(--text3)] pt-2.5 border-t border-[var(--border)]">
                      <span>截止：{formatDate(asn.deadline)}</span>
                      <span>
                        {asn.submittedCount}/{asn.memberCount}人已提交
                      </span>
                    </div>

                    {/* Action */}
                    <div className="mt-3">
                      {asn.submitted ? (
                        <button
                          className={`${btnGhost} w-full justify-center text-[13px]`}
                          onClick={() => setSubmittedView(asn.id)}
                        >
                          查看提交详情
                        </button>
                      ) : (
                        <button
                          className={`${btnPrimary} w-full justify-center text-[13px] ${asn.status !== 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={asn.status !== 'active'}
                          onClick={() => loadFieldsAndOpen(asn.id)}
                        >
                          提交作业
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {allAssignments.length === 0 && (
        <div className={`${cardCls} text-center py-12`}>
          <div className="text-4xl mb-3">📭</div>
          <p className="text-[var(--text3)] text-sm">
            暂无作业，请等待管理员发布
          </p>
        </div>
      )}
    </div>
  )
}
