'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { getPagePassword, passwordSessionToken } from '@/lib/passwords'

interface AuthGuardProps {
  pageKey: string
  children: React.ReactNode
  title?: string
  subtitle?: string
  accentColor?: string
}

export default function AuthGuard({
  pageKey, children,
  title = 'BIGGAME 2025', subtitle = 'Enter access code',
  accentColor = '#3b82f6',
}: AuthGuardProps) {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [passwordReady, setPasswordReady] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    getPagePassword(pageKey)
      .then(async password => {
        if (cancelled) return
        setPasswordReady(Boolean(password))
        if (password && sessionStorage.getItem(`auth_${pageKey}`) === await passwordSessionToken(pageKey, password)) setAuthed(true)
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) setPasswordReady(false)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [pageKey])

  if (checking) return (
    <div className="min-h-screen app-shell flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )
  if (authed) return <>{children}</>

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const expectedPassword = await getPagePassword(pageKey, true)
    setPasswordReady(Boolean(expectedPassword))
    if (expectedPassword && input === expectedPassword) {
      sessionStorage.setItem(`auth_${pageKey}`, await passwordSessionToken(pageKey, expectedPassword))
      setAuthed(true)
    } else {
      setError(true); setShake(true)
      setTimeout(() => { setError(false); setInput('') }, 1800)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="auth-page min-h-screen app-shell flex items-center justify-center px-4 py-6">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full blur-[100px]"
          style={{ background: accentColor + '18' }}
        />
      </div>

      <div
        className={`auth-card relative z-10 w-full max-w-[22rem] content-card compact-auth-card p-5 sm:p-6
          transition-all duration-150 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
        style={{ borderColor: error ? 'rgba(239,68,68,0.42)' : undefined }}
      >
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border bg-white"
          style={{ borderColor: accentColor + '40', boxShadow: `0 14px 34px ${accentColor}2f` }}
        >
          <Lock size={20} style={{ color: accentColor }} />
        </div>

        <div className="mb-6 text-center">
          <h1 className="font-display mb-1.5 text-2xl font-black text-slate-950">{title}</h1>
          <p className="text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="รหัสผ่าน"
            autoFocus
            className={`input-base text-center font-mono text-base tracking-[0.25em]
              ${error ? 'border-red-500/50 bg-red-50 text-red-500' : ''}`}
          />

          {error && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-red-500">
              <span>!</span> รหัสไม่ถูกต้อง กรุณาลองใหม่
            </p>
          )}

          <button
            type="submit"
            disabled={!passwordReady}
            className="btn btn-primary w-full"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: `0 14px 30px ${accentColor}30`,
            }}
          >
            {passwordReady ? 'เข้าสู่ระบบ' : 'Loading password...'}
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
