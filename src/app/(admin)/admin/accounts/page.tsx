'use client'

import { useState } from 'react'
import { Shield, CheckCircle2, Ban, Settings, AlertTriangle, Clipboard, Check, Users, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { AdminTab } from '@/components/ui/unified-tabs'
import { DataTable, Column } from '@/components/ui/data-table'
import { AdminModal } from '@/components/ui/modal'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost, btnSmall, inputCls, labelCls, infoBoxPurple, infoBoxRed } from '@/lib/ui-tokens'

// ── Button / input helpers ───────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
interface ReviewerAccount {
  id: number
  name: string
  email: string
  phone: string
  role: 'reviewer'
  adminLevel: 'group_admin' | 'system_admin' | null
  groupIds: number[]
  groupNames?: string[]
  status: 'active' | 'disabled'
  lastLogin: string
}

interface CreatorAccount {
  id: number
  name: string
  avatar: string | null
  phone: string
  role: string
  adminLevel: 'group_admin' | 'system_admin' | null
  groupIds: number[]
  realNameStatus: string
  songCount: number
}

interface UserGroup {
  id: number
  name: string
}

interface AccountsApiItem {
  id: number
  name: string
  realName: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  type: string
  adminLevel: string | null
  realNameStatus: string | null
  status: string
  lastLoginAt: string | null
  createdAt: string
  groups: { id: number; name: string }[]
}

interface AccountsApiData {
  list: AccountsApiItem[]
  total: number
}

