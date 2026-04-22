'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle, cardCls, btnPrimary as btnPrimaryBase, inputCls, labelCls } from '@/lib/ui-tokens'

// ── Style helpers ───────────────────────────────────────────────

const btnGhost =
  'bg-transparent text-[var(--text2)] border border-[var(--border)] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer hover:bg-[var(--bg4)] transition-colors'
const btnPrimary = `${btnPrimaryBase} w-full flex items-center justify-center`
const rowCls =
  'flex justify-between items-center px-3 py-2.5 bg-[var(--bg4)] rounded-md text-[13px]'

// ── 固定文案数据（协议条款内容，非 API 数据） ──────────────────

const CONTRACT_TERMS: [string, string][] = [
  ['代理期限', '3年'],
  ['代理范围', '全平台'],
  ['是否独家', '是'],
  ['自动续约', '是'],
]

// ── Types ───────────────────────────────────────────────────────

interface LoginLogItem {
  id: number
  time: string
  ip: string
  userAgent: string
}

interface UserProfile {
  id: number
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  realName: string
  realNameStatus: string
  agencyContract: boolean
  agencySignedAt: string | null
  createdAt: string
  groupIds?: number[]
}

// ── Modal component ─────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  width = 480,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  width?: number
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-[var(--bg3)] rounded-xl shadow-2xl p-6"
        style={{ width, maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg4)] text-[var(--text3)] text-lg cursor-pointer border-0 bg-transparent"
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Toast component ─────────────────────────────────────────────

