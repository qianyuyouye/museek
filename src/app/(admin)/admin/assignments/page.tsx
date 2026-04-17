'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { StatCard } from '@/components/admin/stat-card'
import { DataTable, Column } from '@/components/admin/data-table'
import { AdminModal } from '@/components/admin/admin-modal'
import { useApi, apiCall } from '@/lib/use-api'

// ── Types ────────────────────────────────────────────────────────

interface Assignment {
  id: number
  title: string
  description: string | null
  groupId: number
  groupName: string
  deadline: string
  status: 'active' | 'closed'
  submissionCount: number
  totalMembers: number
  createdAt: string
}

interface Submission {
  id: number
  assignmentId: number
  userId: number
  submittedAt: string
  user: { id: number; name: string; realName: string | null }
  platformSong: { id: number; title: string; aiTools: string | null; score: number | null; status: string } | null
}

interface FormField {
  id: number
  fieldKey: string
  fieldLabel: string | null
  fieldType: string
  options: unknown
  required: boolean
  defaultValue: string | null
  displayOrder: number
}

interface Group {
  id: number
  name: string
  status: string
}

// ── Button / input helpers ──────────────────────────────────────

const btnPrimary =
  'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0'
const btnGhost =
  'bg-transparent text-[var(--text2)] border border-[var(--border)] px-4 py-2 rounded-lg text-sm font-medium cursor-pointer'
const btnSmall = 'text-[11px] px-2.5 py-1'

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border-[1.5px] border-[#e8edf5] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
const labelCls = 'block text-[13px] text-[var(--text2)] mb-1.5 font-medium'
const cardCls =
  'bg-white border border-[#e8edf5] rounded-xl p-5 shadow-[0_1px_4px_rgba(99,102,241,0.06)]'

// ── Helpers ─────────────────────────────────────────────────────

const SUBMISSION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待评审', color: '#d97706' },
  reviewed: { label: '已评审', color: '#16a34a' },
  needs_revision: { label: '需修改', color: '#e53e3e' },
}

const TYPE_LABEL_MAP: Record<string, string> = {
  text: '文本',
  textarea: '长文本',
  multi_select: '多选',
  multiselect: '多选',
}

// ── Main Component ──────────────────────────────────────────────