// ── Main component ───────────────────────────────────────────────
export default function AdminAccountsPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const [tab, setTab] = useState('reviewer')
  const [toast, setToast] = useState('')
  const [createReviewerModal, setCreateReviewerModal] = useState(false)
  const [createCreatorModal, setCreateCreatorModal] = useState(false)
  const [permModal, setPermModal] = useState<ReviewerAccount | CreatorAccount | null>(null)
  const [resetPwd, setResetPwd] = useState<{ name: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data, loading, refetch } = useApi<AccountsApiData>(
    `/api/admin/accounts?tab=${tab}`,
    [tab],
  )

  const apiList = data?.list ?? []

  const reviewers: ReviewerAccount[] = apiList
    .filter((u) => u.type === 'reviewer')
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.realName ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
      role: 'reviewer' as const,
      adminLevel: u.adminLevel as ReviewerAccount['adminLevel'],
      groupIds: u.groups.map((g) => g.id),
      groupNames: u.groups.map((g) => g.name),
      status: (u.status === 'active' ? 'active' : 'disabled') as 'active' | 'disabled',
      lastLogin: u.lastLoginAt ?? '-',
    }))

  const creators: CreatorAccount[] = apiList
    .filter((u) => u.type === 'creator')
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.realName ?? '',
      avatar: u.avatarUrl ?? null,
      phone: u.phone ?? '',
      role: 'creator',
      adminLevel: u.adminLevel as CreatorAccount['adminLevel'],
      groupIds: u.groups.map((g) => g.id),
      realNameStatus: u.realNameStatus ?? 'none',
      songCount: 0,
    }))

  const groups: UserGroup[] = Array.from(
    new Map(apiList.flatMap((u) => u.groups).map((g) => [g.id, g])).values()
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Tab config ──────────────────────────────────────────────
  const tabs = [
    { key: 'reviewer', label: '评审账号', count: reviewers.length },
    { key: 'creator', label: '创作者账号管控', count: creators.length },
  ]

  // ── Reviewer columns ───────────────────────────────────────
  const reviewerColumns: Column<ReviewerAccount>[] = [
    {
      key: 'name',
      title: '姓名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    { key: 'email', title: '邮箱' },
    { key: 'phone', title: '手机号' },
    {
      key: 'role',
      title: '用户属性',
      render: (_v, row) => {
        const r = row as ReviewerAccount
        const parts: React.ReactNode[] = ['评审']
        if (r.adminLevel === 'group_admin') parts.push('🔰 组管理员')
        if (r.adminLevel === 'system_admin') parts.push(<><Shield className="inline w-3 h-3 mr-0.5" />系统管理员</>)
        return (
          <span style={{ fontSize: 12, color: 'var(--accent2)' }}>
            {parts.map((p, i) => <span key={i}>{i > 0 ? ' · ' : ''}{p}</span>)}
          </span>
        )
      },
    },
    {
      key: 'groupNames',
      title: '用户组',
      render: (v) => {
        const names = v as string[] | undefined
        return (
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>
            {names?.join(', ') || '—'}
          </span>
        )
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (v) =>
        v === 'active' ? (
          <span style={{ color: 'var(--green2)', fontSize: 12 }}><CheckCircle2 className="inline w-3 h-3 mr-0.5" />启用</span>
        ) : (
          <span style={{ color: 'var(--red)', fontSize: 12 }}><Ban className="inline w-3 h-3 mr-0.5" />已禁用</span>
        ),
    },
    { key: 'lastLogin', title: '最后登录' },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => {
        const r = row as ReviewerAccount
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => {
                e.stopPropagation()
                setPermModal(r)
              }}
            >
              权限
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={async (e) => {
                e.stopPropagation()
                const res = await apiCall<{ password?: string; generated?: boolean }>(`/api/admin/accounts/${r.id}/reset-password`, 'POST', {})
                if (res.ok) {
                  if (res.data?.password) {
                    setCopied(false)
                    setResetPwd({ name: r.name, password: res.data.password })
                  } else {
                    showToast(`已重置 ${r.name} 的密码`)
                  }
                  refetch()
                } else showToast(res.message ?? '重置失败')
              }}
            >
              重置密码
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              style={
                r.status === 'active'
                  ? { color: 'var(--red)', borderColor: 'var(--red)' }
                  : { color: 'var(--green2)', borderColor: 'var(--green2)' }
              }
              onClick={async (e) => {
                e.stopPropagation()
                if (await confirm({ message: `确认${r.status === 'active' ? '禁用' : '启用'}「${r.name}」？`, danger: true })) {
                  const res = await apiCall(`/api/admin/accounts/${r.id}/toggle-status`, 'POST')
                  if (res.ok) { showToast(`已${r.status === 'active' ? '禁用' : '启用'} ${r.name}`); refetch() }
                  else showToast(res.message ?? '操作失败')
                }
              }}
            >
              {r.status === 'active' ? '禁用' : '启用'}
            </button>
          </div>
        )
      },
    },
  ]

  // ── Creator columns ────────────────────────────────────────
  const creatorColumns: Column<CreatorAccount>[] = [
    {
      key: 'avatar',
      title: '',
      render: (v) => v ? <img src={v as string} alt="" className="w-5 h-5 rounded-full object-cover" /> : <User className="w-5 h-5 text-[var(--text3)]" />,
    },
    {
      key: 'name',
      title: '姓名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    { key: 'phone', title: '手机号' },
    {
      key: 'role',
      title: '属性',
      render: (_v, row) => {
        const r = row as CreatorAccount
        const parts: React.ReactNode[] = ['创作者']
        if (r.adminLevel === 'group_admin') parts.push('🔰 组管理员')
        if (r.adminLevel === 'system_admin') parts.push(<><Shield className="inline w-3 h-3 mr-0.5" />系统管理员</>)
        return (
          <span style={{ fontSize: 12, color: 'var(--accent2)' }}>
            {parts.map((p, i) => <span key={i}>{i > 0 ? ' · ' : ''}{p}</span>)}
          </span>
        )
      },
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
    { key: 'songCount', title: '作品数' },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => {
        const r = row as CreatorAccount
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => {
                e.stopPropagation()
                setPermModal(r)
              }}
            >
              权限
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={async (e) => {
                e.stopPropagation()
                const res = await apiCall<{ password?: string; generated?: boolean }>(`/api/admin/accounts/${r.id}/reset-password`, 'POST', {})
                if (res.ok) {
                  if (res.data?.password) {
                    setCopied(false)
                    setResetPwd({ name: r.name, password: res.data.password })
                  } else {
                    showToast(`已重置 ${r.name} 的密码`)
                  }
                  refetch()
                } else showToast(res.message ?? '重置失败')
              }}
            >
              重置密码
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
              onClick={async (e) => {
                e.stopPropagation()
                if (await confirm({ message: `确认禁用「${r.name}」？`, danger: true })) {
                  const res = await apiCall(`/api/admin/accounts/${r.id}/toggle-status`, 'POST')
                  if (res.ok) { showToast(`已禁用 ${r.name}`); refetch() }
                  else showToast(res.message ?? '操作失败')
                }
              }}
            >
              禁用
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
        title="账号与角色管理"
        subtitle={loading ? '加载中...' : '管理各类用户的账号权限与状态'}
        actions={
          <div className="flex items-center gap-2">
            {tab === 'reviewer' && (
              <button className={btnPrimary} onClick={() => setCreateReviewerModal(true)}>
                + 创建评审账号
              </button>
            )}
            {tab === 'creator' && (
              <button className={btnPrimary} onClick={() => setCreateCreatorModal(true)}>
                + 创建创作者账号
              </button>
            )}
            <button
              className={btnGhost}
              onClick={() => router.push('/admin/admins')}
            >
              <Settings className="inline w-3.5 h-3.5 mr-1" />平台管理员 →
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div>
        <AdminTab tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* Table card */}
      <div className={cardCls}>
        {tab === 'reviewer' ? (
          <DataTable
            columns={reviewerColumns}
            data={reviewers}
            rowKey={(r) => r.id}
          />
        ) : (
          <DataTable
            columns={creatorColumns}
            data={creators}
            rowKey={(r) => r.id}
          />
        )}
      </div>

      {/* 创建评审账号 Modal */}
      <AdminModal
        open={createReviewerModal}
        onClose={() => setCreateReviewerModal(false)}
        title="创建评审账号"
      >
        <CreateReviewerForm
          groups={groups}
          onSubmit={async (body) => {
            const res = await apiCall('/api/admin/accounts/create-reviewer', 'POST', body)
            if (res.ok) {
              setCreateReviewerModal(false)
              showToast('评审账号创建成功')
              refetch()
            } else {
              showToast(res.message ?? '创建失败')
            }
          }}
        />
      </AdminModal>

      {/* 创建创作者账号 Modal */}
      <AdminModal
        open={createCreatorModal}
        onClose={() => setCreateCreatorModal(false)}
        title="创建创作者账号"
      >
        <CreateCreatorForm
          groups={groups}
          onSubmit={async (body) => {
            const res = await apiCall('/api/admin/accounts/create-creator', 'POST', body)
            if (res.ok) {
              setCreateCreatorModal(false)
              showToast('创作者账号创建成功')
              refetch()
            } else {
              showToast(res.message ?? '创建失败')
            }
          }}
        />
      </AdminModal>

      {/* 变更权限 Modal */}
      <AdminModal
        open={!!permModal}
        onClose={() => setPermModal(null)}
        title={`变更权限 · ${permModal?.name ?? ''}`}
      >
        {permModal && (
          <PermissionForm
            user={permModal}
            groups={groups}
            onSubmit={async (body) => {
              const res = await apiCall(`/api/admin/accounts/${permModal.id}/permissions`, 'PUT', body)
              if (res.ok) {
                setPermModal(null)
                showToast('权限已变更')
                refetch()
              } else {
                showToast(res.message ?? '变更失败')
              }
            }}
          />
        )}
      </AdminModal>

      {/* 重置密码明文弹框 */}
      <AdminModal
        open={!!resetPwd}
        onClose={() => setResetPwd(null)}
        title={`新密码已生成 · ${resetPwd?.name ?? ''}`}
        disableBackdropClose
      >
        {resetPwd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="p-3 rounded-md text-[13px] bg-[rgba(255,107,107,.08)] border border-[rgba(255,107,107,.15)] text-[var(--red)]" style={{ lineHeight: 1.6 }}>
              <AlertTriangle className="inline w-3.5 h-3.5 mr-1" />此密码仅显示一次，请立即复制并通过安全渠道发送给用户。关闭弹窗后无法再查看。
            </div>
            <div>
              <label className={labelCls}>新密码</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className={inputCls}
                  value={resetPwd.password}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  className={btnPrimary}
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(resetPwd.password)
                      setCopied(true)
                    } catch {
                      setCopied(false)
                      showToast('复制失败，请手动选中复制')
                    }
                  }}
                >
                  {copied ? <><CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />已复制</> : <><Clipboard className="inline w-3.5 h-3.5 mr-1" />点击复制</>}
                </button>
              </div>
            </div>
            <button
              className={`${btnGhost} w-full flex justify-center`}
              onClick={() => setResetPwd(null)}
            >
              我已复制，关闭
            </button>
          </div>
        )}
      </AdminModal>
    </div>
  )
}