function Toast({
  msg,
  onDone,
}: {
  msg: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-[var(--text)] text-white px-5 py-2.5 rounded-lg text-sm shadow-lg">
      {msg}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

interface AgreementItem {
  name: string
  signedAt: string
  signed: boolean
}

export default function CreatorProfile() {
  const { data: user, loading, refetch } = useApi<UserProfile>('/api/profile')
  const { data: loginLogsData } = useApi<{ list: LoginLogItem[]; total: number }>('/api/profile/login-logs?pageSize=10')
  const loginLogs = loginLogsData?.list ?? []
  const { data: agreements } = useApi<AgreementItem[]>('/api/profile/agreements')

  // Modal states
  const [editModal, setEditModal] = useState(false)
  const [pwdModal, setPwdModal] = useState(false)
  const [verifyModal, setVerifyModal] = useState(false)
  const [contractModal, setContractModal] = useState(false)
  const [signAgencyModal, setSignAgencyModal] = useState(false)
  const [phoneModal, setPhoneModal] = useState(false)

  // Avatar hover + upload
  const [avatarHover, setAvatarHover] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Toast
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => setToast(msg)

  // Edit form
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // Password form
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  // Sign agency checkbox
  const [agencyRead, setAgencyRead] = useState(false)

  // Phone change form
  const [oldCode, setOldCode] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCode, setNewCode] = useState('')
  const [oldCodeCooldown, setOldCodeCooldown] = useState(0)
  const [newCodeCooldown, setNewCodeCooldown] = useState(0)

  // Real-name form
  const [rnName, setRnName] = useState('')
  const [rnIdCard, setRnIdCard] = useState('')
  const [rnSubmitting, setRnSubmitting] = useState(false)

  // Init edit form when user loads
  useEffect(() => {
    if (user) {
      setEditName(user.name)
      setEditEmail(user.email)
    }
  }, [user])

  // Cooldown timers for phone change
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

  async function sendOldCode() {
    if (!user?.phone) return
    const res = await apiCall('/api/auth/sms/send', 'POST', { phone: user.phone, purpose: 'change_phone' })
    if (res.ok) {
      showToast('旧手机验证码已发送')
      setOldCodeCooldown(60)
    } else {
      showToast(res.message || '发送失败')
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
      showToast(res.message || '发送失败')
    }
  }
  async function submitPhoneChange() {
    if (!user?.phone || !oldCode || !newPhone || !newCode) {
      showToast('请填写完整'); return
    }
    const res = await apiCall('/api/profile/phone', 'POST', {
      oldPhone: user.phone, oldCode, newPhone, newCode,
    })
    if (res.ok) {
      showToast('手机号已更新，下次登录请使用新号码')
      setPhoneModal(false)
      setOldCode(''); setNewCode(''); setNewPhone('')
      refetch()
    } else {
      showToast(res.message || '更新失败')
    }
  }

  async function handleAvatarFile(file: File) {
    if (avatarUploading) return
    setAvatarUploading(true)
    try {
      const tokenRes = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, type: 'image' }),
      })
      const tokenJson = await tokenRes.json()
      if (tokenJson.code !== 200) {
        showToast(tokenJson.message || '获取上传凭证失败')
        return
      }
      const { uploadUrl, fileUrl, headers: extraHeaders } = tokenJson.data
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type, ...extraHeaders },
      })
      if (!putRes.ok) {
        showToast('文件上传失败')
        return
      }
      const saveRes = await apiCall('/api/profile/avatar', 'POST', { avatarUrl: fileUrl })
      if (saveRes.ok) {
        showToast('头像已更新')
        refetch()
      } else {
        showToast(saveRes.message || '头像保存失败')
      }
    } catch {
      showToast('头像上传出错')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const REAL_NAME_STATUS_MAP: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    verified: { label: '已认证', color: 'var(--green2)', bg: 'rgba(85,239,196,0.12)' },
    pending: { label: '待认证', color: 'var(--orange)', bg: 'rgba(253,203,110,0.12)' },
    rejected: { label: '已拒绝', color: 'var(--red)', bg: 'rgba(255,107,107,0.12)' },
    unverified: { label: '未认证', color: 'var(--text3)', bg: 'rgba(107,114,128,0.12)' },
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  const rnStatus = REAL_NAME_STATUS_MAP[user.realNameStatus]

  return (
    <div className={pageWrap}>
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <h1 className={textPageTitle}>个人中心</h1>
        <span className="text-sm text-[var(--text3)]">管理账号信息与协议</span>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-[1fr_1.2fr] gap-5">
        {/* ── Left: Basic Info ── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">基本信息</h3>
          </div>

          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <input
              ref={avatarInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleAvatarFile(f)
              }}
            />
            <div
              className="relative w-[72px] h-[72px] rounded-full bg-[var(--bg4)] border-2 border-[var(--border)] flex items-center justify-center text-4xl cursor-pointer transition-all overflow-hidden"
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[var(--text3)] text-2xl">🎵</span>
              )}
              {(avatarHover || avatarUploading) && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs text-white">
                  {avatarUploading ? '上传中...' : '修改头像'}
                </div>
              )}
              {/* Camera icon */}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full border border-[var(--border)] flex items-center justify-center text-[10px]">
                📷
              </div>
            </div>
          </div>

          {/* Field rows with action buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🏷️ 姓名</span>
                <span className="text-[var(--text)] font-medium">{user.name}</span>
              </div>
              <button className={btnGhost} onClick={() => setEditModal(true)}>修改姓名</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">📱 手机号</span>
                <span className="text-[var(--text)] font-medium">{user.phone}</span>
              </div>
              <button className={btnGhost} onClick={() => setPhoneModal(true)}>更换手机</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🔒 密码</span>
                <span className="text-[var(--text)] font-medium">已设置</span>
              </div>
              <button className={btnGhost} onClick={() => setPwdModal(true)}>更换密码</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">📧 邮箱</span>
                <span className="text-[var(--text)] font-medium">{user.email || ''}</span>
              </div>
              <button className={btnGhost} onClick={() => setEditModal(true)}>更换邮箱</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🔐 实名认证</span>
                <span className="text-[var(--text)] font-medium">
                  {user.realName || '未填写'}（{rnStatus.label}）
                </span>
              </div>
              <button
                className={btnGhost}
                onClick={() => {
                  setRnName(user.realName || '')
                  setRnIdCard('')
                  setVerifyModal(true)
                }}
              >
                {user.realNameStatus === 'unverified' || user.realNameStatus === 'rejected'
                  ? '提交认证'
                  : user.realNameStatus === 'verified'
                    ? '申请修改'
                    : '查看认证'}
              </button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🎭 角色</span>
                <span className="text-[var(--text)] font-medium">学生</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">📅 入职时间</span>
                <span className="text-[var(--text)] font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">
          {/* Agreements */}
          <div className={cardCls}>
            <h3 className="text-[15px] font-semibold mb-3">协议管理</h3>
            <div className="text-[13px] mb-3">
              {/* 平台固定协议（从 API 读取） */}
              {(agreements || []).map((a, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-2 border-b border-[var(--border)]"
                >
                  <div>
                    <span
                      className="inline-block text-[11px] px-2 py-0.5 rounded mr-2"
                      style={{ background: a.signed ? 'rgba(85,239,196,0.12)' : 'rgba(107,114,128,0.12)', color: a.signed ? 'var(--green2)' : 'var(--text3)' }}
                    >
                      {a.signed ? '已签署' : '未签署'}
                    </span>
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <span className="text-[var(--text3)] text-xs">
                    {a.signedAt ? `签署于 ${a.signedAt}` : '—'}
                  </span>
                </div>
              ))}
              {/* 代理发行协议（签署时间从 API 获取） */}
              <div className="flex justify-between items-center py-2">
                <div>
                  <span
                    className="inline-block text-[11px] px-2 py-0.5 rounded mr-2"
                    style={{
                      background: user.agencyContract ? 'rgba(85,239,196,0.12)' : 'rgba(107,114,128,0.12)',
                      color: user.agencyContract ? 'var(--green2)' : 'var(--text3)',
                    }}
                  >
                    {user.agencyContract ? '已签署' : '未签署'}
                  </span>
                  <span className="font-medium">《音乐代理发行协议》</span>
                </div>
                <span className="text-[var(--text3)] text-xs">
                  {user.agencySignedAt
                    ? `创建于 ${new Date(user.agencySignedAt).toLocaleDateString('zh-CN')}`
                    : '—'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className={btnGhost}
                onClick={() => setContractModal(true)}
              >
                查看详情
              </button>
              <button
                className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border-0"
                onClick={() => setSignAgencyModal(true)}
              >
                补签更新
              </button>
            </div>
          </div>

          {/* Login Logs */}
          <div className={cardCls}>
            <h3 className="text-[15px] font-semibold mb-3">登录日志</h3>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[var(--text3)] border-b border-[var(--border)]">
                  <th className="pb-2 font-medium">时间</th>
                  <th className="pb-2 font-medium">IP 地址</th>
                  <th className="pb-2 font-medium">设备/浏览器</th>
                </tr>
              </thead>
              <tbody>
                {(loginLogs || []).map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--border)] text-[var(--text2)]"
                  >
                    <td className="py-2.5">{new Date(log.time).toLocaleString('zh-CN')}</td>
                    <td className="py-2.5 font-mono">{log.ip}</td>
                    <td className="py-2.5">{log.userAgent}</td>
                  </tr>
                ))}
                {loginLogs && loginLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-[var(--text3)]">暂无登录记录</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-end mt-3 text-xs text-[var(--text3)]">
              最近 {loginLogs?.length || 0} 条记录
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Modals ═══ */}

      {/* Edit Info Modal */}
      <Modal title="编辑个人信息" open={editModal} onClose={() => setEditModal(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>昵称</label>
            <input
              className={inputCls}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>邮箱</label>
            <input
              className={inputCls}
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>
              手机号{' '}
              <span className="text-[var(--text3)]">（修改需验证码）</span>
            </label>
            <input
              className={`${inputCls} !bg-[var(--bg4)] cursor-not-allowed`}
              value={user.phone}
              disabled
            />
          </div>
          <button
            className={btnPrimary}
            onClick={async () => {
              const res = await apiCall('/api/profile', 'PUT', { name: editName, email: editEmail })
              setEditModal(false)
              if (res.ok) {
                showToast('个人信息已更新')
                refetch()
              } else {
                showToast(res.message || '更新失败')
              }
            }}
          >
            保存修改
          </button>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        title="修改密码"
        open={pwdModal}
        onClose={() => setPwdModal(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>当前密码</label>
            <input
              className={inputCls}
              type="password"
              placeholder="请输入当前密码"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>新密码</label>
            <input
              className={inputCls}
              type="password"
              placeholder=">=8位，含字母+数字"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>确认新密码</label>
            <input
              className={inputCls}
              type="password"
              placeholder="再次输入新密码"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
          </div>
          <button
            className={btnPrimary}
            onClick={async () => {
              if (newPwd.length < 8 || !/[a-zA-Z]/.test(newPwd) || !/\d/.test(newPwd)) {
                showToast('密码需>=8位，包含字母和数字')
                return
              }
              if (newPwd !== confirmPwd) {
                showToast('两次输入的密码不一致')
                return
              }
              const res = await apiCall('/api/profile/password', 'POST', {
                oldPassword: curPwd,
                newPassword: newPwd,
              })
              if (res.ok) {
                setPwdModal(false)
                setCurPwd('')
                setNewPwd('')
                setConfirmPwd('')
                showToast('密码修改成功')
              } else {
                showToast(res.message || '密码修改失败')
              }
            }}
          >
            确认修改
          </button>
        </div>
      </Modal>

      {/* Verify Info Modal */}
      <Modal
        title="实名认证"
        open={verifyModal}
        onClose={() => setVerifyModal(false)}
      >
        {user.realNameStatus === 'unverified' || user.realNameStatus === 'rejected' || user.realNameStatus === 'verified' ? (
          <div className="flex flex-col gap-4">
            {user.realNameStatus === 'rejected' && (
              <div className="px-3 py-2 rounded-md text-[13px] bg-[rgba(255,107,107,0.08)] text-[var(--red)]">
                上次提交已被驳回，请核对信息后重新提交。
              </div>
            )}
            {user.realNameStatus === 'verified' && (
              <div className="px-3 py-2 rounded-md text-[13px] bg-[rgba(245,158,11,0.08)] text-[var(--orange)]">
                当前已通过认证，提交修改后将重新审核。
              </div>
            )}
            <div>
              <label className={labelCls}>真实姓名</label>
              <input
                className={inputCls}
                value={rnName}
                placeholder="请输入身份证上的姓名"
                onChange={(e) => setRnName(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>身份证号</label>
              <input
                className={inputCls}
                value={rnIdCard}
                placeholder="18 位身份证号"
                maxLength={18}
                onChange={(e) =>
                  setRnIdCard(e.target.value.replace(/[^\dXx]/g, '').toUpperCase())
                }
              />
            </div>
            <div className="text-xs text-[var(--text3)] leading-relaxed">
              身份证信息将加密存储，仅管理员审核时可见。提交后进入人工审核，状态变更后会通过消息中心通知。
            </div>
            <button
              className={`${btnPrimary} ${rnSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={rnSubmitting}
              onClick={async () => {
                if (!/^[\u4e00-\u9fa5·\s]{2,20}$|^[A-Za-z\s]{2,40}$/.test(rnName.trim())) {
                  showToast('真实姓名格式不正确')
                  return
                }
                if (!/^\d{17}[\dXx]$/.test(rnIdCard)) {
                  showToast('身份证号格式不正确')
                  return
                }
                setRnSubmitting(true)
                const res = await apiCall('/api/profile/real-name', 'POST', {
                  realName: rnName.trim(),
                  idCard: rnIdCard,
                })
                setRnSubmitting(false)
                if (res.ok) {
                  setVerifyModal(false)
                  setRnIdCard('')
                  showToast('认证申请已提交，等待审核')
                  refetch()
                } else {
                  showToast(res.message || '提交失败')
                }
              }}
            >
              提交认证申请
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 text-[13px]">
            <div className={rowCls}>
              <span className="text-[var(--text3)]">真实姓名</span>
              <span>{user.realName || '—'}</span>
            </div>
            <div className={rowCls}>
              <span className="text-[var(--text3)]">实名手机号</span>
              <span>{user.phone}</span>
            </div>
            <div className={rowCls}>
              <span className="text-[var(--text3)]">身份证号</span>
              <span>已加密保存</span>
            </div>
            <div className={rowCls}>
              <span className="text-[var(--text3)]">认证状态</span>
              <span style={{ color: rnStatus.color }}>⏳ {rnStatus.label}</span>
            </div>
            <div className="text-xs text-[var(--text3)] mt-1">
              审核一般在 1 个工作日内完成，如需修改请等待审核结果或联系管理员。
            </div>
          </div>
        )}
      </Modal>

      {/* Contract Details Modal */}
      <Modal
        title="音乐代理发行协议详情"
        open={contractModal}
        onClose={() => setContractModal(false)}
        width={600}
      >
        <div className="flex flex-col gap-2.5 text-[13px]">
          {/* 签署时间从 API 获取 */}
          <div className={rowCls}>
            <span className="text-[var(--text3)]">签署时间</span>
            <span>
              {user.agencySignedAt
                ? new Date(user.agencySignedAt).toLocaleString('zh-CN')
                : '未签署'}
            </span>
          </div>
          {/* 固定条款内容 */}
          {CONTRACT_TERMS.map(([k, v]) => (
            <div key={k} className={rowCls}>
              <span className="text-[var(--text3)]">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Sign Agency Modal */}
      <Modal
        title="补签 / 更新代理发行协议"
        open={signAgencyModal}
        onClose={() => {
          setSignAgencyModal(false)
          setAgencyRead(false)
        }}
        width={600}
      >
        <div className="p-4 bg-[var(--bg4)] rounded-lg max-h-[300px] overflow-auto text-[13px] text-[var(--text2)] leading-[1.8] mb-4">
          <p className="font-semibold text-[var(--text)]">
            《音乐代理发行协议》v1.0
          </p>
          <p>
            第一条
            代理范围：甲方（创作者）授权乙方（平台）在全球范围内的流媒体平台代理发行音乐作品。
          </p>
          <p>
            第二条 分成比例：默认分成 -- 创作者70% /
            平台30%。高分激励（{'>='}90分）-- 创作者80% / 平台20%。
          </p>
          <p>
            第三条
            代理期限：自签署之日起3年，到期后自动续约，任何一方可提前30日书面通知终止。
          </p>
          <p>
            第四条
            独家条款：在代理期限内，甲方授权的作品由乙方独家代理发行。
          </p>
        </div>
        <label className="flex items-start gap-2 text-[13px] text-[var(--text2)] cursor-pointer mb-4">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={agencyRead}
            onChange={(e) => setAgencyRead(e.target.checked)}
          />
          <span>我已阅读并同意以上协议条款</span>
        </label>
        <button
          className={`${btnPrimary} ${!agencyRead ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!agencyRead}
          onClick={async () => {
            const res = await apiCall('/api/profile/agency', 'POST')
            setSignAgencyModal(false)
            setAgencyRead(false)
            if (res.ok) {
              showToast('代理发行协议签署成功')
              refetch()
            } else {
              showToast(res.message || '签署失败')
            }
          }}
        >
          确认签署
        </button>
      </Modal>

      {/* Phone Change Modal */}
      <Modal title="更换手机号" open={phoneModal} onClose={() => setPhoneModal(false)}>
        <div className="flex flex-col gap-3.5">
          <p className="text-xs text-[var(--text3)]">旧手机号与新手机号需各自通过短信验证码校验</p>
          <div>
            <label className={labelCls}>旧手机号</label>
            <input className={`${inputCls} !bg-[var(--bg4)] cursor-not-allowed`} value={user.phone} disabled />
          </div>
          <div>
            <label className={labelCls}>旧手机验证码</label>
            <div className="flex gap-2">
              <input className={inputCls} value={oldCode} onChange={e => setOldCode(e.target.value)} placeholder="6位数字" maxLength={6} />
              <button className={`${btnGhost} whitespace-nowrap`} disabled={oldCodeCooldown > 0} onClick={sendOldCode}>
                {oldCodeCooldown > 0 ? `${oldCodeCooldown}s` : '发送验证码'}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>新手机号</label>
            <input className={inputCls} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="1开头11位手机号" maxLength={11} />
          </div>
          <div>
            <label className={labelCls}>新手机验证码</label>
            <div className="flex gap-2">
              <input className={inputCls} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="6位数字" maxLength={6} />
              <button className={`${btnGhost} whitespace-nowrap`} disabled={newCodeCooldown > 0 || !newPhone} onClick={sendNewCode}>
                {newCodeCooldown > 0 ? `${newCodeCooldown}s` : '发送验证码'}
              </button>
            </div>
          </div>
          <button className={btnPrimary} onClick={submitPhoneChange}>确认更换</button>
        </div>
      </Modal>

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  )
}
