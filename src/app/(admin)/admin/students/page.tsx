'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, XCircle, Circle, Ban, Music, User } from 'lucide-react'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, Column } from '@/components/ui/data-table'
import { SearchBar } from '@/components/ui/search-bar'
import { StatusBadge } from '@/components/ui/status-badge'
import { SONG_STATUS_MAP } from '@/lib/constants'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost, btnDanger, btnSuccess, btnSmall, inputCls, labelCls } from '@/lib/ui-tokens'

// ── Types ────────────────────────────────────────────────────────

interface Student {
  id: number
  name: string
  realName: string | null
  phone: string
  email: string | null
  avatarUrl: string | null
  type: string
  adminLevel: string | null
  realNameStatus: string
  agencyContract: boolean
  status: string
  groups: { id: number; name: string }[]
  songCount: number
  totalRevenue?: number
  idCard?: string | null
  agencySignedAt?: string | null
  createdAt?: string
  lastLoginAt?: string | null
}

interface Song {
  id: number
  title: string
  cover: string | null
  status: string
  userId: number
}

// ── Main component ───────────────────────────────────────────────

export default function AdminStudentsPage() {
  const confirm = useConfirm()
  const [detail, setDetail] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('全部实名状态')

  const statusFilterMap: Record<string, string> = {
    已认证: 'verified',
    待审核: 'pending',
    未认证: 'unverified',
    已驳回: 'rejected',
  }

  const realNameParam = filterStatus !== '全部实名状态' ? `&realNameStatus=${statusFilterMap[filterStatus] || ''}` : ''
  const searchParam = searchText.trim() ? `&search=${encodeURIComponent(searchText.trim())}` : ''

  const { data: studentsData, loading, refetch } = useApi<{ list: Student[]; total: number }>(
    `/api/admin/students?pageSize=100${searchParam}${realNameParam}`,
    [searchText, filterStatus]
  )
  const students = studentsData?.list ?? []

  const { data: detailStudent, loading: detailLoading, refetch: refetchDetail } = useApi<Student>(
    detail !== null ? `/api/admin/students/${detail}` : null
  )

  const { data: songsData } = useApi<{ list: Song[] }>(
    detail !== null ? `/api/admin/songs?userId=${detail}&pageSize=100` : null
  )
  const userSongs = songsData?.list ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Detail view ──────────────────────────────────────────────
  if (detail !== null) {
    if (detailLoading) {
      return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
    }

    if (!detailStudent) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          用户不存在
          <br />
          <button className={btnGhost} style={{ marginTop: 12 }} onClick={() => setDetail(null)}>
            ← 返回列表
          </button>
        </div>
      )
    }

    const s = detailStudent

    const roleLabel: Record<string, string> = {
      creator: '创作者',
      reviewer: '🎧 评审',
      admin: '管理员',
    }

    const adminLevelLabel =
      s.adminLevel === 'group_admin'
        ? '🔰 组管理员'
        : s.adminLevel === 'system_admin'
          ? '系统管理员'
          : '无'

    const groupNames = s.groups.map((g) => g.name).join(', ') || '无'

    const basicInfo: [string, string | number][] = [
      ['姓名', s.realName || s.name || '—'],
      ['手机号', s.phone],
      ['邮箱', s.email || '—'],
      ['用户属性', roleLabel[s.type] ?? '创作者'],
      ['管理权限', adminLevelLabel],
      ['所属用户组', groupNames],
      ['作品数', s.songCount],
      ['总收益', `¥${s.totalRevenue ?? 0}`],
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
          title={`用户档案 · ${s.realName || s.name || s.phone || '未命名'}`}
          actions={
            <button className={btnGhost} onClick={() => setDetail(null)}>
              ← 返回列表
            </button>
          }
        />

        {/* 2-column grid */}
        <div className="grid grid-cols-2 gap-5">
          {/* Left: 基本信息 */}
          <div className={cardCls}>
            <h3 className="text-base font-semibold mb-4">基本信息</h3>

            {basicInfo.map(([k, v]) => (
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

            {/* Real name auth section */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text2)' }}>
                实名认证状态
              </div>

              {s.realNameStatus === 'pending' && (
                <div>
                  <div
                    style={{
                      padding: 10,
                      background: 'rgba(253,203,110,.08)',
                      borderRadius: 8,
                      marginBottom: 10,
                      fontSize: 12,
                      color: 'var(--orange)',
                    }}
                  >
                    待审核 — 用户已提交实名认证信息，请审核
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={btnSuccess}
                      onClick={async () => {
                        const res = await apiCall(`/api/admin/students/${s.id}/verify`, 'POST', { action: 'approve' })
                        if (res.ok) {
                          showToast('已通过实名认证')
                          refetchDetail()
                          refetch()
                        } else {
                          showToast(res.message || '操作失败')
                        }
                      }}
                    >
                      通过认证
                    </button>
                    <button
                      className={btnDanger}
                      onClick={async () => {
                        const res = await apiCall(`/api/admin/students/${s.id}/verify`, 'POST', { action: 'reject' })
                        if (res.ok) {
                          showToast('已驳回，已通知用户修改后重新提交')
                          refetchDetail()
                          refetch()
                        } else {
                          showToast(res.message || '操作失败')
                        }
                      }}
                    >
                      驳回
                    </button>
                  </div>
                </div>
              )}

              {s.realNameStatus === 'verified' && (
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      borderRadius: 20,
                      background: 'rgba(85,239,196,.12)',
                      color: 'var(--green2)',
                      display: 'inline-block',
                      marginBottom: 10,
                    }}
                  >
                    <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />已认证
                  </span>
                  {s.realName && (
                    <div style={{ fontSize: 12, display: 'grid', gap: 4 }}>
                      {(
                        [
                          ['真实姓名', s.realName],
                          ['身份证号', s.idCard || '—'],
                        ] as [string, string][]
                      ).map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'var(--bg)',
                            borderRadius: 4,
                          }}
                        >
                          <span style={{ color: 'var(--text3)' }}>{k}</span>
                          <span>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {s.realNameStatus === 'rejected' && (
                <div>
                  <div
                    style={{
                      padding: 10,
                      background: 'rgba(255,107,107,.08)',
                      borderRadius: 8,
                      marginBottom: 10,
                      fontSize: 12,
                      color: 'var(--red)',
                    }}
                  >
                    <XCircle className="inline w-3.5 h-3.5 mr-1" />已驳回 — 用户可修改后重新提交
                  </div>
                  <button
                    className={btnGhost}
                    onClick={async () => {
                      const res = await apiCall(`/api/admin/students/${s.id}/notify`, 'POST', { preset: 'realname_resubmit' })
                      showToast(res.ok ? '已通知用户重新提交实名认证' : (res.message || '发送失败'))
                    }}
                  >
                    发送提醒
                  </button>
                </div>
              )}

              {s.realNameStatus === 'unverified' && (
                <div>
                  <div
                    style={{
                      padding: 10,
                      background: 'rgba(107,114,128,.08)',
                      borderRadius: 8,
                      marginBottom: 10,
                      fontSize: 12,
                      color: 'var(--text3)',
                    }}
                  >
                    <Circle className="inline w-3.5 h-3.5 mr-1" />未提交 — 用户尚未发起实名认证
                  </div>
                  <button
                    className={btnGhost}
                    onClick={async () => {
                      const res = await apiCall(`/api/admin/students/${s.id}/notify`, 'POST', { preset: 'realname_unverified' })
                      showToast(res.ok ? '已向用户发送实名认证提醒' : (res.message || '发送失败'))
                    }}
                  >
                    发送提醒
                  </button>
                </div>
              )}
            </div>

            {/* Disable account */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <button
                className={`${btnDanger} ${btnSmall}`}
                onClick={async () => {
                  if (await confirm({ message: `确认禁用「${s.name}」的账号？`, danger: true })) {
                    const res = await apiCall(`/api/admin/students/${s.id}`, 'PUT', { status: 'disabled' })
                    if (res.ok) {
                      showToast(`已禁用账号：${s.name}`)
                      refetchDetail()
                    } else {
                      showToast(res.message || '操作失败')
                    }
                  }
                }}
              >
                <Ban className="inline w-3.5 h-3.5 mr-1" />禁用账号
              </button>
            </div>
          </div>

          {/* Right: 作品列表 */}
          <div className={cardCls}>
            <h3 className="text-base font-semibold mb-4">
              作品列表（{userSongs.length}首）
            </h3>
            {userSongs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                📭 暂无作品
              </div>
            ) : (
              userSongs.map((sg) => {
                const statusInfo = SONG_STATUS_MAP[sg.status]
                return (
                  <div
                    key={sg.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{sg.cover || <Music className="w-4 h-4 text-[var(--text3)]" />}</span>
                      <span>{sg.title}</span>
                    </div>
                    {statusInfo && (
                      <StatusBadge
                        label={statusInfo.label}
                        color={statusInfo.color}
                        bg={statusInfo.bg}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>
  }

  const realNameColorMap: Record<string, string> = {
    verified: 'var(--green2)',
    pending: 'var(--orange)',
    unverified: 'var(--text3)',
    rejected: 'var(--red)',
  }
  const realNameLabelMap: Record<string, string> = {
    verified: '已认证',
    pending: '待审核',
    unverified: '未认证',
    rejected: '已驳回',
  }

  const listColumns: Column<Student>[] = [
    {
      key: 'avatarUrl',
      title: '',
      render: (v) => <span style={{ fontSize: 20 }}>{(v as string) || <User className="w-5 h-5 text-[var(--text3)]" />}</span>,
    },
    {
      key: 'name',
      title: '姓名',
      render: (v, row) => {
        const u = row as unknown as Student
        return <span style={{ fontWeight: 600 }}>{u.realName || (v as string) || '—'}</span>
      },
    },
    {
      key: 'type',
      title: '属性',
      render: (v, row) => {
        const roleColors: Record<string, string> = {
          creator: 'var(--accent2)',
          reviewer: 'var(--green)',
          admin: 'var(--orange)',
        }
        const roleLabels: Record<string, string> = {
          creator: '创作者',
          reviewer: '评审',
          admin: '管理员',
        }
        const role = v as string
        const r = row as Student
        const suffix = r.adminLevel === 'group_admin' ? ' · 组管理员' : ''
        return (
          <span style={{ fontSize: 12, color: roleColors[role] ?? 'var(--text2)' }}>
            {roleLabels[role] ?? '创作者'}
            {suffix}
          </span>
        )
      },
    },
    { key: 'phone', title: '手机号' },
    {
      key: 'realNameStatus',
      title: '实名',
      render: (v) => {
        const status = v as string
        return (
          <span style={{ fontSize: 12, color: realNameColorMap[status] ?? 'var(--text3)' }}>
            {realNameLabelMap[status] ?? '未认证'}
          </span>
        )
      },
    },
    {
      key: 'groups',
      title: '用户组',
      render: (v) => {
        const groups = (v as { id: number; name: string }[]) || []
        const names = groups.map((g) => g.name).join(', ')
        return (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{names || '—'}</span>
        )
      },
    },
    {
      key: 'agencyContract',
      title: '代理协议',
      render: (v) =>
        v ? (
          <span style={{ color: 'var(--green2)', fontSize: 12 }}>已签署</span>
        ) : (
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>未签署</span>
        ),
    },
    { key: 'songCount', title: '作品数' },
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
        title="用户档案库"
        subtitle={`共 ${studentsData?.total ?? 0} 名创作者`}
      />

      {/* Search bar row */}
      <div className="flex gap-3">
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            placeholder="搜索姓名/手机号/邮箱"
          />
        </div>
        <select
          className={inputCls}
          style={{ width: 160 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option>全部实名状态</option>
          <option>已认证</option>
          <option>待审核</option>
          <option>未认证</option>
          <option>已驳回</option>
        </select>
      </div>

      {/* DataTable card */}
      <div className={cardCls}>
        <DataTable
          columns={listColumns}
          data={students}
          rowKey={(r) => r.id}
          onRowClick={(row) => setDetail((row as unknown as Student).id)}
        />
      </div>
    </div>
  )
}
