'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, useT } from '@/contexts/AppContext'

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useApp()
  const t = useT()

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t.passwordMismatch); return
    }

    setLoading(true)

    if (mode === 'forgot') {
      const result = await resetPassword(email)
      setLoading(false)
      if (result.error) setError(result.error)
      else setForgotSuccess(true)
      return
    }

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)

    if (result.error) setError(result.error)
    else if (mode === 'signup' && result.needsConfirmation) setSignUpSuccess(true)
  }

  function switchMode(next: 'signin' | 'signup' | 'forgot') {
    setMode(next); setError(null)
  }

  const inputClass = `
    w-full px-4 py-[14px] rounded-[12px] text-[17px] transition-colors
    focus:outline-none
  `

  const illustration = (
    <img
      src="https://www.figma.com/api/mcp/asset/08931233-4b71-4f5b-9798-90acd70ceff5"
      alt="" width={160} height={160}
      className="shrink-0"
    />
  )

  // ── Success screens ────────────────────────────────────────────────────────
  if (signUpSuccess || forgotSuccess) {
    const heading = forgotSuccess ? t.resetLinkSent : t.checkYourEmail
    const body    = forgotSuccess ? t.resetLinkSentDesc : t.checkYourEmailDesc
    return (
      <div className="min-h-screen flex flex-col items-center px-6 pt-16" style={{ backgroundColor: 'var(--bg)' }}>
        {illustration}
        <div className="mt-8 w-full max-w-[360px] flex flex-col gap-5 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
              {heading}
            </h1>
            <p className="text-[16px] leading-6" style={{ color: 'var(--label-secondary)' }}>{body}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setSignUpSuccess(false); setForgotSuccess(false); switchMode('signin') }}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {t.backToSignIn}
          </motion.button>
        </div>
      </div>
    )
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex flex-col items-center px-6 pt-16" style={{ backgroundColor: 'var(--bg)' }}>
        {illustration}
        <div className="mt-8 w-full max-w-[360px] flex flex-col gap-5">
          <div className="text-center flex flex-col gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
              {t.resetYourPassword}
            </h1>
            <p className="text-[16px] leading-6" style={{ color: 'var(--label-secondary)' }}>
              {t.resetPasswordDesc}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="email" required autoComplete="email"
                placeholder={t.email} value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                style={{ color: 'var(--label)' }}
              />
            </div>

            {error && <p className="text-[14px] px-1" style={{ color: '#FF3B30' }}>{error}</p>}

            <motion.button
              type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
              className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
            >
              {loading ? t.sendingResetLink : t.sendResetLink}
            </motion.button>
          </form>

          <button onClick={() => switchMode('signin')}
                  className="text-center text-[16px] font-medium"
                  style={{ color: 'var(--primary)' }}>
            {t.backToSignIn}
          </button>
        </div>
      </div>
    )
  }

  // ── Sign in / Sign up ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-16" style={{ backgroundColor: 'var(--bg)' }}>
      {illustration}

      <div className="mt-8 w-full max-w-[360px] flex flex-col gap-5">
        {/* Title */}
        <div className="text-center flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
            {mode === 'signin' ? t.loginTitle : t.signUpPageTitle}
          </h1>
          <p className="text-[16px] leading-6" style={{ color: 'var(--label-secondary)' }}>
            {mode === 'signin' ? t.loginSubtitle : t.signUpPageSubtitle}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <input
              type="email" required autoComplete="email"
              placeholder={t.email} value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
              style={{ color: 'var(--label)', borderBottom: '1px solid var(--separator)' }}
            />
            <input
              type="password" required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={t.password} value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              style={{ color: 'var(--label)', borderBottom: mode === 'signup' ? '1px solid var(--separator)' : undefined }}
            />
            {mode === 'signup' && (
              <input
                type="password" required autoComplete="new-password"
                placeholder={t.confirmPassword} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={inputClass}
                style={{ color: 'var(--label)' }}
              />
            )}
          </div>

          {/* Forgot password link (signin only) */}
          {mode === 'signin' && (
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={() => switchMode('forgot')}
                      className="text-[15px] font-medium" style={{ color: 'var(--primary)' }}>
                {t.forgotPassword}
              </button>
            </div>
          )}

          {error && <p className="text-[14px] px-1" style={{ color: '#FF3B30' }}>{error}</p>}

          <motion.button
            type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {loading
              ? (mode === 'signin' ? t.signingIn : t.signingUp)
              : (mode === 'signin' ? t.logIn : t.signUp)
            }
          </motion.button>
        </form>

        {/* Mode toggle */}
        <p className="text-center text-[15px]" style={{ color: 'var(--label-secondary)' }}>
          {mode === 'signin' ? t.noAccount : t.haveAccount}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-semibold"
            style={{ color: 'var(--primary)' }}
          >
            {mode === 'signin' ? t.signUp : t.signIn}
          </button>
        </p>
      </div>
    </div>
  )
}
