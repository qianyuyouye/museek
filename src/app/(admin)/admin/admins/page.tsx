'use client'

import { useState, useRef } from 'react'
import { CheckCircle2, XCircle, User } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, Column } from '@/components/ui/data-table'
import { useApi, apiCall } from '@/lib/use-api'
import { downloadCSV, today } from '@/lib/export'
import { pageWrap, cardCls, btnPrimary, btnGhost, btnSmall, inputCls, labelCls } from '@/lib/ui-tokens'
import { formatDateTime } from '@/lib/format'

// ── Types ────────────────────────────────────────────────────────

interface AdminUser {
  id: number
  account: string
  name: string
  roleId: number
  role: { id: number; name: string }
  avatarUrl?: string | null
  status: boolean
  multiLogin: boolean
  createdAt: string
  lastLoginAt: string | null
  lastLoginIp: string | null
}

interface AdminRole {
  id: number
  name: string
}

// ── Button helpers ───────────────────────────────────────────────


// ── Toggle Switch ────────────────────────────────────────────────

function ToggleSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? 'var(--accent2)' : '#ccc',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .2s',
        display: 'inline-block',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          background: '#fff',
          borderRadius: '50%',
          position: 'absolute',
          top: 3,
          left: on ? 23 : 3,
          transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }}
      />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

type View = 'list' | 'add' | 'edit'

interface FormState {
  account: string
  name: string
  roleId: string
  password: string
  confirmPassword: string
  status: boolean
  multiLogin: boolean
  avatar: string
}

const emptyForm: FormState = {
  account: '',
  name: '',
  roleId: '',
  password: '',
  confirmPassword: '',
  status: true,
  multiLogin: false,
  avatar: '',
}

