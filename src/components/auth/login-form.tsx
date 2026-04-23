'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Users, Coins, Globe, LineChart, Lock, AlertTriangle, CheckCircle, MessageSquare, BarChart3, Eye, EyeOff, X, Headphones } from 'lucide-react'

/* ── Portal theme config ── */
const PORTAL_CONFIG: Record<string, {
  accent: string; accent2: string; accentRgb: string
  title: string
  heroTitle: string; heroSub: string
  placeholder: string; loginTitle: string
  tipBg: string; tipBorder: string; tipText: string; tipIcon: ReactNode
  features: { icon: ReactNode; text: string }[]
}> = {
  admin: {
    accent: 'var(--orange)', accent2: 'var(--orange)', accentRgb: '251,191,36',
    title: 'AI音乐教学与版权代理平台',
    heroTitle: '智慧中枢，\n驱动平台增长',
    heroSub: '全面掌控平台运营、用户管理、收益结算与内容发行',
    placeholder: '管理员账号 / 邮箱',
    loginTitle: '管理员登录',
    tipBg: 'rgba(251,191,36,0.08)', tipBorder: 'rgba(251,191,36,0.2)', tipText: 'var(--orange)', tipIcon: <Lock size={14} />,
    features: [
      { icon: <LineChart size={16} />, text: '运营看板 · 实时数据总览' },
      { icon: <Users size={16} />, text: '用户管理 · 组织与权限' },
      { icon: <Coins size={16} />, text: '收益结算 · 多平台对账' },
      { icon: <Globe size={16} />, text: '内容发行 · 全渠道管理' },
    ],
  },
  creator: {
    accent: 'var(--accent)', accent2: 'var(--accent2)', accentRgb: '129,140,248',
    title: 'AI音乐教学与版权代理平台',
    heroTitle: '创作 · 学习 · 发行\n让音乐走向世界',
    heroSub: 'AI赋能音乐创作，版权代理全球发行，开启你的音乐人生',
    placeholder: '手机号 / 邮箱',
    loginTitle: '登录',
    tipBg: '', tipBorder: '', tipText: '', tipIcon: null,
    features: [],
  },
  reviewer: {
    accent: 'var(--green)', accent2: 'var(--green)', accentRgb: '34,211,238',
    title: 'AI音乐教学与版权代理平台',
    heroTitle: '专业评审，\n发现优秀音乐作品',
    heroSub: '聆听、评分、反馈，帮助创作者成长',
    placeholder: '手机号 / 邮箱',
    loginTitle: '评审账号登录',
    tipBg: 'rgba(34,211,238,0.08)', tipBorder: 'rgba(34,211,238,0.2)', tipText: 'var(--green)', tipIcon: <Shield size={14} />,
    features: [
      { icon: <Headphones size={16} />, text: '逐曲评审 · 专业打分' },
      { icon: <BarChart3 size={16} />, text: '绩效统计 · 工作量分析' },
      { icon: <MessageSquare size={16} />, text: '评语反馈 · 指导创作者' },
    ],
  },
}

