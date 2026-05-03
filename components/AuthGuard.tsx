'use client'
import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'

interface AuthGuardProps {
  pageKey:          string
  expectedPassword: string
  children:         React.ReactNode
  title?:           string
  subtitle?:        string
  accentColor?:     string
}

export default function AuthGuard({
  pageKey, expectedPassword, children,
  title = 'BIGGAME 2025', subtitle = 'Enter access code',
  accentColor = '#3b82f6',
}: AuthGuardProps) {
  const [authed,   setAuthed]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [input,    setInput]    = useState('')
  const [error,    setError]    = useState(false)
  const [shake,    setShake]    = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(`auth_${pageKey}`) === expectedPassword) setAuthed(true)
    setChecking(false)
  }, [pageKey, expectedPassword])

  if (checking) return (
    <div className="min-h-screen app-shell flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (authed) return <>{children}</>

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input === expectedPassword) {
      sessionStorage.setItem(`auth_${pageKey}`, input)
      setAuthed(true)
    } else {
      setError(true); setShake(true)
      setTimeout(() => { setError(false); setInput('') }, 1800)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="auth-page min-h-screen app-shell flex items-center justify-center px-4 py-6">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[100px]"
          style={{ background: accentColor + '12' }} />
      </div>

      <div
        className={`auth-card relative z-10 w-full max-w-[22rem] content-card compact-auth-card p-5 sm:p-6
          transition-all duration-150 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
        style={{ borderColor: error ? 'rgba(239,68,68,0.3)' : undefined }}
      >
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl glass-light flex items-center justify-center mb-4 mx-auto"
          style={{ boxShadow: `0 0 20px ${accentColor}30` }}>
          <Lock size={20} style={{ color: accentColor }} />
        </div>

        {/* Text */}
        <div className="text-center mb-5">
          <h1 className="font-display font-bold text-xl text-white mb-1.5">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="รหัสผ่าน"
            autoFocus
            className={`input-base text-center font-mono tracking-[0.25em] text-base
              ${error ? 'border-red-500/50 bg-red-500/8 text-red-400' : ''}`}
          />

          {error && (
            <p className="text-center text-xs text-red-400 flex items-center justify-center gap-1.5">
              <span>⚠</span> รหัสไม่ถูกต้อง กรุณาลองใหม่
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: `0 0 20px ${accentColor}30`,
            }}>
            เข้าสู่ระบบ
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
