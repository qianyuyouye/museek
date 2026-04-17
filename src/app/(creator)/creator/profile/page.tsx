'use client'

import { useState, useEffect } from 'react'
import { useApi, apiCall } from '@/lib/use-api'

// ── Style helpers ───────────────────────────────────────────────

const cardCls =
  'bg-white border border-[#e8edf5] rounded-xl p-5 shadow-[0_1px_4px_rgba(99,102,241,0.06)]'
const btnGhost =
  'bg-transparent text-[var(--text2)] border border-[var(--border)] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer hover:bg-[#f8faff] transition-colors'
const btnPrimary =
  'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0 w-full flex items-center justify-center'
const inputCls =
  'w-full px-3.5 py-2.5 bg-white border-[1.5px] border-[#e8edf5] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
const labelCls = 'block text-[13px] text-[var(--text2)] mb-1.5 font-medium'
const rowCls =
  'flex justify-between items-center px-3 py-2.5 bg-[#f0f4fb] rounded-md text-[13px]'

// ── 固定文案数据（协议条款内容，非 API 数据） ──────────────────

const PLATFORM_AGREEMENTS = [
  { name: '《平台用户服务协议》', signedAt: '2026-01-10' },
  { name: '《隐私政策》', signedAt: '2026-01-10' },
]

const CONTRACT_DETAILS_STATIC: [string, string][] = [
  ['协议版本', 'v1.0'],
  ['分成比例', '创作者70% / 平台30%'],
  ['代理期限', '3年'],
  ['代理范围', '全平台'],
  ['是否独家', '是'],
  ['自动续约', '是'],
]

const VERIFY_INFO = [
  ['真实姓名', '张小明'],
  ['身份证号', '310***********1234'],
  ['实名手机号', '138****1234'],
  ['认证状态', '已通过'],
  ['认证时间', '2026-01-12 14:30'],
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
  avatar: string
  realName: string
  realNameStatus: string
  agencyContract: boolean
  agencySignedAt: string | null
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
        className="relative bg-white rounded-xl shadow-2xl p-6"
        style={{ width, maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f0f4fb] text-[var(--text3)] text-lg cursor-pointer border-0 bg-transparent"
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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-[#1e293b] text-white px-5 py-2.5 rounded-lg text-sm shadow-lg">
      {msg}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export default function CreatorProfile() {
  const { data: user, loading, refetch } = useApi<UserProfile>('/api/profile')
  const { data: loginLogs } = useApi<LoginLogItem[]>('/api/profile/login-logs')

  // Modal states
  const [editModal, setEditModal] = useState(false)
  const [pwdModal, setPwdModal] = useState(false)
  const [verifyModal, setVerifyModal] = useState(false)
  const [contractModal, setContractModal] = useState(false)
  const [signAgencyModal, setSignAgencyModal] = useState(false)

  // Avatar hover
  const [avatarHover, setAvatarHover] = useState(false)

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

  // Init edit form when user loads
  useEffect(() => {
    if (user) {
      setEditName(user.name)
      setEditEmail(user.email)
    }
  }, [user])

  const REAL_NAME_STATUS_MAP: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    verified: { label: '已认证', color: '#16a34a', bg: 'rgba(85,239,196,0.12)' },
    pending: { label: '待认证', color: '#d97706', bg: 'rgba(253,203,110,0.12)' },
    rejected: { label: '已拒绝', color: '#e53e3e', bg: 'rgba(255,107,107,0.12)' },
    unverified: { label: '未认证', color: '#94a3b8', bg: 'rgba(107,114,128,0.12)' },
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
    <div>
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-[var(--text)]">个人中心</h1>
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
            <div
              className="relative w-[72px] h-[72px] rounded-full bg-[#f0f4fb] border-2 border-[var(--border)] flex items-center justify-center text-4xl cursor-pointer transition-all"
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              onClick={() => showToast('已打开头像上传（原型演示）')}
            >
              {user.avatar}
              {avatarHover && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs text-white">
                  修改头像
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
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🏷️ 姓名</span>
                <span className="text-[var(--text)] font-medium">{user.name}</span>
              </div>
              <button className={btnGhost} onClick={() => setEditModal(true)}>修改姓名</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">📱 手机号</span>
                <span className="text-[var(--text)] font-medium">{user.phone}</span>
              </div>
              <button className={btnGhost}>更换手机</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🔒 密码</span>
                <span className="text-[var(--text)] font-medium">已设置</span>
              </div>
              <button className={btnGhost} onClick={() => setPwdModal(true)}>更换密码</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">📧 邮箱</span>
                <span className="text-[var(--text)] font-medium">{user.email}</span>
              </div>
              <button className={btnGhost} onClick={() => setEditModal(true)}>更换邮箱</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🔐 实名认证</span>
                <span className="text-[var(--text)] font-medium">{user.realName}（{rnStatus.label}）</span>
              </div>
              <button className={btnGhost} onClick={() => setVerifyModal(true)}>查看认证</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">🎭 角色</span>
                <span className="text-[var(--text)] font-medium">学生</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] rounded-md border border-[#e8edf5]">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--text3)]">📅 入职时间</span>
                <span className="text-[var(--text)] font-medium">2026-01-10</span>
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
              {/* 平台固定协议 */}
              {PLATFORM_AGREEMENTS.map((a, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-2 border-b border-[var(--border)]"
                >
                  <div>
                    <span
                      className="inline-block text-[11px] px-2 py-0.5 rounded mr-2"
                      style={{ background: 'rgba(85,239,196,0.12)', color: '#16a34a' }}
                    >
                      已签署
                    </span>
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <span className="text-[var(--text3)] text-xs">
                    创建于 {a.signedAt}
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
                      color: user.agencyContract ? '#16a34a' : '#94a3b8',
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
                className="bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border-0"
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
              className={`${inputCls} !bg-[#f8fafc] cursor-not-allowed`}
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
        title="实名认证信息"
        open={verifyModal}
        onClose={() => setVerifyModal(false)}
      >
        <div className="flex flex-col gap-2.5 text-[13px]">
          {VERIFY_INFO.map(([k, v]) => (
            <div key={k} className={rowCls}>
              <span className="text-[var(--text3)]">{k}</span>
              <span>{k === '认证状态' ? `✅ ${v}` : v}</span>
            </div>
          ))}
        </div>
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
          {CONTRACT_DETAILS_STATIC.map(([k, v]) => (
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
        <div className="p-4 bg-[#f0f4fb] rounded-lg max-h-[300px] overflow-auto text-[13px] text-[var(--text2)] leading-[1.8] mb-4">
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
            } else {
              showToast(res.message || '签署失败')
            }
          }}
        >
          确认签署
        </button>
      </Modal>

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  )
}