export default function AdminAssignmentsPage() {
  const [detailId, setDetailId] = useState<number | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [fieldConfigModal, setFieldConfigModal] = useState<number | null>(null)
  const [filterGroupId, setFilterGroupId] = useState<number | ''>('')
  const [toast, setToast] = useState('')
  const [expandedSubId, setExpandedSubId] = useState<number | null>(null)

  const groupIdParam = filterGroupId !== '' ? `&groupId=${filterGroupId}` : ''

  const { data: assignmentsData, loading, refetch } = useApi<{ list: Assignment[]; total: number }>(
    `/api/admin/assignments?pageSize=100${groupIdParam}`,
    [filterGroupId]
  )
  const assignments = assignmentsData?.list ?? []

  const { data: groupsData } = useApi<{ list: Group[] }>('/api/admin/groups?pageSize=100&status=active')
  const activeGroups = groupsData?.list ?? []

  const { data: submissions, loading: subsLoading } = useApi<{ list: Submission[] }>(
    detailId !== null ? `/api/admin/assignments/${detailId}/submissions?pageSize=100` : null
  )
  const submissionList = submissions?.list ?? []

  const { data: detailAssignment } = useApi<Assignment>(
    detailId !== null ? `/api/admin/assignments/${detailId}` : null
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const toastEl = toast ? (
    <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
      {toast}
    </div>
  ) : null

  // ── Detail view ─────────────────────────────────────────────
  if (detailId !== null) {
    if (!detailAssignment) {
      return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
    }

    const assignment = detailAssignment
    const totalMembers = assignment.totalMembers ?? 0
    const submittedCount = submissionList.length
    const submittedPct = totalMembers > 0 ? Math.round((submittedCount / totalMembers) * 100) : 0
    const pendingReview = submissionList.filter((s) => s.platformSong?.status === 'pending_review').length

    const subColumns: Column<Submission>[] = [
      {
        key: 'user',
        title: '提交者',
        render: (v) => {
          const u = v as { name: string; realName: string | null }
          return <span style={{ fontWeight: 600 }}>{u.realName || u.name}</span>
        },
      },
      {
        key: 'platformSong',
        title: '歌曲名',
        render: (v) => {
          const song = v as { title: string } | null
          return <span>{song?.title ?? '—'}</span>
        },
      },
      {
        key: 'platformSong',
        title: '创作工具',
        render: (v) => {
          const song = v as { aiTools: string | null } | null
          return <span>{song?.aiTools ?? '—'}</span>
        },
      },
      { key: 'submittedAt', title: '提交时间' },
      {
        key: 'platformSong',
        title: '状态',
        render: (v) => {
          const song = v as { status: string } | null
          const s = song ? SUBMISSION_STATUS_MAP[song.status] : null
          return s ? (
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 10,
                background: s.color + '18',
                color: s.color,
              }}
            >
              {s.label}
            </span>
          ) : (
            <span>—</span>
          )
        },
      },
      {
        key: 'platformSong',
        title: '评分',
        render: (v) => {
          const song = v as { score: number | null } | null
          if (!song?.score) return <span style={{ color: 'var(--text3)' }}>—</span>
          const score = song.score
          return (
            <span style={{ fontWeight: 600, color: score >= 80 ? '#16a34a' : '#f59e0b' }}>
              {score}
            </span>
          )
        },
      },
      {
        key: 'id',
        title: '操作',
        render: (v) => {
          const subId = v as number
          return (
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => {
                e.stopPropagation()
                setExpandedSubId(expandedSubId === subId ? null : subId)
              }}
            >
              {expandedSubId === subId ? '收起 ↑' : '查看 →'}
            </button>
          )
        },
      },
    ]

    return (
      <div>
        {toastEl}

        <PageHeader
          title={`作业 · ${assignment.title}`}
          actions={
            <button className={btnGhost} onClick={() => setDetailId(null)}>
              ← 返回列表
            </button>
          }
        />

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard
            icon="👥"
            label="总成员"
            val={totalMembers}
            color="#6c5ce7"
            iconBg="rgba(108,92,231,0.1)"
          />
          <StatCard
            icon="📤"
            label="已提交"
            val={submittedCount}
            sub={`${submittedPct}%`}
            subc="#16a34a"
            color="#16a34a"
            iconBg="rgba(22,163,74,0.1)"
          />
          <StatCard
            icon="⏳"
            label="待评审"
            val={pendingReview}
            color="#f59e0b"
            iconBg="rgba(245,158,11,0.1)"
          />
        </div>

        {/* Submission table */}
        <div className={cardCls} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📋 提交列表</h3>
          {subsLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
          ) : (
            <DataTable
              columns={subColumns as unknown as Column<Record<string, unknown>>[]}
              data={submissionList as unknown as Record<string, unknown>[]}
              rowKey={(r) => (r as unknown as Submission).id}
            />
          )}

          {/* Expanded submission detail */}
          {expandedSubId !== null && (() => {
            const sub = submissionList.find(s => s.id === expandedSubId)
            if (!sub) return null
            const song = sub.platformSong
            const statusMap: Record<string, { label: string; color: string }> = {
              pending_review: { label: '待评分', color: '#d97706' },
              needs_revision: { label: '需修改', color: '#e53e3e' },
              reviewed: { label: '已评分', color: '#6366f1' },
              archived: { label: '已归档', color: '#64748b' },
              ready_to_publish: { label: '待发行', color: '#0694a2' },
              published: { label: '已发行', color: '#16a34a' },
            }
            const st = song ? statusMap[song.status] : null
            return (
              <div style={{ margin: '12px 0', padding: 16, background: '#f8faff', borderRadius: 10, border: '1px solid #e8edf5' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>
                  📄 提交详情 — {sub.user.realName || sub.user.name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#64748b', minWidth: 70 }}>歌曲名：</span>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>{song?.title ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#64748b', minWidth: 70 }}>创作工具：</span>
                    <span style={{ color: '#1e293b' }}>{song?.aiTools ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#64748b', minWidth: 70 }}>提交时间：</span>
                    <span style={{ color: '#1e293b' }}>{sub.submittedAt}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#64748b', minWidth: 70 }}>评分：</span>
                    <span style={{ color: song?.score != null ? (song.score >= 80 ? '#16a34a' : '#f59e0b') : '#94a3b8', fontWeight: 600 }}>
                      {song?.score ?? '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#64748b', minWidth: 70 }}>状态：</span>
                    {st ? (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: st.color + '18', color: st.color }}>
                        {st.label}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Assignment info card */}
        <div className={cardCls}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📝 作业信息</h3>
          {(
            [
              ['作业标题', assignment.title],
              ['所属用户组', assignment.groupName],
              ['作业描述', assignment.description || '—'],
              ['截止时间', assignment.deadline],
              ['状态', assignment.status === 'active' ? '进行中' : '已截止'],
              ['创建时间', assignment.createdAt],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f0f4fb',
                borderRadius: 6,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text3)' }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── List view ───────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  const listColumns: Column<Assignment>[] = [
    {
      key: 'title',
      title: '作业标题',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    {
      key: 'groupName',
      title: '用户组',
      render: (v) => <span>{v as string}</span>,
    },
    { key: 'deadline', title: '截止时间' },
    {
      key: 'submissionCount',
      title: '提交进度',
      render: (v, row) => {
        const a = row as unknown as Assignment
        const subs = (v as number) ?? 0
        const total = a.totalMembers ?? 0
        const pct = total > 0 ? Math.round((subs / total) * 100) : 0
        return (
          <span>
            {subs}/{total} ({pct}%)
          </span>
        )
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (v) =>
        v === 'active' ? (
          <span
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'rgba(22,163,74,0.1)',
              color: '#16a34a',
            }}
          >
            进行中
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'rgba(100,116,139,0.1)',
              color: '#64748b',
            }}
          >
            已截止
          </span>
        ),
    },
    {
      key: 'id',
      title: '操作',
      render: (v) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={(e) => {
              e.stopPropagation()
              setFieldConfigModal(v as number)
            }}
          >
            ⚙️ 表单
          </button>
          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={(e) => {
              e.stopPropagation()
              setDetailId(v as number)
            }}
          >
            详情 →
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {toastEl}

      <PageHeader
        title="作业管理"
        subtitle={`共 ${assignmentsData?.total ?? 0} 个作业`}
        actions={
          <button className={btnPrimary} onClick={() => setCreateModal(true)}>
            + 创建作业
          </button>
        }
      />

      {/* Filter bar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>用户组筛选：</label>
        <select
          className={inputCls}
          style={{ width: 240 }}
          value={filterGroupId}
          onChange={(e) => setFilterGroupId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">全部用户组</option>
          {activeGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {/* DataTable card */}
      <div className={cardCls}>
        <DataTable
          columns={listColumns as unknown as Column<Record<string, unknown>>[]}
          data={assignments as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as Assignment).id}
          onRowClick={(row) => setDetailId((row as unknown as Assignment).id)}
        />
      </div>

      {/* 创建作业 Modal */}
      <AdminModal open={createModal} onClose={() => setCreateModal(false)} title="创建作业">
        <CreateAssignmentForm
          groups={activeGroups}
          onSubmit={async (data) => {
            const res = await apiCall('/api/admin/assignments', 'POST', data)
            if (res.ok) {
              setCreateModal(false)
              showToast('作业创建成功')
              refetch()
            } else {
              showToast(res.message || '创建失败')
            }
          }}
        />
      </AdminModal>

      {/* 表单字段配置 Modal */}
      <AdminModal
        open={fieldConfigModal !== null}
        onClose={() => setFieldConfigModal(null)}
        title="表单字段配置"
        width={680}
      >
        {fieldConfigModal !== null && (
          <FieldConfigPanel
            assignmentId={fieldConfigModal}
            onSave={() => {
              setFieldConfigModal(null)
              showToast('表单配置已保存')
            }}
            onReset={() => showToast('已重置为默认模板')}
            showToast={showToast}
          />
        )}
      </AdminModal>
    </div>
  )
}

// ── Create Assignment Form ──────────────────────────────────────

function CreateAssignmentForm({ groups, onSubmit }: { groups: Group[]; onSubmit: (data: { groupId: number; title: string; description?: string; deadline: string }) => void }) {
  const [groupId, setGroupId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className={labelCls}>所属用户组 *</label>
        <select className={inputCls} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">请选择用户组</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>作业标题 *</label>
        <input className={inputCls} placeholder="如：第一次AI音乐创作实践" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>作业描述</label>
        <textarea
          className={inputCls}
          style={{ height: 80, resize: 'vertical' }}
          placeholder="描述作业要求和目标"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls}>截止时间</label>
        <input className={inputCls} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <button
        className="bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0 w-full flex justify-center"
        onClick={() => onSubmit({ groupId: Number(groupId), title, description: description || undefined, deadline })}
      >
        创建作业
      </button>
    </div>
  )
}

// ── Field Config Panel ──────────────────────────────────────────

function FieldConfigPanel({
  assignmentId,
  onSave,
  onReset,
  showToast,
}: {
  assignmentId: number
  onSave: () => void
  onReset: () => void
  showToast: (msg: string) => void
}) {
  const { data: fieldsData, loading } = useApi<FormField[]>(
    `/api/admin/assignments/${assignmentId}/fields`
  )

  const [fields, setFields] = useState<FormField[] | null>(null)

  // Initialize fields from API data
  const currentFields = fields ?? fieldsData ?? []

  function toggleRequired(idx: number) {
    const next = [...currentFields]
    next[idx] = { ...next[idx], required: !next[idx].required }
    setFields(next)
  }

  function updateDefault(idx: number, val: string) {
    const next = [...currentFields]
    next[idx] = { ...next[idx], defaultValue: val }
    setFields(next)
  }

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  return (
    <div>
      <div
        style={{
          padding: '8px 12px',
          marginBottom: 12,
          background: 'rgba(108,92,231,.08)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--accent2)',
          lineHeight: 1.6,
        }}
      >
        支持变量：{'{realName}'} = 学生真实姓名，{'{songTitle}'} = 歌曲标题
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 70px 60px 1fr',
            gap: 12,
            padding: '8px 0',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--text3)',
            fontWeight: 500,
          }}
        >
          <span>字段名</span>
          <span>类型</span>
          <span>必填</span>
          <span>默认值</span>
        </div>

        {/* Rows */}
        {currentFields.map((field, idx) => (
          <div
            key={field.fieldKey || idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 70px 60px 1fr',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 500 }}>{field.fieldLabel || field.fieldKey}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {TYPE_LABEL_MAP[field.fieldType] ?? field.fieldType}
            </span>
            <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={field.required}
                onChange={() => toggleRequired(idx)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  background: field.required ? '#6366f1' : '#ccc',
                  transition: 'background 0.2s',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: field.required ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </label>
            <input
              className={inputCls}
              style={{ padding: '4px 8px', fontSize: 12 }}
              value={field.defaultValue || ''}
              onChange={(e) => updateDefault(idx, e.target.value)}
              placeholder="留空或输入变量"
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button
          className={btnGhost}
          onClick={() => {
            setFields(null)
            onReset()
          }}
        >
          重置为默认模板
        </button>
        <button
          className={btnPrimary}
          onClick={async () => {
            const res = await apiCall(`/api/admin/assignments/${assignmentId}/fields`, 'PUT', {
              fields: currentFields.map((f, i) => ({
                fieldKey: f.fieldKey,
                fieldLabel: f.fieldLabel,
                fieldType: f.fieldType,
                options: f.options,
                required: f.required,
                defaultValue: f.defaultValue,
                displayOrder: i,
              })),
            })
            if (res.ok) {
              onSave()
            } else {
              showToast(res.message || '保存失败')
            }
          }}
        >
          保存配置
        </button>
      </div>
    </div>
  )
}
