'use client'

import { useState } from 'react'
import { CheckCircle2, Pause, Pencil, Clipboard, Users } from 'lucide-react'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { DataTable, Column } from '@/components/ui/data-table'
import { AdminModal } from '@/components/ui/modal'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost, btnDanger, btnSuccess, btnSmall, inputCls, labelCls } from '@/lib/ui-tokens'
import { STAT_COLORS } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'

// ── Types ────────────────────────────────────────────────────────

interface Group {
  id: number
  name: string
  description: string | null
  inviteCode: string
  inviteLink: string
  memberCount: number
  status: 'active' | 'paused'
  createdAt: string
}

interface GroupDetail extends Group {
  members: GroupMember[]
}

interface GroupMember {
  id: number
  name: string
  phone: string
  avatarUrl: string | null
  realNameStatus: string
  status: string
  joinedAt: string
}

// ── Main component ───────────────────────────────────────────────

export default function AdminGroupsPage() {
  const confirm = useConfirm()
  const [detail, setDetail] = useState<number | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [inviteModal, setInviteModal] = useState<Group | null>(null)
  const [toast, setToast] = useState('')

  const { data: groupsData, loading, refetch } = useApi<{ list: Group[]; total: number }>('/api/admin/groups?pageSize=100')
  const groups = groupsData?.list ?? []

  const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useApi<GroupDetail>(
    detail !== null ? `/api/admin/groups/${detail}` : null
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Detail view ──────────────────────────────────────────────
  if (detail !== null) {
    if (detailLoading) {
      return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
    }

    if (!detailData) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          用户组不存在
          <br />
          <button className={btnGhost} style={{ marginTop: 12 }} onClick={() => setDetail(null)}>
            ← 返回列表
          </button>
        </div>
      )
    }

    const g = detailData
    const members = g.members ?? []

    const memberColumns: Column<GroupMember>[] = [
      {
        key: 'avatarUrl',
        title: '',
        render: (v) => <span style={{ fontSize: 18 }}>{(v as string) || <Users className="w-4 h-4 text-[var(--text3)]" />}</span>,
      },
      {
        key: 'name',
        title: '姓名',
        render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
      },
      {
        key: 'realNameStatus',
        title: '实名',
        render: (v) => {
          const m: Record<string, { l: string; c: string }> = {
            verified: { l: '已认证', c: 'var(--green2)' },
            pending: { l: '待审核', c: 'var(--orange)' },
            rejected: { l: '已驳回', c: 'var(--red)' },
          }
          const s = m[v as string]
          return s ? (
            <span style={{ fontSize: 12, color: s.c }}>{s.l}</span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>未认证</span>
          )
        },
      },
      { key: 'phone', title: '手机号' },
      {
        key: 'id',
        title: '操作',
        render: (_v, row) => {
          const r = row as GroupMember
          return (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`${btnDanger} ${btnSmall}`}
                onClick={async (e) => {
                  e.stopPropagation()
                  if (await confirm({ message: `确认将「${r.name}」移出该组？`, danger: true })) {
                    const res = await apiCall(`/api/admin/groups/${detail}/members`, 'DELETE', { userId: r.id })
                    if (res.ok) {
                      showToast(`已将 ${r.name} 移出该组`)
                      refetchDetail()
                    } else {
                      showToast(res.message || '操作失败')
                    }
                  }
                }}
              >
                移出
              </button>
            </div>
          )
        },
      },
    ]

    return (
      <div className={pageWrap}>
        {/* Toast */}
        {toast && (
          <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
            {toast}
          </div>
        )}

        <PageHeader
          title={`用户组 · ${g.name}`}
          actions={
            <button className={btnGhost} onClick={() => setDetail(null)}>
              ← 返回列表
            </button>
          }
        />

        {/* 2-column info grid */}
        <div className="grid grid-cols-2 gap-5">
          {/* 组信息 */}
          <div className={cardCls}>
            <h3 className="text-base font-semibold mb-4">组信息</h3>
            {(
              [
                ['组名', g.name],
                ['描述', g.description || '—'],
                ['状态', g.status === 'active' ? '启用' : '暂停'],
                ['创建时间', formatDateTime(g.createdAt)],
                ['成员数', `${g.memberCount} 人`],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg4)',
                  borderRadius: 6,
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--text3)' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                className={btnGhost}
                onClick={async () => {
                  const newName = window.prompt('修改组名', g.name)
                  if (!newName || newName.trim() === g.name) return
                  const newDesc = window.prompt('修改组描述（留空保持不变）', g.description ?? '') ?? undefined
                  const res = await apiCall(`/api/admin/groups/${g.id}`, 'PUT', {
                    name: newName.trim(),
                    ...(newDesc !== undefined ? { description: newDesc } : {}),
                  })
                  if (res.ok) {
                    showToast('组信息已更新')
                    refetchDetail()
                    refetch()
                  } else {
                    showToast(res.message || '更新失败')
                  }
                }}
              >
                <Pencil className="inline w-3.5 h-3.5 mr-1" />编辑
              </button>
              <button
                className={g.status === 'active' ? `${btnDanger} ${btnSmall}` : `${btnSuccess} ${btnSmall}`}
                onClick={async () => {
                  const newStatus = g.status === 'active' ? 'paused' : 'active'
                  const res = await apiCall(`/api/admin/groups/${g.id}`, 'PUT', { status: newStatus })
                  if (res.ok) {
                    showToast(g.status === 'active' ? '已暂停该用户组' : '已启用该用户组')
                    refetchDetail()
                    refetch()
                  } else {
                    showToast(res.message || '操作失败')
                  }
                }}
              >
                {g.status === 'active' ? '暂停' : '启用'}
              </button>
            </div>
          </div>

          {/* 专属邀请 */}
          <div className={cardCls}>
            <h3 className="text-base font-semibold mb-4">专属邀请</h3>
            <div style={{ marginBottom: 12 }}>
              <label className={labelCls}>邀请码</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className={inputCls}
                  style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 3, textAlign: 'center' }}
                  readOnly
                  value={g.inviteCode}
                />
                <button
                  className={btnGhost}
                  onClick={() => {
                    navigator.clipboard?.writeText(g.inviteCode)
                    showToast('邀请码已复制到剪贴板')
                  }}
                >
                  复制
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className={labelCls}>注册链接</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className={inputCls} readOnly value={g.inviteLink} />
                <button
                  className={btnGhost}
                  onClick={() => {
                    navigator.clipboard?.writeText(g.inviteLink)
                    showToast('注册链接已复制到剪贴板')
                  }}
                >
                  复制
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className={`${btnGhost} ${btnSmall}`}
                onClick={async () => {
                  if (!(await confirm({ message: '重新生成后原邀请码/链接将立即失效，确定继续？', danger: true }))) return
                  const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()
                  const res = await apiCall(`/api/admin/groups/${g.id}`, 'PUT', { inviteCode: newCode })
                  if (res.ok) {
                    showToast('已重新生成邀请码和链接')
                    refetchDetail()
                  } else {
                    showToast(res.message || '生成失败')
                  }
                }}
              >
                🔄 重新生成邀请码
              </button>
            </div>
          </div>
        </div>

        {/* 组成员 */}
        <div className={cardCls}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold">组成员（{members.length}人）</h3>
            <button
              className={btnGhost}
              onClick={() => {
                navigator.clipboard?.writeText(g.inviteLink)
                showToast('邀请链接已复制，可转发给新成员')
              }}
            >
              + 邀请成员
            </button>
          </div>
          {members.length > 0 ? (
            <DataTable
              columns={memberColumns}
              data={members}
              rowKey={(r) => r.id}
            />
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              📭 该组暂无成员
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  const activeCount = groups.filter((g) => g.status === 'active').length
  const pausedCount = groups.filter((g) => g.status === 'paused').length

  const listColumns: Column<Group>[] = [
    {
      key: 'name',
      title: '组名',
      render: (v, row) => (
        <div>
          <span style={{ fontWeight: 600 }}>{v as string}</span>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {(row as Group).description}
          </div>
        </div>
      ),
    },
    {
      key: 'inviteCode',
      title: '邀请码',
      render: (v) => (
        <span className="font-mono font-semibold text-[var(--accent2)] bg-[rgba(108,92,231,0.1)] px-2 py-0.5 rounded">
          {v as string}
        </span>
      ),
    },
    { key: 'memberCount', title: '成员数' },
    {
      key: 'status',
      title: '状态',
      render: (v) =>
        v === 'active' ? (
          <span style={{ color: 'var(--green2)', fontSize: 12 }}><CheckCircle2 className="inline w-3 h-3 mr-0.5" />活跃</span>
        ) : (
          <span style={{ color: 'var(--orange)', fontSize: 12 }}><Pause className="inline w-3 h-3 mr-0.5" />暂停</span>
        ),
    },
    { key: 'createdAt', title: '创建时间', render: (v) => formatDateTime(v as string) },
    {
      key: 'id',
      title: '操作',
      render: (v, row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={(e) => {
              e.stopPropagation()
              setInviteModal(row as Group)
            }}
          >
            邀请码
          </button>
          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={(e) => {
              e.stopPropagation()
              setDetail(v as number)
            }}
          >
            详情 →
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="用户组管理"
        subtitle={`共 ${groups.length} 个用户组 · 系统管理员可创建和管理`}
        actions={
          <button className={btnPrimary} onClick={() => setCreateModal(true)}>
            + 创建用户组
          </button>
        }
      />

      {/* StatCards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Users size={18} />}
          label="总用户组"
          val={groups.length}
          color={STAT_COLORS.purple}
          iconBg="rgba(99,102,241,0.1)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="活跃组"
          val={activeCount}
          color={STAT_COLORS.green}
          iconBg="rgba(22,163,74,0.1)"
        />
        <StatCard
          icon={<Pause size={18} />}
          label="暂停组"
          val={pausedCount}
          color={STAT_COLORS.amber}
          iconBg="rgba(245,158,11,0.1)"
        />
      </div>

      {/* DataTable card */}
      <div className={cardCls}>
        <DataTable
          columns={listColumns}
          data={groups}
          rowKey={(r) => r.id}
          onRowClick={(row) => setDetail((row as unknown as Group).id)}
        />
      </div>

      {/* 创建用户组 Modal */}
      <AdminModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="创建用户组"
      >
        <CreateGroupForm
          onSubmit={async (data) => {
            const res = await apiCall('/api/admin/groups', 'POST', data)
            if (res.ok) {
              setCreateModal(false)
              showToast('用户组创建成功！邀请码已自动生成')
              refetch()
            } else {
              showToast(res.message || '创建失败')
            }
          }}
        />
      </AdminModal>

      {/* 邀请码 Modal */}
      <AdminModal
        open={!!inviteModal}
        onClose={() => setInviteModal(null)}
        title={`邀请码 · ${inviteModal?.name ?? ''}`}
      >
        {inviteModal && (
          <InviteCodePanel
            group={inviteModal}
            onClose={() => setInviteModal(null)}
            showToast={showToast}
          />
        )}
      </AdminModal>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function CreateGroupForm({ onSubmit }: { onSubmit: (data: { name: string; description?: string; inviteCode?: string }) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className={labelCls}>组名 *</label>
        <input className={inputCls} placeholder="如：2026秋季创作班" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>描述</label>
        <textarea
          className={inputCls}
          style={{ height: 60, resize: 'vertical' }}
          placeholder="简单描述该用户组的用途"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls}>自定义邀请码（留空自动生成）</label>
        <input className={inputCls} placeholder="如：FALL2026（仅英文数字）" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
      </div>
      <div
        style={{
          padding: 12,
          background: 'rgba(108,92,231,.08)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--accent2)',
          lineHeight: 1.6,
        }}
      >
        创建后系统将自动生成专属邀请码和注册链接。持有邀请码的用户可通过注册页面加入该组。
        <br />
        系统暂不开放公开注册，所有用户必须通过邀请码注册。
      </div>
      <button
        className={`${btnPrimary} w-full flex justify-center`}
        onClick={() => onSubmit({ name, description: description || undefined, inviteCode: inviteCode || undefined })}
      >
        创建用户组
      </button>
    </div>
  )
}

function InviteCodePanel({
  group,
  onClose,
  showToast,
}: {
  group: Group
  onClose: () => void
  showToast: (msg: string) => void
}) {
  const confirm = useConfirm()
  const [code, setCode] = useState(group.inviteCode)
  const [status, setStatus] = useState<'active' | 'paused'>(group.status)
  const [link, setLink] = useState(group.inviteLink)

  async function regenerate() {
    if (!(await confirm({ message: '重新生成后原邀请码将立即失效，确定继续？', danger: true }))) return
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()
    const res = await apiCall(`/api/admin/groups/${group.id}`, 'PUT', { inviteCode: newCode })
    if (res.ok) {
      setCode(newCode)
      setLink((res.data as { inviteLink?: string })?.inviteLink ?? link)
      showToast('已重新生成邀请码')
    } else {
      showToast(res.message || '生成失败')
    }
  }

  async function toggleStatus() {
    const newStatus: 'active' | 'paused' = status === 'active' ? 'paused' : 'active'
    const res = await apiCall(`/api/admin/groups/${group.id}`, 'PUT', { status: newStatus })
    if (res.ok) {
      setStatus(newStatus)
      showToast(newStatus === 'paused' ? '已停用邀请码' : '已启用邀请码')
      onClose()
    } else {
      showToast(res.message || '操作失败')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Large code display */}
      <div
        style={{
          textAlign: 'center',
          padding: 24,
          background: 'var(--bg4)',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>邀请码</div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: 4,
            color: 'var(--accent2)',
          }}
        >
          {code}
        </div>
      </div>

      {/* Registration link */}
      <div>
        <label className={labelCls}>注册链接</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className={inputCls} readOnly value={link} />
          <button
            className={btnGhost}
            onClick={() => {
              navigator.clipboard?.writeText(link)
              showToast('已复制')
            }}
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={btnGhost}
          style={{ flex: 1, justifyContent: 'center', display: 'flex' }}
          onClick={regenerate}
        >
          🔄 重新生成
        </button>
        <button
          className={status === 'active' ? btnDanger : btnSuccess}
          style={{ flex: 1, justifyContent: 'center', display: 'flex' }}
          onClick={toggleStatus}
        >
          {status === 'active' ? '停用邀请码' : '启用邀请码'}
        </button>
      </div>
    </div>
  )
}
