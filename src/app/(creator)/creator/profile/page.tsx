'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle, cardCls, btnPrimary as btnPrimaryBase, inputCls, labelCls } from '@/lib/ui-tokens'
import { Music, User, Phone, Lock, Mail, ShieldCheck, BadgeCheck, Calendar, Camera, X, Clock } from 'lucide-react'

// ── Style helpers ───────────────────────────────────────────────

const btnGhost =
  'bg-transparent text-[var(--text2)] border border-[var(--border)] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer hover:bg-[var(--bg4)] transition-colors'
const btnPrimary = `${btnPrimaryBase} w-full flex items-center justify-center`
const rowCls =
  'flex justify-between items-center px-3 py-2.5 bg-[var(--bg4)] rounded-md text-[13px]'

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
  agencyApplied: boolean
  agencyAppliedAt: string | null
  agencyRejectReason: string | null
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
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg4)] text-[var(--text3)] cursor-pointer border-0 bg-transparent"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Profile Row ──────────────────────────────────────────────────

function ProfileRow({ icon, label, value, action }: {
  icon: React.ReactNode
  label: string
  value: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg4)] rounded-md border border-[var(--border)]">
      <div className="flex items-center gap-2 text-[13px] min-w-0">
        <span className="text-[var(--accent)] flex-shrink-0">{icon}</span>
        <span className="text-[var(--text3)] flex-shrink-0">{label}</span>
        <span className="text-[var(--text)] font-medium truncate">{value}</span>
      </div>
      {action && <div className="flex-shrink-0 ml-2">{action}</div>}
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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900/95 text-white px-5 py-2.5 rounded-lg text-sm shadow-lg">
      {msg}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

