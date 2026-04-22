'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Music, Headphones, Shield, Users, Coins, Globe, LineChart, Lock, AlertTriangle, CheckCircle, MessageSquare, BarChart3, Eye, EyeOff, X } from 'lucide-react'

/* ── Portal theme config ── */
const PORTAL_CONFIG: Record<string, {
  accent: string; accent2: string; accentRgb: string
  bg: string; shadow: string; decorDot: string
  logo: ReactNode; logoGrad: string
  title: string; subtitle: string
  heroTitle: string; heroSub: string
  placeholder: string; loginTitle: string
  tipBg: string; tipBorder: string; tipText: string; tipIcon: ReactNode
  features: { icon: ReactNode; text: string }[]
}> = {
  admin: {
    accent: '#fbbf24', accent2: '#f59e0b', accentRgb: '251,191,36',
    bg: 'linear-gradient(140deg, #0a0a14 0%, #14142a 40%, #1a1208 70%, #0a0a14 100%)',
    shadow: '0 8px 40px rgba(251,191,36,.1), 0 2px 8px rgba(0,0,0,.4)',
    decorDot: '#fbbf24', logo: <Settings size={24} />,
    logoGrad: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    title: 'AI音乐教学与版权代理平台',
    subtitle: '管理端 · 平台运营管理后台',
    heroTitle: '智慧中枢，\n驱动平台增长',
    heroSub: '全面掌控平台运营、用户管理、收益结算与内容发行',
    placeholder: '管理员账号 / 邮箱',
    loginTitle: '管理员登录',
    tipBg: 'rgba(251,191,36,0.08)', tipBorder: 'rgba(251,191,36,0.25)', tipText: '#fbbf24', tipIcon: <Lock size={14} />,
    features: [
      { icon: <LineChart size={18} />, text: '运营看板 · 实时数据总览' },
      { icon: <Users size={18} />, text: '用户管理 · 组织与权限' },
      { icon: <Coins size={18} />, text: '收益结算 · 多平台对账' },
      { icon: <Globe size={18} />, text: '内容发行 · 全渠道管理' },
    ],
  },
  creator: {
    accent: '#818cf8', accent2: '#6366f1', accentRgb: '129,140,248',
    bg: 'linear-gradient(140deg, #0a0a14 0%, #12122a 40%, #0e1028 70%, #0a0a14 100%)',
    shadow: '0 8px 40px rgba(129,140,248,.12), 0 2px 8px rgba(0,0,0,.4)',
    decorDot: '#818cf8', logo: <Music size={24} />,
    logoGrad: 'linear-gradient(135deg, #f97316, #ef4444)',
    title: 'AI音乐教学与版权代理平台',
    subtitle: '创作者端 · 创作 · 学习 · 发行 · 收益',
    heroTitle: '创作 · 学习 · 发行\n让音乐走向世界',
    heroSub: 'AI赋能音乐创作，版权代理全球发行，开启你的音乐人生',
    placeholder: '手机号 / 邮箱',
    loginTitle: '登录',
    tipBg: '', tipBorder: '', tipText: '', tipIcon: null,
    features: [],
  },
  reviewer: {
    accent: '#22d3ee', accent2: '#06b6d4', accentRgb: '34,211,238',
    bg: 'linear-gradient(140deg, #0a0a14 0%, #0a1420 40%, #0e1a28 70%, #0a0a14 100%)',
    shadow: '0 8px 40px rgba(34,211,238,.1), 0 2px 8px rgba(0,0,0,.4)',
    decorDot: '#22d3ee', logo: <Headphones size={24} />,
    logoGrad: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
    title: 'AI音乐教学与版权代理平台',
    subtitle: '评审端 · 专业评审工作台',
    heroTitle: '专业评审，\n发现优秀音乐作品',
    heroSub: '聆听、评分、反馈，帮助创作者成长',
    placeholder: '手机号 / 邮箱',
    loginTitle: '评审账号登录',
    tipBg: 'rgba(34,211,238,0.08)', tipBorder: 'rgba(34,211,238,0.25)', tipText: '#22d3ee', tipIcon: <Shield size={14} />,
    features: [
      { icon: <Headphones size={18} />, text: '逐曲评审 · 专业打分' },
      { icon: <BarChart3 size={18} />, text: '绩效统计 · 工作量分析' },
      { icon: <MessageSquare size={18} />, text: '评语反馈 · 指导创作者' },
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
    width: '100%', padding: '11px 14px', background: 'var(--bg3)',
    border: '1.5px solid var(--border)', borderRadius: 9,
    color: 'var(--text)', fontSize: 14, outline: 'none',
    transition: 'border-color .2s', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: cfg.bg }} className="flex items-stretch justify-center">
      <div className="flex w-full max-w-[1200px]">
      {/* ── Left Hero ── */}
      <div style={{ flex: '1 1 56%', padding: '56px 56px 40px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Dot grid */}
        <div style={{ position: 'absolute', top: 38, left: 38, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, opacity: 0.45 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.decorDot }} />
          ))}
        </div>

        <h1 style={{ fontSize: 44, fontWeight: 900, color: 'var(--text)', lineHeight: 1.22, marginBottom: 14, letterSpacing: -0.5, whiteSpace: 'pre-line' }}>
          {cfg.heroTitle}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.65 }}>
          {cfg.heroSub}
        </p>

        {/* Features list (admin & reviewer) or illustration (creator) */}
        {cfg.features.length > 0 ? (
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cfg.features.map((f, i) => (
              <div key={i} style={{
                padding: '12px 16px', background: 'rgba(26,26,46,0.65)', borderRadius: 12,
                backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.12)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ color: cfg.accent, display: 'flex' }}>{f.icon}</span>
                <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Creator illustration */
          <div style={{ height: 290, marginTop: 24, position: 'relative' }}>
            <svg width="172" height="172" viewBox="0 0 172 172" style={{ position: 'absolute', left: 40, top: 20 }}>
              <circle cx="86" cy="86" r="86" fill="#1a1a2e" />
              <circle cx="86" cy="86" r="68" fill="#222240" />
              <circle cx="86" cy="86" r="50" stroke={cfg.accent} strokeWidth="1" fill="none" opacity="0.4" />
              <circle cx="86" cy="86" r="35" stroke={cfg.accent} strokeWidth="1" fill="none" opacity="0.3" />
              <circle cx="86" cy="86" r="15" fill={cfg.accent} />
              <circle cx="86" cy="86" r="5" fill="var(--text)" />
            </svg>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: 'absolute', right: 80, bottom: 20, opacity: 0.3 }}>
              <circle cx="40" cy="40" r="30" fill="none" stroke={cfg.accent} strokeWidth="1.5" />
              <circle cx="40" cy="40" r="15" fill="none" stroke={cfg.accent} strokeWidth="1" />
            </svg>
            <div style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 8, opacity: 0.4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.accent }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: cfg.accent }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.accent }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Right Card ── */}
      <div style={{ flex: '0 0 42%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 44px' }}>
        <div style={{ width: '100%', maxWidth: 336, background: 'var(--bg3)', borderRadius: 18, padding: '28px 26px', boxShadow: cfg.shadow }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 24,
              background: cfg.logoGrad, marginBottom: 10,
            }}>
              {cfg.logo}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{cfg.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{cfg.subtitle}</div>
          </div>

          {/* Tab switcher (creator only) or static title */}
          {isCreator ? (
            <div style={{ display: 'flex', marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
              {(['login', 'register'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => switchMode(tab)}
                  style={{
                    flex: 1, padding: '0 0 12px', background: 'none', border: 'none',
                    borderBottom: mode === tab ? `2px solid ${cfg.accent}` : '2px solid transparent',
                    fontSize: 15, fontWeight: mode === tab ? 600 : 400,
                    color: mode === tab ? 'var(--text)' : 'var(--text3)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {tab === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              {cfg.loginTitle}
            </div>
          )}

          {/* Tip box */}
          {cfg.tipIcon && (
            <div style={{
              padding: '7px 10px', background: cfg.tipBg, border: `1px solid ${cfg.tipBorder}`,
              borderRadius: 7, marginBottom: 10, fontSize: 12, color: cfg.tipText,
            }}>
              {cfg.tipIcon} {portal === 'admin' ? '高权限操作区域，请确认您拥有合法授权' : '账号由管理员创建，如未注册请联系管理员'}
            </div>
          )}

          {/* Error banner — only show lock warning in login mode */}
          {errorCount >= 3 && mode === 'login' && (
            <div style={{
              padding: '7px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 7, marginBottom: 10, fontSize: 12, color: 'var(--red)',
            }}>
              ⚠️ {errorCount >= 5 ? '账号已锁定，请联系管理员' : `已连续错误 ${errorCount} 次，5次后锁定`}
            </div>
          )}

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            <div style={{ position: 'relative' }}>
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
                style={{
                  position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', fontSize: 14, color: 'var(--text3)', cursor: 'pointer',
                }}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                <div style={{ display: 'flex', gap: 8 }}>
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
                    style={{
                      flexShrink: 0, padding: '0 14px', border: 'none', borderRadius: 9,
                      fontSize: 13, fontWeight: 500, color: '#fff', cursor: smsCountdown > 0 || smsSending ? 'not-allowed' : 'pointer',
                      background: smsCountdown > 0 || smsSending ? 'var(--text3)' : `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {smsSending ? '发送中...' : smsCountdown > 0 ? `已发送(${smsCountdown}s)` : '获取验证码'}
                  </button>
                </div>

                {/* Agreement checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreeService} onChange={e => setAgreeService(e.target.checked)} style={{ accentColor: cfg.accent }} />
                    <span>《平台用户服务协议》<span style={{ color: 'var(--red)' }}>*</span></span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)} style={{ accentColor: cfg.accent }} />
                    <span>《隐私政策》<span style={{ color: 'var(--red)' }}>*</span></span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreeMusic} onChange={e => setAgreeMusic(e.target.checked)} style={{ accentColor: cfg.accent }} />
                    <span>《音乐代理发行协议》</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{error}</p>
          )}

          {/* Action button */}
          <button
            onClick={isRegister ? handleRegister : handleLogin}
            disabled={loading || (mode === 'login' && errorCount >= 5)}
            style={{
              width: '100%', marginTop: 14, padding: 13, border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})`,
              boxShadow: `0 4px 16px rgba(${cfg.accentRgb},.35)`,
              opacity: loading || (mode === 'login' && errorCount >= 5) ? 0.6 : 1,
              transition: 'transform .15s, opacity .2s',
            }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseOut={e => { e.currentTarget.style.transform = '' }}
          >
            {loading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册' : '登录')}
          </button>

          {/* Bottom links */}
          <div style={{ marginTop: 12, fontSize: 12 }}>
            {isCreator && mode === 'login' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span
                  style={{ color: cfg.accent, cursor: 'pointer' }}
                  onClick={() => { setShowForgot(true); setForgotMsg('') }}
                >
                  忘记密码？
                </span>
                <span
                  style={{ color: cfg.accent, cursor: 'pointer' }}
                  onClick={() => switchMode('register')}
                >
                  没有账号？点击注册
                </span>
              </div>
            ) : isCreator && mode === 'register' ? (
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{ color: cfg.accent, cursor: 'pointer' }}
                  onClick={() => switchMode('login')}
                >
                  已有账号？立即登录
                </span>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                {portal === 'admin' ? (
                  <span
                    style={{ color: cfg.accent, cursor: 'pointer' }}
                    onClick={() => alert('管理员账号无法自助重置。\n请联系超级管理员在"平台管理员"页面为你重置密码。')}
                  >
                    忘记密码？联系超级管理员
                  </span>
                ) : (
                  <span
                    style={{ color: cfg.accent, cursor: 'pointer' }}
                    onClick={() => { setShowForgot(true); setForgotMsg('') }}
                  >
                    忘记密码？
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.25)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowForgot(false)}
        >
          <div
            style={{ background: 'var(--bg3)', borderRadius: 16, padding: 28, width: 440, maxWidth: '90vw', animation: 'modalIn .3s ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>重置密码</h3>
              <button onClick={() => setShowForgot(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="关闭">
                <X className="w-4 h-4 text-[var(--text3)]" />
              </button>
            </div>

            {forgotMsg && (
              <div style={{ padding: '8px 12px', background: forgotMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${forgotMsg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, marginBottom: 14, fontSize: 13, color: forgotMsg.startsWith('✅') ? 'var(--green2)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {forgotMsg.startsWith('✅') ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                {forgotMsg.replace(/^[✅❌]\s*/, '')}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>账号 / 邮箱</label>
                <input style={inputStyle} placeholder="请输入注册时的账号或邮箱" value={forgotAccount} onChange={e => setForgotAccount(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>验证码</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="请输入验证码" value={forgotCode} onChange={e => setForgotCode(e.target.value)} />
                  <button
                    disabled={forgotSent}
                    onClick={async () => {
                      if (!forgotAccount) { setForgotMsg('❌ 请输入手机号'); return }
                      setForgotSent(true)
                      try {
                        const res = await fetch('/api/auth/sms/send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: forgotAccount, purpose: 'reset_password' }),
                        })
                        const json = await res.json()
                        if (json.code === 200) {
                          setForgotMsg('✅ 验证码已发送')
                          setTimeout(() => setForgotSent(false), 60000)
                        } else {
                          setForgotMsg(`❌ ${json.message || '发送失败'}`)
                          setForgotSent(false)
                        }
                      } catch {
                        setForgotMsg('❌ 网络错误')
                        setForgotSent(false)
                      }
                    }}
                    style={{
                      flexShrink: 0, padding: '0 16px', border: 'none', borderRadius: 9,
                      fontSize: 13, fontWeight: 500, color: '#fff', cursor: forgotSent ? 'not-allowed' : 'pointer',
                      background: forgotSent ? 'var(--text3)' : `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})`,
                    }}
                  >
                    {forgotSent ? '已发送' : '发送验证码'}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>新密码</label>
                <input style={inputStyle} type="password" placeholder="请输入新密码" value={forgotPw} onChange={e => setForgotPw(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>确认密码</label>
                <input style={inputStyle} type="password" placeholder="请再次输入新密码" value={forgotPw2} onChange={e => setForgotPw2(e.target.value)} />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!forgotAccount || !forgotCode || !forgotPw || !forgotPw2) { setForgotMsg('❌ 请填写所有字段'); return }
                if (forgotPw !== forgotPw2) { setForgotMsg('❌ 两次密码不一致'); return }
                if (forgotPw.length < 8) { setForgotMsg('❌ 密码至少8位'); return }
                try {
                  const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: forgotAccount, code: forgotCode, newPassword: forgotPw }),
                  })
                  const json = await res.json()
                  if (json.code === 200) {
                    setForgotMsg('✅ 密码重置成功，请用新密码登录')
                  } else {
                    setForgotMsg(`❌ ${json.message || '重置失败'}`)
                  }
                } catch {
                  setForgotMsg('❌ 网络错误')
                }
              }}
              style={{
                width: '100%', marginTop: 16, padding: 13, border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer',
                background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent2})`,
                boxShadow: `0 4px 16px rgba(${cfg.accentRgb},.35)`,
              }}
            >
              确认重置
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
