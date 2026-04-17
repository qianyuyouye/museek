'use client'

import { useState } from 'react'
import { useConfirm } from '@/components/admin/confirm-dialog'
import { PageHeader } from '@/components/admin/page-header'
import { DataTable, Column } from '@/components/admin/data-table'
import { PermissionTree } from '@/components/admin/permission-tree'
import { useApi, apiCall } from '@/lib/use-api'

// ── Types ────────────────────────────────────────────────────────

interface Role {
  id: number
  name: string
  description: string | null
  permissions: Record<string, boolean>
  createdAt: string
  isBuiltin?: boolean
  adminCount?: number
}

// ── Button / input helpers ────────────────────────────────────────

const btnPrimary =
  'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0'
const btnGhost =
  'bg-transparent text-[var(--text2)] border border-[var(--border)] px-4 py-2 rounded-lg text-sm font-medium cursor-pointer'
const btnDanger =
  'bg-gradient-to-r from-[#e53e3e] to-[#c53030] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0'
const btnSmall = 'text-[11px] px-2.5 py-1'

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border-[1.5px] border-[#e8edf5] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
const labelCls = 'block text-[13px] text-[var(--text2)] mb-1.5 font-medium'

const cardCls =
  'bg-white border border-[#e8edf5] rounded-xl p-5 shadow-[0_1px_4px_rgba(99,102,241,0.06)]'

// ── Helpers ───────────────────────────────────────────────────────

function countPerms(permissions: Record<string, boolean> | undefined) {
  return Object.values(permissions || {}).filter(Boolean).length
}

// ── Main component ────────────────────────────────────────────────

export default function AdminRolesPage() {
  const confirm = useConfirm()
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [form, setForm] = useState<{ name: string; description: string; permissions: Record<string, boolean> }>({
    name: '',
    description: '',
    permissions: {},
  })
  const [toast, setToast] = useState('')

  const { data: rolesData, loading, refetch } = useApi<{ list: Role[] }>('/api/admin/roles?pageSize=100')
  const roles = rolesData?.list ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const openAdd = () => {
    setEditRole(null)
    setForm({ name: '', description: '', permissions: {} })
    setView('edit')
  }

  const openEdit = (role: Role) => {
    setEditRole(role)
    setForm({ name: role.name, description: role.description || '', permissions: role.permissions || {} })
    setView('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('❌ 请输入角色名称')
      return
    }
    if (editRole) {
      const res = await apiCall(`/api/admin/roles/${editRole.id}`, 'PUT', {
        name: form.name,
        description: form.description,
        permissions: form.permissions,
      })
      if (res.ok) {
        showToast('✅ 角色保存成功')
        setView('list')
        refetch()
      } else {
        showToast(res.message || '保存失败')
      }
    } else {
      const res = await apiCall('/api/admin/roles', 'POST', {
        name: form.name,
        description: form.description,
        permissions: form.permissions,
      })
      if (res.ok) {
        showToast('✅ 角色创建成功')
        setView('list')
        refetch()
      } else {
        showToast(res.message || '创建失败')
      }
    }
  }

  const handleDelete = async (role: Role) => {
    if (role.isBuiltin) {
      showToast('❌ 内置角色不可删除')
      return
    }
    if (await confirm({ message: `确认删除角色「${role.name}」？`, danger: true })) {
      const res = await apiCall(`/api/admin/roles/${role.id}`, 'DELETE')
      if (res.ok) {
        showToast('已删除角色')
        refetch()
      } else {
        showToast(res.message || '删除失败')
      }
    }
  }

  // ── Edit view ──────────────────────────────────────────────────

  if (view === 'edit') {
    return (
      <div>
        {toast && (
          <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
            {toast}
          </div>
        )}

        <PageHeader
          title={editRole ? '编辑角色' : '添加角色'}
          subtitle={editRole ? `正在编辑：${editRole.name}` : undefined}
          actions={
            <button className={btnGhost} onClick={() => setView('list')}>
              ← 返回
            </button>
          }
        />

        <div className={cardCls} style={{ maxWidth: 680 }}>
          {/* 名称 */}
          <div style={{ marginBottom: 16 }}>
            <label className={labelCls}>* 名称</label>
            <div style={{ position: 'relative' }}>
              <input
                className={inputCls}
                placeholder="请输入名称"
                maxLength={8}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 12,
                  color: 'var(--text3)',
                }}
              >
                {form.name.length}/8
              </span>
            </div>
          </div>

          {/* 描述 */}
          <div style={{ marginBottom: 20 }}>
            <label className={labelCls}>描述</label>
            <textarea
              className={inputCls}
              style={{ height: 80, resize: 'vertical' }}
              placeholder="请描述一下该角色"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* 权限 */}
          <div style={{ marginBottom: 24 }}>
            <label className={labelCls} style={{ marginBottom: 10, display: 'block' }}>
              权限
            </label>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '16px 20px',
                background: 'var(--bg)',
              }}
            >
              <PermissionTree
                value={form.permissions}
                onChange={(p) => setForm((f) => ({ ...f, permissions: p }))}
              />
            </div>
          </div>

          {/* Actions */}
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
    )
  }

  // ── List view ──────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  const columns: Column<Role>[] = [
    {
      key: 'id',
      title: 'ID',
      render: (v) => <span style={{ color: 'var(--text3)', fontSize: 12 }}>{v as number}</span>,
    },
    {
      key: 'name',
      title: '名称',
      render: (v, row) => (
        <span style={{ fontWeight: 600 }}>
          {v as string}
          {(row as Role).isBuiltin && (
            <span
              className="text-[11px] ml-1.5 text-[var(--orange)] bg-[rgba(255,165,0,0.1)] px-1.5 py-0.5 rounded-xl"
            >
              内置
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'permissions',
      title: '权限数',
      render: (v) => (
        <span style={{ fontSize: 12, color: 'var(--accent2)' }}>
          {countPerms(v as Record<string, boolean>)} 项
        </span>
      ),
    },
    {
      key: 'description',
      title: '说明',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--text3)' }}>{(v as string) || '—'}</span>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--text3)' }}>{v as string}</span>,
    },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => {
        const r = row as Role
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => {
                e.stopPropagation()
                openEdit(r)
              }}
            >
              编辑
            </button>
            {!r.isBuiltin && (
              <button
                className={`${btnDanger} ${btnSmall}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(r)
                }}
              >
                删除
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="角色管理"
        subtitle="配置平台角色与菜单权限"
        actions={
          <button className={btnPrimary} onClick={openAdd}>
            + 添加角色
          </button>
        }
      />

      <div className={cardCls}>
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={roles as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as Role).id}
        />
      </div>
    </div>
  )
}
