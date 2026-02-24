'use client'

import { useState } from 'react'
import { useApp, useT } from '@/contexts/AppContext'

export default function LoginPage() {
  const { signIn, signUp } = useApp()
  const t = useT()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    setLoading(true)
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup' && result.needsConfirmation) {
      setSignUpSuccess(true)
    }
  }

  const inputClass = `
    w-full h-[60px] px-4 rounded-xl
    border-2 border-[rgba(23,23,23,0.16)]
    bg-white text-[#171717] text-[16px] leading-6
    placeholder:text-[rgba(23,23,23,0.45)]
    focus:outline-none focus:border-[rgba(23,23,23,0.4)]
    transition-colors
  `

  // ── Check your email screen ────────────────────────────────────────────────
  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center px-8 pt-5">
        <img
          src="https://www.figma.com/api/mcp/asset/08931233-4b71-4f5b-9798-90acd70ceff5"
          alt=""
          width={200}
          height={200}
          className="shrink-0"
        />
        <div className="flex flex-col gap-6 w-full max-w-[329px] mt-6">
          <div className="flex flex-col gap-[9px] text-center">
            <h1 className="text-[24px] font-black text-[#171717] leading-8">{t.checkYourEmail}</h1>
            <p className="text-[16px] text-[rgba(23,23,23,0.56)] leading-6">{t.checkYourEmailDesc}</p>
          </div>
          <button
            onClick={() => { setSignUpSuccess(false); setMode('signin') }}
            className="w-full py-4 rounded-full text-white text-[16px] font-bold"
            style={{
              backgroundColor: 'var(--primary)',
              boxShadow: '0px 6px 14px -12px rgba(22,10,157,0.32)',
            }}
          >
            {t.backToSignIn}
          </button>
        </div>
      </div>
    )
  }

  // ── Sign in / Sign up ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center px-8 pt-5">

      {/* Illustration */}
      <img
        src="https://www.figma.com/api/mcp/asset/08931233-4b71-4f5b-9798-90acd70ceff5"
        alt=""
        width={200}
        height={200}
        className="shrink-0"
      />

      {/* Content */}
      <div className="flex flex-col gap-6 w-full max-w-[329px] mt-6">

        {/* Title + subtitle */}
        <div className="flex flex-col gap-[9px] text-center text-[#171717]">
          <h1 className="text-[24px] font-black leading-8">
            {mode === 'signin' ? t.loginTitle : t.signUpPageTitle}
          </h1>
          <p className="text-[16px] leading-6">
            {mode === 'signin' ? t.loginSubtitle : t.signUpPageSubtitle}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t.email}
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={t.password}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputClass}
          />
          {mode === 'signup' && (
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder={t.confirmPassword}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          )}

          {error && (
            <p className="text-red-500 text-[14px] leading-5 px-1 pt-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 rounded-full text-white text-[16px] font-bold disabled:opacity-60 transition-opacity"
            style={{
              backgroundColor: 'var(--primary)',
              boxShadow: '0px 6px 14px -12px rgba(22,10,157,0.32)',
            }}
          >
            {loading
              ? (mode === 'signin' ? t.signingIn : t.signingUp)
              : (mode === 'signin' ? t.logIn : t.signUp)
            }
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-[16px] text-[#171717]">
          {mode === 'signin' ? t.noAccount : t.haveAccount}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="font-bold text-[#171717]"
          >
            {mode === 'signin' ? t.signUp : t.signIn}
          </button>
        </p>

      </div>
    </div>
  )
}