// ── Create Reviewer Form ─────────────────────────────────────────
function CreateReviewerForm({ groups, onSubmit }: { groups: UserGroup[]; onSubmit: (body: Record<string, unknown>) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [groupId, setGroupId] = useState('')
  const [password, setPassword] = useState('Abc12345')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className={labelCls}>姓名 *</label>
        <input className={inputCls} placeholder="评审用户姓名" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>手机号 *</label>
        <input className={inputCls} placeholder="11位手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>邮箱 *</label>
        <input className={inputCls} placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>加入用户组</label>
        <select
          className={inputCls}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">请选择用户组</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>初始密码</label>
        <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className={infoBoxPurple} style={{ fontSize: 12, color: 'var(--accent2)', lineHeight: 1.6 }}>
        创建后评审用户即可使用手机号/邮箱 + 密码登录评审端。
      </div>
      <button
        className={`${btnPrimary} w-full flex justify-center`}
        onClick={() => onSubmit({ name, phone, email, groupId: groupId ? Number(groupId) : null, password })}
      >
        创建评审账号
      </button>
    </div>
  )
}

// ── Create Creator Form ─────────────────────────────────────────
function CreateCreatorForm({ groups, onSubmit }: { groups: UserGroup[]; onSubmit: (body: Record<string, unknown>) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [groupId, setGroupId] = useState('')
  const [password, setPassword] = useState('Abc12345')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className={labelCls}>姓名 *</label>
        <input className={inputCls} placeholder="创作者姓名" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>手机号 *</label>
        <input className={inputCls} placeholder="11位手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>邮箱</label>
        <input className={inputCls} placeholder="user@example.com（可选）" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>加入用户组</label>
        <select
          className={inputCls}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">请选择用户组（可选）</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>初始密码</label>
        <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className={infoBoxPurple} style={{ fontSize: 12, color: 'var(--accent2)', lineHeight: 1.6 }}>
        创建后创作者即可使用手机号 + 密码登录创作者端，无需走短信注册。
      </div>
      <button
        className={`${btnPrimary} w-full flex justify-center`}
        onClick={() => onSubmit({ name, phone, email: email || undefined, groupId: groupId ? Number(groupId) : null, password })}
      >
        创建创作者账号
      </button>
    </div>
  )
}