interface AgreementItem {
  name: string
  content: string
  version: string
  signedAt: string
  signed: boolean
  applied?: boolean
  rejectReason?: string
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
  const [signAgencyModal, setSignAgencyModal] = useState(false)
  const [phoneModal, setPhoneModal] = useState(false)
  // View agreement content modal
  const [viewAgreement, setViewAgreement] = useState<{ name: string; content: string; version: string } | null>(null)

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
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeCooldown, setEmailCodeCooldown] = useState(0)

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
  useEffect(() => {
    if (emailCodeCooldown <= 0) return
    const t = setTimeout(() => setEmailCodeCooldown((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [emailCodeCooldown])

  async function sendEmailCode() {
    if (!user?.phone) return
    const res = await apiCall('/api/auth/sms/send', 'POST', { phone: user.phone, purpose: 'change_phone' })
    if (res.ok) {
      showToast('验证码已发送至当前手机')
      setEmailCodeCooldown(60)
    } else {
      showToast(res.message || '发送失败')
    }
  }

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
                <Music size={24} className="text-[var(--text3)]" />
              )}
              {(avatarHover || avatarUploading) && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs text-white">
                  {avatarUploading ? '上传中...' : '修改头像'}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[var(--bg3)] rounded-full border border-[var(--border)] flex items-center justify-center">
                <Camera size={10} className="text-[var(--text3)]" />
              </div>
            </div>
          </div>

          {/* Field rows with action buttons */}
          <div className="flex flex-col gap-2">
            <ProfileRow icon={<User size={14} />} label="姓名" value={user.name} action={<button className={btnGhost} onClick={() => setEditModal(true)}>修改姓名</button>} />
            <ProfileRow icon={<Phone size={14} />} label="手机号" value={user.phone} action={<button className={btnGhost} onClick={() => setPhoneModal(true)}>更换手机</button>} />
            <ProfileRow icon={<Lock size={14} />} label="密码" value="已设置" action={<button className={btnGhost} onClick={() => setPwdModal(true)}>更换密码</button>} />
            <ProfileRow icon={<Mail size={14} />} label="邮箱" value={user.email || ''} action={<button className={btnGhost} onClick={() => setEditModal(true)}>更换邮箱</button>} />
            <ProfileRow icon={<ShieldCheck size={14} />} label="实名认证" value={`${user.realName || '未填写'}（${rnStatus.label}）`} action={
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
            } />
            <ProfileRow icon={<BadgeCheck size={14} />} label="角色" value="创作者" />
            <ProfileRow icon={<Calendar size={14} />} label="注册时间" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—'} />
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">
          {/* Agreements */}
          <div className={cardCls}>
            <h3 className="text-[15px] font-semibold mb-3">协议管理</h3>
            <div className="text-[13px] mb-3">
              {(agreements || []).map((a, i) => {
                const isAgency = i === 2
                let statusLabel: string
                let statusColor: string
                let statusBg: string

                if (isAgency) {
                  if (a.signed) {
                    statusLabel = '已签署'
                    statusColor = 'var(--green2)'
                    statusBg = 'rgba(85,239,196,0.12)'
                  } else if (a.applied) {
                    statusLabel = '申请审核中'
                    statusColor = 'var(--orange)'
                    statusBg = 'rgba(253,203,110,0.12)'
                  } else if (a.rejectReason) {
                    statusLabel = '已驳回'
                    statusColor = 'var(--red)'
                    statusBg = 'rgba(255,107,107,0.12)'
                  } else {
                    statusLabel = '未申请'
                    statusColor = 'var(--text3)'
                    statusBg = 'rgba(107,114,128,0.12)'
                  }
                } else {
                  statusLabel = '已签署'
                  statusColor = 'var(--green2)'
                  statusBg = 'rgba(85,239,196,0.12)'
                }

                return (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <span
                        className="inline-block text-[11px] px-2 py-0.5 rounded mr-2"
                        style={{ background: statusBg, color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                      <span className="font-medium">{a.name}</span>
                      {a.signedAt && (
                        <span className="text-[var(--text3)] text-xs ml-2">签署于 {a.signedAt}</span>
                      )}
                      {!isAgency && false && a.rejectReason && (
                        <span className="text-[var(--red)] text-xs ml-2">驳回：{a.rejectReason}</span>
                      )}
                    </div>
                    <button
                      className={btnGhost}
                      onClick={() => setViewAgreement({ name: a.name, content: a.content, version: a.version })}
                    >
                      查看详情
                    </button>
                  </div>
                )
              })}
            </div>
            {(function () {
              const agency = (agreements || [])[2]
              if (!agency) return null
              if (agency.signed) return null
              if (agency.applied) {
                return (
                  <button
                    className="bg-[var(--bg4)] text-[var(--text3)] px-3 py-1 rounded-lg text-xs font-medium cursor-not-allowed border-0"
                    disabled
                  >
                    申请审核中
                  </button>
                )
              }
              return (
                <button
                  className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border-0"
                  onClick={() => setSignAgencyModal(true)}
                >
                  申请签署
                </button>
              )
            })()}
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
      <Modal title="编辑个人信息" open={editModal} onClose={() => { setEditModal(false); setEmailCode('') }}>
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
            <label className={labelCls}>
              邮箱 <span className="text-[var(--text3)]">（修改需验证码）</span>
            </label>
            <input
              className={inputCls}
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="请输入新邮箱"
            />
          </div>
          <div>
            <label className={labelCls}>手机验证码</label>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="6位数字"
                maxLength={6}
              />
              <button className={`${btnGhost} whitespace-nowrap`} disabled={emailCodeCooldown > 0} onClick={sendEmailCode}>
                {emailCodeCooldown > 0 ? `${emailCodeCooldown}s` : '发送验证码'}
              </button>
            </div>
          </div>
          <button
            className={btnPrimary}
            onClick={async () => {
              if (!editEmail.trim()) { showToast('请输入邮箱'); return }
              if (!emailCode.trim()) { showToast('请输入验证码'); return }
              const res = await apiCall('/api/profile/email', 'PUT', { email: editEmail.trim(), code: emailCode.trim() })
              setEditModal(false)
              setEmailCode('')
              if (res.ok) {
                showToast('邮箱已更新')
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
              <span style={{ color: rnStatus.color }}><Clock size={12} className="inline mr-1 -mt-0.5" />{rnStatus.label}</span>
            </div>
            <div className="text-xs text-[var(--text3)] mt-1">
              审核一般在 1 个工作日内完成，如需修改请等待审核结果或联系管理员。
            </div>
          </div>
        )}
      </Modal>

      {/* View Agreement Content Modal */}
      <Modal
        title={viewAgreement?.name || '协议详情'}
        open={!!viewAgreement}
        onClose={() => setViewAgreement(null)}
        width={600}
      >
        <div className="text-[13px]">
          {viewAgreement && (
            <div className="p-4 bg-[var(--bg4)] rounded-lg max-h-[400px] overflow-auto text-[var(--text2)] leading-[1.8]">
              <p className="font-semibold text-[var(--text)] mb-3">
                {viewAgreement.name} v{viewAgreement.version}
              </p>
              <div dangerouslySetInnerHTML={{ __html: viewAgreement.content || '暂无内容' }} />
            </div>
          )}
        </div>
      </Modal>

      {/* Sign Agency Modal */}
      <Modal
        title="申请签署代理发行协议"
        open={signAgencyModal}
        onClose={() => {
          setSignAgencyModal(false)
          setAgencyRead(false)
        }}
        width={600}
      >
        <div className="p-4 bg-[var(--bg4)] rounded-lg max-h-[300px] overflow-auto text-[13px] text-[var(--text2)] leading-[1.8] mb-4">
          <p className="font-semibold text-[var(--text)] mb-3">
            《音乐代理发行协议》v{(agreements || [])[2]?.version || '1.0'}
          </p>
          <div dangerouslySetInnerHTML={{ __html: (agreements || [])[2]?.content || '加载中...' }} />
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
              showToast('申请已提交，请等待管理员确认')
              refetch()
            } else {
              showToast(res.message || '提交失败')
            }
          }}
        >
          提交申请
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