export function LoginForm({ portal }: { portal: string }) {
  const router = useRouter()
  const cfg = PORTAL_CONFIG[portal] || PORTAL_CONFIG.creator

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorCount, setErrorCount] = useState(0)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotAccount, setForgotAccount] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotPw, setForgotPw] = useState('')
  const [forgotPw2, setForgotPw2] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')

  // Register-only state (creator)
  const [inviteCode, setInviteCode] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsCountdown, setSmsCountdown] = useState(0)
  const [agreeService, setAgreeService] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMusic, setAgreeMusic] = useState(false)

  const isCreator = portal === 'creator'
  const isRegister = isCreator && mode === 'register'

  // SMS countdown timer
  useEffect(() => {
    if (smsCountdown <= 0) return
    const timer = setTimeout(() => setSmsCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [smsCountdown])

  const handleSendSms = useCallback(async () => {
    if (smsCountdown > 0 || smsSending || !account.trim()) return
    setSmsSending(true)
    try {
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account.trim(), purpose: 'register' }),
      })
      const data = await res.json()
      if (data.code === 200) {
        setSmsCountdown(60)
      } else {
        setError(data.message || '验证码发送失败')
      }
    } catch {
      setError('网络错误，发送失败')
    } finally {
      setSmsSending(false)
    }
  }, [account, smsCountdown, smsSending])

  const handleLogin = async () => {
    if (errorCount >= 5) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password, portal }),
      })
      const data = await res.json()
      if (data.code === 200) {
        const redirectMap: Record<string, string> = {
          admin: '/admin/dashboard',
          reviewer: '/review/workbench',
          creator: '/creator/home',
        }
        router.push(redirectMap[portal] || '/creator/home')
      } else {
        setErrorCount(c => c + 1)
        setError(data.message)
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!account.trim() || !password.trim() || !smsCode.trim()) {
      setError('请填写手机号、密码和验证码')
      return
    }
    if (!agreeService || !agreePrivacy) {
      setError('请同意《平台用户服务协议》和《隐私政策》')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: account.trim(),
          code: smsCode.trim(),
          password: password.trim(),
          inviteCode: inviteCode.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.code === 200) {
        // sms/verify already sets auth cookies, go directly to home
        router.push('/creator/home')
      } else {
        setError(data.message || '注册失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setError('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--bg3)',
    border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', fontSize: 14, outline: 'none',
    transition: 'border-color .2s', boxSizing: 'border-box',
  }

  return (
    <>
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 py-8">
      {/* Inner container */}
      <div className="flex flex-col lg:flex-row w-full max-w-7xl items-center justify-center gap-8 lg:gap-12 xl:gap-16">
        {/* Left: Hero */}
        <div className="hidden lg:block flex-1 max-w-xl relative">
          {/* Decorative gradient orbs */}
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: cfg.accent }} />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full opacity-10 blur-3xl" style={{ background: cfg.accent2 }} />

          <div className="relative z-10">
            <h1 className="text-3xl xl:text-4xl font-bold text-[var(--text)] leading-tight mb-3 whitespace-pre-line">
              {cfg.heroTitle}
            </h1>
            <p className="text-base text-[var(--text2)] leading-relaxed">
              {cfg.heroSub}
            </p>

            {/* Features list */}
            {cfg.features.length > 0 && (
              <div className="mt-8 flex flex-col gap-4">
                {cfg.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span style={{ color: cfg.accent, display: 'flex' }}>{f.icon}</span>
                    <span className="text-[13px] text-[var(--text2)]">{f.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Creator illustration */}
          {!cfg.features.length && (
            <div className="mt-8 relative z-10" style={{ height: 220 }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="80" fill="var(--bg3)" />
                <circle cx="80" cy="80" r="60" fill="var(--bg4)" />
                <circle cx="80" cy="80" r="42" stroke={cfg.accent} strokeWidth="1" fill="none" opacity="0.3" />
                <circle cx="80" cy="80" r="28" stroke={cfg.accent} strokeWidth="1" fill="none" opacity="0.2" />
                <circle cx="80" cy="80" r="12" fill={cfg.accent} opacity="0.6" />
              </svg>
            </div>
          )}
        </div>

        {/* Right: Login Card */}
        <div className="w-full max-w-[400px] bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,.4)]">
          {/* Logo */}
          <div className="text-center mb-5">
            <img src="/logo.svg" alt="Museek" className="mx-auto w-[180px] h-auto object-contain mb-3" />
            <div className="text-sm font-semibold text-[var(--text)]">{cfg.title}</div>
          </div>

          {/* Tab switcher (creator only) or static title */}
          {isCreator ? (
            <div className="flex mb-4 border-b border-[var(--border)]">
              {(['login', 'register'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => switchMode(tab)}
                  style={{
                    flex: 1, padding: '0 0 10px', background: 'none', border: 'none',
                    borderBottom: mode === tab ? `2px solid ${cfg.accent}` : '2px solid transparent',
                    fontSize: 14, fontWeight: mode === tab ? 500 : 400,
                    color: mode === tab ? 'var(--text)' : 'var(--text3)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {tab === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm font-semibold text-[var(--text)] mb-4 pb-3 border-b border-[var(--border)]">
              {cfg.loginTitle}
            </div>
          )}

          {/* Tip box */}
          {cfg.tipIcon && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md text-xs mb-3" style={{ background: cfg.tipBg, border: `1px solid ${cfg.tipBorder}`, color: cfg.tipText }}>
              {cfg.tipIcon}
              <span>{portal === 'admin' ? '高权限操作区域，请确认您拥有合法授权' : '账号由管理员创建，如未注册请联系管理员'}</span>
            </div>
          )}

          {/* Error banner */}
          {errorCount >= 3 && mode === 'login' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--red)]">
              <AlertTriangle size={12} /> {errorCount >= 5 ? '账号已锁定，请联系管理员' : `已连续错误 ${errorCount} 次，5次后锁定`}
            </div>
          )}

          {/* Form */}
          <div className="flex flex-col gap-3">
            <div>
              <input
                style={inputStyle}
                placeholder={isRegister ? '手机号' : cfg.placeholder}
                value={account}
                onChange={e => setAccount(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = cfg.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div className="relative">
              <input
                style={inputStyle}
                type={showPw ? 'text' : 'password'}
                placeholder="密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = cfg.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                onKeyDown={e => e.key === 'Enter' && !isRegister && handleLogin()}
              />
              <button
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)] transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Register-only fields (creator) */}
            {isRegister && (
              <>
                <div>
                  <input
                    style={inputStyle}
                    placeholder="邀请码（由管理员或班级链接获取）"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    onFocus={e => (e.currentTarget.style.borderColor = cfg.accent)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="短信验证码"
                    value={smsCode}
                    onChange={e => setSmsCode(e.target.value)}
                    onFocus={e => (e.currentTarget.style.borderColor = cfg.accent)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                  <button
                    disabled={smsCountdown > 0 || smsSending}
                    onClick={handleSendSms}
                    className="px-4 py-2 rounded-md text-[13px] font-medium text-white whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: smsCountdown > 0 || smsSending ? 'var(--text3)' : `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})` }}
                  >
                    {smsSending ? '发送中...' : smsCountdown > 0 ? `已发送(${smsCountdown}s)` : '获取验证码'}
                  </button>
                </div>

                {/* Agreement checkboxes */}
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex items-center gap-2 text-xs text-[var(--text2)] cursor-pointer">
                    <input type="checkbox" checked={agreeService} onChange={e => setAgreeService(e.target.checked)} style={{ accentColor: cfg.accent }} />
                    <span>《平台用户服务协议》<span className="text-[var(--red)]">*</span></span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--text2)] cursor-pointer">
                    <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)} style={{ accentColor: cfg.accent }} />
                    <span>《隐私政策》<span className="text-[var(--red)]">*</span></span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--text2)] cursor-pointer">
                    <input type="checkbox" checked={agreeMusic} onChange={e => setAgreeMusic(e.target.checked)} style={{ accentColor: cfg.accent }} />
                    <span>《音乐代理发行协议》</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="text-xs text-[var(--red)] mt-2">{error}</p>
          )}

          {/* Action button */}
          <button
            onClick={isRegister ? handleRegister : handleLogin}
            disabled={loading || (mode === 'login' && errorCount >= 5)}
            className="w-full py-2.5 rounded-md text-sm font-medium text-white mt-4 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})`,
              boxShadow: `0 2px 8px rgba(${cfg.accentRgb},.3)`,
            }}
          >
            {loading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册' : '登录')}
          </button>

          {/* Bottom links */}
          <div className="mt-3 text-xs">
            {isCreator && mode === 'login' ? (
              <div className="flex justify-between">
                <span style={{ color: cfg.accent, cursor: 'pointer' }} onClick={() => { setShowForgot(true); setForgotMsg('') }}>忘记密码？</span>
                <span style={{ color: cfg.accent, cursor: 'pointer' }} onClick={() => switchMode('register')}>没有账号？点击注册</span>
              </div>
            ) : isCreator && mode === 'register' ? (
              <div className="text-center">
                <span style={{ color: cfg.accent, cursor: 'pointer' }} onClick={() => switchMode('login')}>已有账号？立即登录</span>
              </div>
            ) : (
              <div className="text-center">
                {portal === 'admin' ? (
                  <span style={{ color: cfg.accent, cursor: 'pointer' }} onClick={() => alert('管理员账号无法自助重置。\n请联系超级管理员在"平台管理员"页面为你重置密码。')}>忘记密码？联系超级管理员</span>
                ) : (
                  <span style={{ color: cfg.accent, cursor: 'pointer' }} onClick={() => { setShowForgot(true); setForgotMsg('') }}>忘记密码？</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Forgot Password Modal */}
      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowForgot(false)}
        >
          <div
            className="bg-[var(--bg3)] rounded-xl border border-[var(--border)] p-6 w-[420px] max-w-[90vw] shadow-[0_12px_40px_rgba(0,0,0,.4)]"
            style={{ animation: 'modalIn .3s ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text)]">重置密码</h3>
              <button onClick={() => setShowForgot(false)} className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
                <X size={18} />
              </button>
            </div>

            {forgotMsg && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-4 ${
                forgotMsg.startsWith('✅')
                  ? 'bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] text-[var(--green2)]'
                  : 'bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--red)]'
              }`}>
                {forgotMsg.startsWith('✅') ? <CheckCircle size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                {forgotMsg.replace(/^[✅❌]\s*/, '')}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-[var(--text2)] mb-1.5 font-medium">账号 / 邮箱</label>
                <input style={inputStyle} placeholder="请输入注册时的账号或邮箱" value={forgotAccount} onChange={e => setForgotAccount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text2)] mb-1.5 font-medium">验证码</label>
                <div className="flex gap-2">
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="请输入验证码" value={forgotCode} onChange={e => setForgotCode(e.target.value)} />
                  <button
                    disabled={forgotSent}
                    className="px-4 py-2 rounded-md text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: forgotSent ? 'var(--text3)' : `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})` }}
                    onClick={async () => {
                      if (!forgotAccount) { setForgotMsg('❌ 请输入手机号'); return }
                      setForgotSent(true)
                      try {
                        const res = await fetch('/api/auth/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: forgotAccount, purpose: 'reset_password' }) })
                        const json = await res.json()
                        if (json.code === 200) { setForgotMsg('✅ 验证码已发送'); setTimeout(() => setForgotSent(false), 60000) }
                        else { setForgotMsg(`❌ ${json.message || '发送失败'}`); setForgotSent(false) }
                      } catch { setForgotMsg('❌ 网络错误'); setForgotSent(false) }
                    }}
                  >
                    {forgotSent ? '已发送' : '发送验证码'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text2)] mb-1.5 font-medium">新密码</label>
                <input style={inputStyle} type="password" placeholder="请输入新密码" value={forgotPw} onChange={e => setForgotPw(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text2)] mb-1.5 font-medium">确认密码</label>
                <input style={inputStyle} type="password" placeholder="请再次输入新密码" value={forgotPw2} onChange={e => setForgotPw2(e.target.value)} />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!forgotAccount || !forgotCode || !forgotPw || !forgotPw2) { setForgotMsg('❌ 请填写所有字段'); return }
                if (forgotPw !== forgotPw2) { setForgotMsg('❌ 两次密码不一致'); return }
                if (forgotPw.length < 8) { setForgotMsg('❌ 密码至少8位'); return }
                try {
                  const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: forgotAccount, code: forgotCode, newPassword: forgotPw }) })
                  const json = await res.json()
                  if (json.code === 200) setForgotMsg('✅ 密码重置成功，请用新密码登录')
                  else setForgotMsg(`❌ ${json.message || '重置失败'}`)
                } catch { setForgotMsg('❌ 网络错误') }
              }}
              className="w-full py-2.5 rounded-md text-sm font-medium text-white mt-4 transition-opacity hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})`, boxShadow: `0 2px 8px rgba(${cfg.accentRgb},.3)` }}
            >
              确认重置
            </button>
          </div>
        </div>
      )}
    </>
  )
}
