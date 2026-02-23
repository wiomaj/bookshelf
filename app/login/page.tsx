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
    } else if (mode === 'signup') {
      setSignUpSuccess(true)
    }
  }

  const inputClass = `
    w-full px-4 py-3 rounded-2xl border border-[rgba(23,23,23,0.12)]
    bg-white text-[#171717] text-[16px] leading-6
    placeholder:text-[rgba(23,23,23,0.35)]
    focus:outline-none focus:border-[rgba(23,23,23,0.4)]
    transition-colors
  `

  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-[361px] flex flex-col gap-6 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-[#171717] text-[32px] font-black leading-8">{t.checkYourEmail}</h1>
            <p className="text-[rgba(23,23,23,0.56)] text-[16px] leading-6">
              {t.checkYourEmailDesc}
            </p>
          </div>
          <button
            onClick={() => { setSignUpSuccess(false); setMode('signin') }}
            className="w-full py-4 rounded-full text-white text-[16px] font-bold"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {t.backToSignIn}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[361px] flex flex-col gap-8">

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[#171717] text-[32px] font-black leading-8">
            {mode === 'signin' ? t.signIn : t.signUp}
          </h1>
          <p className="text-[rgba(23,23,23,0.56)] text-[16px] leading-6">
            My Bookshelf
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            <p className="text-red-500 text-[14px] leading-5 px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-1 rounded-full text-white text-[16px] font-bold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {loading
              ? (mode === 'signin' ? t.signingIn : t.signingUp)
              : (mode === 'signin' ? t.signIn : t.signUp)
            }
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-[15px] text-[rgba(23,23,23,0.56)]">
          {mode === 'signin' ? t.noAccount : t.haveAccount}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSignUpSuccess(false) }}
            className="font-bold underline text-[#171717]"
          >
            {mode === 'signin' ? t.signUp : t.signIn}
          </button>
        </p>
      </div>
    </div>
  )
}
