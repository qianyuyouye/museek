'use client'

import { useState, useEffect } from 'react'
import { useApi, apiCall } from '@/lib/use-api'

const cardCls = 'bg-white border border-[#e8edf5] rounded-xl p-5 shadow-[0_1px_4px_rgba(99,102,241,0.06)]'
const btnGhost = 'bg-transparent text-[var(--text2)] border border-[var(--border)] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer hover:bg-[#f8faff] transition-colors'
const btnPrimary = 'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0 w-full flex items-center justify-center'
const inputCls = 'w-full px-3.5 py-2.5 bg-white border-[1.5px] border-[#e8edf5] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
const labelCls = 'block text-[13px] text-[var(--text2)] mb-1.5 font-medium'
const rowCls = 'flex justify-between items-center px-3 py-2.5 bg-[#f0f4fb] rounded-md text-[13px]'

interface ProfileData {
  id: number
  name: string
  phone: string
  email: string
  type: string
  createdAt: string
}

interface LoginLogItem {
  id: number
  time: string
  ip: string
  userAgent: string
}

export default function ReviewerProfilePage() {
  const { data: profile, refetch: refetchProfile } = useApi<ProfileData>('/api/profile')
  const { data: loginLogs } = useApi<LoginLogItem[]>('/api/profile/login-logs')
  const [modal, setModal] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // Sync edit form with profile data
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '')
      setEditEmail(profile.email || '')
    }
  }, [profile])

  const user = {
    name: profile?.name ?? '—',
    phone: profile?.phone ?? '—',
    email: profile?.email ?? '—',
    role: '评审',
    registeredAt: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-CN') : '—',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>个人中心</h1>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>评审账号信息管理</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 基本信息 */}
        <div className={cardCls}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>基本信息</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={btnGhost} onClick={() => setModal('edit')}>✏️ 编辑</button>
              <button className={btnGhost} onClick={() => setModal('password')}>🔒 修改密码</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              🎧
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{user.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{user.role}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['姓名', user.name],
              ['手机号', user.phone],
              ['邮箱', user.email],
              ['角色', user.role],
              ['注册时间', user.registeredAt],
            ].map(([k, v]) => (
              <div key={k} className={rowCls}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 登录日志 */}
        <div className={cardCls}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>登录日志</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8edf5' }}>
                {['登录时间', 'IP地址', '设备/浏览器'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(loginLogs || []).map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', color: '#1e293b' }}>{new Date(log.time).toLocaleString('zh-CN')}</td>
                  <td style={{ padding: '10px', color: '#64748b', fontFamily: 'monospace' }}>{log.ip}</td>
                  <td style={{ padding: '10px', color: '#64748b' }}>{log.userAgent}</td>
                </tr>
              ))}
              {loginLogs && loginLogs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>暂无登录记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {modal === 'edit' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>编辑个人信息</h3>
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>昵称</label>
              <input className={inputCls} value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>邮箱</label>
              <input className={inputCls} value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className={labelCls}>手机号</label>
              <input className={inputCls} value={user.phone} disabled style={{ opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>修改手机号需验证码</span>
            </div>
            <button className={btnPrimary} onClick={async () => {
              const res = await apiCall('/api/profile', 'PUT', { name: editName, email: editEmail })
              if (res.ok) {
                showToast('✅ 个人信息已更新')
                setModal(null)
                refetchProfile()
              } else {
                showToast(`❌ ${res.message || '更新失败'}`)
              }
            }}>保存</button>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {modal === 'password' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>修改密码</h3>
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>当前密码</label>
              <input className={inputCls} type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className={labelCls}>新密码</label>
              <input className={inputCls} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="≥8位，含字母和数字" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className={labelCls}>确认新密码</label>
              <input className={inputCls} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </div>
            <button className={btnPrimary} onClick={async () => {
              if (!oldPw || !newPw || !confirmPw) { showToast('❌ 请填写所有密码字段'); return }
              if (newPw.length < 8) { showToast('❌ 新密码至少8位'); return }
              if (newPw !== confirmPw) { showToast('❌ 两次密码不一致'); return }
              const res = await apiCall('/api/profile/password', 'POST', { oldPassword: oldPw, newPassword: newPw })
              if (res.ok) {
                showToast('✅ 密码修改成功')
                setModal(null); setOldPw(''); setNewPw(''); setConfirmPw('')
              } else {
                showToast(`❌ ${res.message || '修改失败'}`)
              }
            }}>确认修改</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 13, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
