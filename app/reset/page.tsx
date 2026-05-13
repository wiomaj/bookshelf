'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useT } from '@/contexts/AppContext'

function ResetContent() {
  const t = useT()
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Implicit flow: Supabase redirects with #access_token=...&type=recovery
    // in the hash. The client detects this automatically and fires
    // PASSWORD_RECOVERY. We also check the existing session in case the
    // event already fired before this component mounted.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('ready')
      } else {
        // Give the hash-fragment a moment to be processed
        const timer = setTimeout(() => setStatus('invalid'), 2000)
        return () => clearTimeout(timer)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) { setError(t.passwordMismatch); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message) } else {
      await supabase.auth.signOut()
      setStatus('success')
    }
  }

  const inputClass = `
    w-full px-4 py-[14px] rounded-[12px] text-[17px] transition-colors focus:outline-none
  `

  const illustration = (
    <img src="/login-cat.png"
         alt="" width={160} height={160} className="shrink-0" />
  )

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-black/10 rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center px-6 pt-16" style={{ backgroundColor: 'var(--bg)' }}>
        {illustration}
        <div className="mt-8 w-full max-w-[360px] flex flex-col gap-5 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
              {t.resetYourPassword}
            </h1>
            <p className="text-[15px] leading-5" style={{ color: '#FF3B30' }}>
              This reset link is invalid or has expired. Please request a new one.
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => router.replace('/login')}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}>
            {t.backToSignIn}
          </motion.button>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center px-6 pt-16" style={{ backgroundColor: 'var(--bg)' }}>
        {illustration}
        <div className="mt-8 w-full max-w-[360px] flex flex-col gap-5 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
              {t.setNewPassword}
            </h1>
            <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>
              {t.passwordResetSuccess}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => router.replace('/login')}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}>
            {t.backToSignIn}
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-16" style={{ backgroundColor: 'var(--bg)' }}>
      {illustration}
      <div className="mt-8 w-full max-w-[360px] flex flex-col gap-5">
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
            {t.setNewPassword}
          </h1>
          <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>
            {t.setNewPasswordDesc}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <input type="password" required autoComplete="new-password"
                   placeholder={t.newPassword} value={password}
                   onChange={e => setPassword(e.target.value)}
                   className={inputClass}
                   style={{ color: 'var(--label)', borderBottom: '1px solid var(--separator)' }} />
            <input type="password" required autoComplete="new-password"
                   placeholder={t.confirmNewPassword} value={confirmPassword}
                   onChange={e => setConfirmPassword(e.target.value)}
                   className={inputClass}
                   style={{ color: 'var(--label)' }} />
          </div>

          {error && <p className="text-[14px] px-1" style={{ color: '#FF3B30' }}>{error}</p>}

          <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}>
            {loading ? t.savingPassword : t.savePassword}
          </motion.button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-black/10 rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    }>
      <ResetContent />
    </Suspense>
  )
}
