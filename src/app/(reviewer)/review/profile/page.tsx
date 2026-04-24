'use client'

import { useState, useEffect } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle, textSectionTitle, cardCls, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'
import { Pencil, Smartphone, Lock, Headphones } from 'lucide-react'

const rowCls = 'flex justify-between items-center px-3 py-2.5 bg-[var(--bg4)] rounded-md text-sm'

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
  const { data: loginLogsData } = useApi<{ list: LoginLogItem[]; total: number }>('/api/profile/login-logs?pageSize=10')
  const loginLogs = loginLogsData?.list ?? []
  const [modal, setModal] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [toast, setToast] = useState('')

  // 更换手机号表单
  const [oldCode, setOldCode] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCode, setNewCode] = useState('')
  const [oldCodeCooldown, setOldCodeCooldown] = useState(0)
  const [newCodeCooldown, setNewCodeCooldown] = useState(0)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '')
      setEditEmail(profile.email || '')
    }
  }, [profile])

  useEffect(() => {
    if (oldCodeCooldown <= 0) return
    const t = setTimeout(() => setOldCodeCooldown((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [oldCodeCooldown])
  useEffect(() => {
    if (newCodeCooldown <= 0) return
    const t = setTimeout(() => setNewCodeCooldown((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [newCodeCooldown])

  const user = {
    name: profile?.name ?? '—',
    phone: profile?.phone ?? '—',
    email: profile?.email ?? '',
    role: '评审',
    registeredAt: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-CN') : '—',
    // Note: profile.createdAt comes from /api/profile which returns User.createdAt for creator/reviewer
  }

  async function sendOldCode() {
    if (!profile?.phone) return
    const res = await apiCall('/api/auth/sms/send', 'POST', { phone: profile.phone, purpose: 'change_phone' })
    if (res.ok) {
      showToast('旧手机验证码已发送')
      setOldCodeCooldown(60)
    } else {
      showToast(`${res.message || '发送失败'}`)
    }
  }
  async function sendNewCode() {
    if (!newPhone || !/^1[3-9]\d{9}$/.test(newPhone)) {
      showToast('请先填写正确的新手机号'); return
    }
    const res = await apiCall('/api/auth/sms/send', 'POST', { phone: newPhone, purpose: 'change_phone' })
    if (res.ok) {
      showToast('新手机验证码已发送')
      setNewCodeCooldown(60)
    } else {
      showToast(`${res.message || '发送失败'}`)
    }
  }

  async function submitPhoneChange() {
    if (!profile?.phone || !oldCode || !newPhone || !newCode) {
      showToast('请填写完整'); return
    }
    const res = await apiCall('/api/profile/phone', 'POST', {
      oldPhone: profile.phone,
      oldCode,
      newPhone,
      newCode,
    })
    if (res.ok) {
      showToast('手机号已更新，下次登录请使用新号码')
      setModal(null)
      setOldCode(''); setNewCode(''); setNewPhone('')
      refetchProfile()
    } else {
      showToast(`${res.message || '更新失败'}`)
    }
  }

  return (
    <div className={pageWrap}>
      <div className="flex items-baseline gap-2.5">
        <h1 className={textPageTitle}>个人中心</h1>
        <span className="text-sm text-[var(--text3)]">评审账号信息管理</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 基本信息 */}
        <div className={cardCls}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={textSectionTitle}>基本信息</h2>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setModal('edit')}><Pencil className="w-3.5 h-3.5 inline mr-1" />编辑</button>
              <button className={btnGhost} onClick={() => setModal('phone')}><Smartphone size={14} className="inline mr-1 -mt-0.5" />改手机号</button>
              <button className={btnGhost} onClick={() => setModal('password')}><Lock size={14} className="inline mr-1 -mt-0.5" />改密码</button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#8b5cf6] flex items-center justify-center text-[28px]">
              <Headphones className="w-7 h-7" />
            </div>
            <div>
              <div className="text-base font-semibold text-[var(--text)]">{user.name}</div>
              <div className="text-xs text-[var(--text3)]">{user.role}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[
              ['姓名', user.name],
              ['手机号', user.phone],
              ['邮箱', user.email],
              ['角色', user.role],
              ['注册时间', user.registeredAt],
            ].map(([k, v]) => (
              <div key={k} className={rowCls}>
                <span className="text-[var(--text2)]">{k}</span>
                <span className="text-[var(--text)] font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 登录日志 */}
        <div className={cardCls}>
          <h2 className={`${textSectionTitle} mb-4`}>登录日志</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['登录时间', 'IP地址', '设备/浏览器'].map(h => (
                  <th key={h} className="text-left px-2.5 py-2 text-[var(--text3)] font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(loginLogs || []).map((log) => (
                <tr key={log.id} className="border-b border-[var(--border)]">
                  <td className="p-2.5 text-[var(--text)]">{new Date(log.time).toLocaleString('zh-CN')}</td>
                  <td className="p-2.5 text-[var(--text2)] font-mono">{log.ip}</td>
                  <td className="p-2.5 text-[var(--text2)]">{log.userAgent}</td>
                </tr>
              ))}
              {loginLogs && loginLogs.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-[var(--text3)]">暂无登录记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {modal === 'edit' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-[var(--bg3)] rounded-xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-5">编辑个人信息</h3>
            <div className="mb-3.5">
              <label className={labelCls}>昵称</label>
              <input className={inputCls} value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="mb-3.5">
              <label className={labelCls}>邮箱</label>
              <input className={inputCls} value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div className="mb-5">
              <label className={labelCls}>手机号</label>
              <input className={inputCls} value={user.phone} disabled style={{ opacity: 0.5 }} />
              <span className="text-[11px] text-[var(--text3)]">修改手机号请用"改手机号"入口</span>
            </div>
            <button className={`${btnPrimary} w-full flex items-center justify-center`} onClick={async () => {
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

      {/* Phone Change Modal */}
      {modal === 'phone' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-[var(--bg3)] rounded-xl p-7 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">更换手机号</h3>
            <p className="text-xs text-[var(--text3)] mb-5">
              旧手机号与新手机号需各自通过短信验证码校验。更新成功后，下次登录请使用新号码。
            </p>

            <div className="mb-3.5">
              <label className={labelCls}>旧手机号</label>
              <input className={inputCls} value={profile?.phone || ''} disabled style={{ opacity: 0.5 }} />
            </div>
            <div className="mb-3.5">
              <label className={labelCls}>旧手机验证码</label>
              <div className="flex gap-2">
                <input className={inputCls} value={oldCode} onChange={e => setOldCode(e.target.value)} placeholder="6位数字" maxLength={6} />
                <button
                  className={`${btnGhost} whitespace-nowrap`}
                  disabled={oldCodeCooldown > 0}
                  onClick={sendOldCode}
                >
                  {oldCodeCooldown > 0 ? `${oldCodeCooldown}s` : '发送验证码'}
                </button>
              </div>
            </div>

            <div className="mb-3.5">
              <label className={labelCls}>新手机号</label>
              <input className={inputCls} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="1 开头 11 位手机号" maxLength={11} />
            </div>
            <div className="mb-5">
              <label className={labelCls}>新手机验证码</label>
              <div className="flex gap-2">
                <input className={inputCls} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="6位数字" maxLength={6} />
                <button
                  className={`${btnGhost} whitespace-nowrap`}
                  disabled={newCodeCooldown > 0 || !newPhone}
                  onClick={sendNewCode}
                >
                  {newCodeCooldown > 0 ? `${newCodeCooldown}s` : '发送验证码'}
                </button>
              </div>
            </div>

            <button className={`${btnPrimary} w-full flex items-center justify-center`} onClick={submitPhoneChange}>
              确认更换
            </button>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {modal === 'password' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-[var(--bg3)] rounded-xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-5">修改密码</h3>
            <div className="mb-3.5">
              <label className={labelCls}>当前密码</label>
              <input className={inputCls} type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} />
            </div>
            <div className="mb-3.5">
              <label className={labelCls}>新密码</label>
              <input className={inputCls} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="≥8位，含字母和数字" />
            </div>
            <div className="mb-5">
              <label className={labelCls}>确认新密码</label>
              <input className={inputCls} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </div>
            <button className={`${btnPrimary} w-full flex items-center justify-center`} onClick={async () => {
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white px-6 py-2.5 rounded-lg text-sm z-[100] shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          {toast}
        </div>
      )}
    </div>
  )
}