// ── Permission Form ──────────────────────────────────────────────
function PermissionForm({
  user,
  groups,
  onSubmit,
}: {
  user: ReviewerAccount | CreatorAccount
  groups: UserGroup[]
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const isReviewer = 'lastLogin' in user
  const currentRole = isReviewer ? '评审' : '创作者'

  const [roleAttr, setRoleAttr] = useState(currentRole)
  const [adminPerm, setAdminPerm] = useState(
    user.adminLevel === 'group_admin'
      ? '组管理员'
      : user.adminLevel === 'system_admin'
        ? '系统管理员'
        : '无特殊权限'
  )

  const currentGroupIds = new Set(user.groupIds)
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(currentGroupIds)

  function toggleGroup(id: number) {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resolveAdminLevel(): string | null {
    if (adminPerm === '组管理员') return 'group_admin'
    if (adminPerm === '系统管理员') return 'system_admin'
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current role (readonly) */}
      <div>
        <label className={labelCls}>当前角色</label>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 10,
            background: 'rgba(108,92,231,.1)',
            color: 'var(--accent2)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {currentRole}
        </div>
      </div>

      {/* User attribute dropdown */}
      <div>
        <label className={labelCls}>用户属性</label>
        <select
          className={inputCls}
          value={roleAttr}
          onChange={(e) => setRoleAttr(e.target.value)}
        >
          <option value="创作者">创作者</option>
          <option value="评审">评审</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          如需创建平台管理员，请使用「平台管理员」菜单新增
        </div>
      </div>

      {/* Admin permission dropdown */}
      <div>
        <label className={labelCls}>管理权限</label>
        <select
          className={inputCls}
          value={adminPerm}
          onChange={(e) => setAdminPerm(e.target.value)}
        >
          <option value="无特殊权限">无特殊权限</option>
          <option value="组管理员">组管理员</option>
          <option value="系统管理员">系统管理员</option>
        </select>
      </div>

      {/* Group membership tags */}
      <div>
        <label className={labelCls}>所属用户组</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {groups.map((g) => {
            const active = selectedGroups.has(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  background: active ? 'rgba(99,102,241,.1)' : 'var(--bg3)',
                  color: active ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {active ? <Check className="inline w-3 h-3 mr-0.5" /> : ''}{g.name}
              </button>
            )
          })}
        </div>
      </div>

      <button
        className={`${btnPrimary} w-full flex justify-center`}
        onClick={() => onSubmit({
          type: roleAttr === '评审' ? 'reviewer' : roleAttr === '创作者' ? 'creator' : undefined,
          adminLevel: resolveAdminLevel(),
          groupIds: Array.from(selectedGroups),
        })}
      >
        确认变更
      </button>
    </div>
  )
}