export default function AdminAdminsPage() {
  const [view, setView] = useState<View>('list')
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [searchAccount, setSearchAccount] = useState('')
  const [searchName, setSearchName] = useState('')
  const [toast, setToast] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Delete admin
  async function handleDeleteAdmin(admin: AdminUser) {
    if (!confirm(`确认删除管理员「${admin.name}」（${admin.account}）？`)) return
    const res = await apiCall(`/api/admin/admins/${admin.id}`, 'DELETE')
    if (res.ok) {
      showToast('管理员已删除')
      refetch()
    } else {
      showToast(res.message || '删除失败')
    }
  }

  // Password reset modal
  const [resetAdminId, setResetAdminId] = useState<number | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetConfirmPw, setResetConfirmPw] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)

  async function handleResetPassword() {
    if (!resetPw || !resetConfirmPw) { showToast('请填写所有密码字段'); return }
    if (resetPw !== resetConfirmPw) { showToast('两次密码不一致'); return }
    if (resetPw.length < 8) { showToast('密码至少8位'); return }
    if (!resetAdminId) return
    const res = await apiCall(`/api/admin/admins/${resetAdminId}/reset-password`, 'POST', { password: resetPw })
    if (res.ok) {
      showToast('密码已重置')
      setShowResetModal(false)
      setResetPw(''); setResetConfirmPw(''); setResetAdminId(null)
    } else {
      showToast(res.message || '重置失败')
    }
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true)
    try {
      const tokenRes = await apiCall<{ uploadUrl: string; fileUrl: string; method: string; headers?: Record<string, string> }>(
        '/api/upload/token', 'POST', { fileName: file.name, fileSize: file.size, type: 'image' }
      )
      if (!tokenRes.ok || !tokenRes.data) {
        showToast(tokenRes.message || '获取上传凭证失败')
        return
      }
      const { uploadUrl, fileUrl, headers } = tokenRes.data
      const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers })
      if (!putRes.ok) {
        showToast('文件上传失败')
        return
      }
      setForm(f => ({ ...f, avatar: fileUrl }))
      showToast('头像上传成功')
    } catch {
      showToast('上传出错')
    } finally {
      setAvatarUploading(false)
    }
  }

  const searchParam = (searchAccount.trim() || searchName.trim())
    ? `&search=${encodeURIComponent(searchAccount.trim() || searchName.trim())}`
    : ''

  const { data: adminsData, loading, refetch } = useApi<{ list: AdminUser[] }>(
    `/api/admin/admins?pageSize=100${searchParam}`,
    [searchAccount, searchName]
  )
  const admins = adminsData?.list ?? []

  const { data: rolesData } = useApi<{ list: AdminRole[] }>('/api/admin/roles?pageSize=100')
  const roles = rolesData?.list ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openAdd() {
    setEditAdmin(null)
    setForm(emptyForm)
    setView('add')
  }

  function openEdit(admin: AdminUser) {
    setEditAdmin(admin)
    setForm({
      account: admin.account,
      name: admin.name,
      roleId: String(admin.roleId),
      password: '',
      confirmPassword: '',
      status: admin.status,
      multiLogin: admin.multiLogin,
      avatar: admin.avatarUrl || '',
    })
    setView('edit')
  }

  async function handleSave() {
    if (!form.account.trim()) { showToast('请输入账号'); return }
    if (!form.name.trim()) { showToast('请输入名称'); return }
    if (!form.roleId) { showToast('请选择角色'); return }
    if (view === 'add' && !form.password.trim()) { showToast('请输入密码'); return }
    if (view === 'add' && form.password !== form.confirmPassword) {
      showToast('两次密码不一致'); return
    }

    if (editAdmin) {
      const res = await apiCall(`/api/admin/admins/${editAdmin.id}`, 'PUT', {
        name: form.name,
        roleId: Number(form.roleId),
        status: form.status,
        multiLogin: form.multiLogin,
        avatarUrl: form.avatar || null,
      })
      if (res.ok) {
        showToast('管理员信息更新成功')
        setView('list')
        refetch()
      } else {
        showToast(res.message || '更新失败')
      }
    } else {
      const res = await apiCall('/api/admin/admins', 'POST', {
        account: form.account,
        name: form.name,
        password: form.password,
        roleId: Number(form.roleId),
        status: form.status,
        multiLogin: form.multiLogin,
        avatarUrl: form.avatar || null,
      })
      if (res.ok) {
        showToast('管理员添加成功')
        setView('list')
        refetch()
      } else {
        showToast(res.message || '添加失败')
      }
    }
  }

  async function handleToggleStatus(admin: AdminUser) {
    const res = await apiCall(`/api/admin/admins/${admin.id}`, 'PUT', { status: !admin.status })
    if (res.ok) {
      showToast(`已${admin.status ? '禁用' : '启用'}管理员：${admin.name}`)
      refetch()
    } else {
      showToast(res.message || '操作失败')
    }
  }

  // ── Add / Edit Form View ─────────────────────────────────────

  if (view === 'add' || view === 'edit') {
    return (
      <div className={pageWrap}>
        {toast && (
          <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
            {toast}
          </div>
        )}

        <PageHeader
          title={view === 'add' ? '添加管理员' : '编辑管理员'}
          subtitle={editAdmin ? `正在编辑：${editAdmin.name}` : '创建新平台管理员账号'}
          actions={
            <button className={btnGhost} onClick={() => setView('list')}>
              ← 返回
            </button>
          }
        />

        <div className={cardCls}>
          <div style={{ maxWidth: 500 }}>
            {/* 账号 */}
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>* 账号</label>
              <input
                className={inputCls}
                placeholder="请输入账号"
                value={form.account}
                disabled={view === 'edit'}
                onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
              />
            </div>

            {/* 名称 */}
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>* 名称</label>
              <input
                className={inputCls}
                placeholder="请输入名称"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* 角色 */}
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>* 角色</label>
              <select
                className={inputCls}
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              >
                <option value="">请选择角色</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 密码（仅添加时显示） */}
            {view === 'add' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label className={labelCls}>* 密码</label>
                  <input
                    className={inputCls}
                    type="password"
                    placeholder="请输入密码"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className={labelCls}>* 确认密码</label>
                  <input
                    className={inputCls}
                    type="password"
                    placeholder="请输入确认密码"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                    }
                  />
                </div>
              </>
            )}

            {/* 管理员状态 */}
            <div
              style={{
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <label
                className={labelCls}
                style={{ marginBottom: 0, minWidth: 80 }}
              >
                管理员状态
              </label>
              <ToggleSwitch
                on={form.status}
                onClick={() => setForm((f) => ({ ...f, status: !f.status }))}
              />
            </div>

            {/* 支持多处登录 */}
            <div
              style={{
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <label
                className={labelCls}
                style={{ marginBottom: 0, minWidth: 80 }}
              >
                支持多处登录
              </label>
              <ToggleSwitch
                on={form.multiLogin}
                onClick={() => setForm((f) => ({ ...f, multiLogin: !f.multiLogin }))}
              />
            </div>

            {/* 管理员头像 */}
            <div style={{ marginBottom: 20 }}>
              <label className={labelCls}>管理员头像</label>
              <div
                style={{
                  width: 80,
                  height: 80,
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text3)',
                  fontSize: 12,
                }}
                onClick={() => avatarInputRef.current?.click()}
              >
                {form.avatar ? (
                  form.avatar.startsWith('http') || form.avatar.startsWith('/') ? (
                    <img src={form.avatar} alt="头像" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 36 }}>{form.avatar}</span>
                  )
                ) : (
                  <span>添加图片</span>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleAvatarUpload(file)
                  e.target.value = ''
                }}
              />
              {avatarUploading && <span style={{ fontSize: 12, color: 'var(--text3)' }}>上传中...</span>}
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className={btnPrimary} onClick={handleSave}>
                保存
              </button>
              <button className={btnGhost} onClick={() => setView('list')}>
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── List View ────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'avatarUrl',
      title: '头像',
      render: (v) => {
        const url = v as string | null
        if (url && (url.startsWith('http') || url.startsWith('/'))) {
          return <img src={url} alt="头像" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
        }
        return <User className="w-8 h-8 text-[var(--text3)]" />
      },
    },
    {
      key: 'account',
      title: '账号',
      render: (v) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{v as string}</span>
      ),
    },
    {
      key: 'name',
      title: '名称',
      render: (v) => <span style={{ fontWeight: 500 }}>{v as string}</span>,
    },
    {
      key: 'role',
      title: '角色',
      render: (v) => {
        const role = v as { id: number; name: string } | null
        return (
          <span className="text-xs px-2 py-0.5 rounded-xl bg-[rgba(108,92,231,0.1)] text-[var(--accent2)]">
            {role?.name ?? '—'}
          </span>
        )
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (v) => (
        <span className="text-xs text-[var(--text3)]">{formatDateTime(v as string)}</span>
      ),
    },
    {
      key: 'lastLoginAt',
      title: '最后登录时间',
      render: (v) => (
        <span className="text-xs text-[var(--text3)]">{v ? formatDateTime(v as string) : '—'}</span>
      ),
    },
    {
      key: 'lastLoginIp',
      title: '最后登录IP',
      render: (v) => (
        <span className="text-xs text-[var(--text3)] font-mono">{(v as string) || '—'}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (v, row) => (
        <ToggleSwitch
          on={v as boolean}
          onClick={() => handleToggleStatus(row as unknown as AdminUser)}
        />
      ),
    },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => {
        const r = row as unknown as AdminUser
        return (
          <div className="flex gap-1.5">
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => {
                e.stopPropagation()
                openEdit(r)
              }}
            >
              编辑
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => {
                e.stopPropagation()
                setResetAdminId(r.id)
                setResetPw('')
                setResetConfirmPw('')
                setShowResetModal(true)
              }}
            >
              改密码
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteAdmin(r)
              }}
            >
              删除
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
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="平台管理员"
        subtitle="这是管理员页面，默认管理员。"
        actions={
          <button className={btnPrimary} onClick={openAdd}>
            + 添加管理员
          </button>
        }
      />

      {/* 搜索栏 */}
      <div
        className={`${cardCls} flex gap-3 items-center flex-wrap`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)', whiteSpace: 'nowrap' }}>账号</span>
          <input
            className={inputCls}
            style={{ width: 160, marginBottom: 0 }}
            placeholder="请输入账号"
            value={searchAccount}
            onChange={(e) => setSearchAccount(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)', whiteSpace: 'nowrap' }}>名称</span>
          <input
            className={inputCls}
            style={{ width: 160, marginBottom: 0 }}
            placeholder="请输入名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>
        <button className={btnPrimary} onClick={() => refetch()}>
          查询
        </button>
        <button
          className={btnGhost}
          onClick={() => {
            setSearchAccount('')
            setSearchName('')
          }}
        >
          重置
        </button>
        <button
          className={btnGhost}
          onClick={() => {
            if (admins.length === 0) { showToast('暂无数据可导出'); return }
            const rows = admins.map((a) => ({
              账号: a.account,
              姓名: a.name,
              角色: a.role?.name ?? '',
              状态: a.status ? '启用' : '停用',
              允许多端登录: a.multiLogin ? '是' : '否',
              最后登录时间: a.lastLoginAt ?? '',
              最后登录IP: a.lastLoginIp ?? '',
              创建时间: a.createdAt ? formatDateTime(a.createdAt) : '',
            }))
            downloadCSV(rows, `管理员列表_${today()}.csv`)
            showToast(`已导出 ${admins.length} 条管理员记录`)
          }}
        >
          导出
        </button>
      </div>

      {/* DataTable */}
      <div className={cardCls}>
        <DataTable
          columns={columns}
          data={admins}
          rowKey={(r) => r.id}
        />
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowResetModal(false)}>
          <div className="bg-[var(--bg3)] rounded-xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-5">修改管理员密码</h3>
            <div className="mb-3.5">
              <label className={labelCls}>新密码</label>
              <input className={inputCls} type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="≥8位，含字母和数字" />
            </div>
            <div className="mb-5">
              <label className={labelCls}>确认新密码</label>
              <input className={inputCls} type="password" value={resetConfirmPw} onChange={e => setResetConfirmPw(e.target.value)} />
            </div>
            <button className={`${btnPrimary} w-full flex items-center justify-center`} onClick={handleResetPassword}>确认修改</button>
          </div>
        </div>
      )}
    </div>
  )
}
