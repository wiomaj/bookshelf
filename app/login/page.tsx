'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, useT } from '@/contexts/AppContext'
import { LANGUAGES, type Locale } from '@/lib/translations'

/* ── Promotional content shown below the login form ──────────────────────── */

function FeatureSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center flex flex-col gap-2 px-4 w-full max-w-[329px]">
      <h2 className="text-[22px] font-bold tracking-[-0.26px] leading-[28px]" style={{ color: 'var(--label)' }}>
        {title}
      </h2>
      <p className="text-[16px] leading-6" style={{ color: 'var(--label-secondary)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function MockDashboard() {
  const bookPlaceholder = (color: string) => (
    <div
      className="w-[80px] h-[100px] rounded-[12px] shrink-0 flex items-center justify-center"
      style={{
        backgroundColor: color,
        boxShadow: '0 16px 32px -4px rgba(12,12,13,0.1), 0 4px 4px -4px rgba(12,12,13,0.05)',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity={0.15}>
        <path d="M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" fill="white" />
      </svg>
    </div>
  )

  const starRow = (
    <div className="flex gap-[1px]">
      {[1, 2, 3, 4].map(i => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.8 5L8 12.4 3.6 14.7l.8-5L.8 6.2l5-.7L8 1z" fill="#FFB800" />
        </svg>
      ))}
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.8 5L8 12.4 3.6 14.7l.8-5L.8 6.2l5-.7L8 1z" fill="#E0E0E0" />
      </svg>
    </div>
  )

  const bookRow = (month: string, title: string, author: string, bgColor: string) => (
    <div className="flex gap-4 items-center w-full">
      {bookPlaceholder(bgColor)}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="text-[11px] leading-[13px] tracking-[0.06px]" style={{ color: 'var(--label-secondary)' }}>{month}</span>
        <span className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px] truncate" style={{ color: 'var(--label)' }}>{title}</span>
        <span className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-secondary)' }}>{author}</span>
        {starRow}
      </div>
    </div>
  )

  return (
    <div
      className="w-[339px] rounded-t-[16px] overflow-hidden"
      style={{
        backgroundColor: '#f2f2f7',
        boxShadow: '0 4px 40px rgba(0,0,0,0.1)',
        height: 454,
        borderLeft: '10px solid var(--label)',
        borderRight: '10px solid var(--label)',
        borderTop: '10px solid var(--label)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-[22px] font-bold tracking-[-0.26px] leading-[28px]" style={{ color: 'var(--label)' }}>
          Bookshelf
        </span>
        <div className="flex items-center gap-2">
          <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-[15px]" style={{ backgroundColor: 'var(--primary)' }}>
            +
          </div>
          <div className="flex h-8 rounded-full overflow-hidden p-[2px]" style={{ backgroundColor: 'var(--fill)' }}>
            <div className="flex items-center justify-center px-3 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
                <rect x="1" y="9" width="4" height="4" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
                <rect x="9" y="1" width="4" height="4" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
                <rect x="9" y="9" width="4" height="4" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
              </svg>
            </div>
            <div className="flex items-center justify-center px-3">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
                <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
                <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor" style={{ color: 'var(--label)' }} />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented control */}
      <div className="px-3 pb-3">
        <div className="flex h-8 rounded-full p-[2px]" style={{ backgroundColor: 'var(--fill)' }}>
          <div className="flex-1 flex items-center justify-center rounded-full text-[13px] font-semibold" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--label)' }}>
            Read
          </div>
          <div className="flex-1 flex items-center justify-center text-[13px] font-medium" style={{ color: 'var(--label)' }}>
            To Read (15)
          </div>
          <div className="flex-1 flex items-center justify-center text-[13px] font-medium" style={{ color: 'var(--label)' }}>
            Wishlist (8)
          </div>
        </div>
      </div>

      {/* Year header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-[12px]" style={{ color: 'var(--label)' }}>
          <span className="font-bold">2026 </span>
          <span style={{ color: 'var(--label-secondary)' }}>8 BOOKS</span>
        </p>
      </div>

      {/* Book list */}
      <div className="flex flex-col gap-3 px-4">
        {bookRow('March', 'The Great Gatsby', 'F. Scott Fitzgerald', '#4A90D9')}
        {bookRow('January', 'Atomic Habits', 'James Clear', '#D94A4A')}
        {bookRow('January', 'Project Hail Mary', 'Andy Weir', '#4AD97A')}
      </div>
    </div>
  )
}

function ReadingSpeedChart({ t }: { t: ReturnType<typeof useT> }) {
  const months = [
    { label: 'J', count: 2 },
    { label: 'F', count: 0 },
    { label: 'M', count: 0 },
    { label: 'A', count: 0 },
    { label: 'M', count: 2 },
    { label: 'J', count: 1 },
    { label: 'J', count: 3 },
    { label: 'A', count: 0 },
    { label: 'S', count: 0 },
    { label: 'O', count: 0 },
    { label: 'N', count: 0 },
    { label: 'D', count: 1 },
  ]
  const maxCount = 3

  return (
    <div
      className="w-[340px] rounded-[16px] p-4 flex flex-col gap-5"
      style={{ backgroundColor: '#f2f2f7', boxShadow: '0 12px 20px rgba(0,0,0,0.05)' }}
    >
      <div className="flex flex-col gap-[2px]">
        <h3 className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px]" style={{ color: 'var(--label)' }}>
          {t.promoReadingSpeed}
        </h3>
        <p className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-secondary)' }}>
          {t.promoReadingSpeedSub}
        </p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-bold leading-[34px] tracking-[0.38px]" style={{ color: 'var(--label)' }}>11</span>
        <span className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-secondary)' }}>{t.promoBooks}</span>
      </div>

      <div className="flex flex-col gap-2 items-end">
        <div className="flex gap-1 items-end w-full">
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1 items-center">
              {m.count > 0 && (
                <span className="text-[11px] font-semibold leading-[13px]" style={{ color: 'var(--label)' }}>
                  {m.count}
                </span>
              )}
              <div
                className="w-full rounded-[4px]"
                style={{
                  height: m.count > 0 ? Math.max(24, (m.count / maxCount) * 69) : 3,
                  backgroundColor: m.count > 0 ? '#0088FF' : 'rgba(120,120,128,0.16)',
                }}
              />
              <span className="text-[11px] leading-[13px] tracking-[0.06px]" style={{ color: 'var(--label-secondary)' }}>
                {m.label}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[11px] leading-[13px] tracking-[0.06px]" style={{ color: 'var(--label-secondary)' }}>
          {t.promoWithoutMonth}
        </span>
      </div>
    </div>
  )
}

function RatingsCard({ t }: { t: ReturnType<typeof useT> }) {
  const ratings = [
    { stars: 5, count: 2, barWidth: 47 },
    { stars: 4, count: 3, barWidth: 94 },
    { stars: 3, count: 0, barWidth: 5 },
    { stars: 2, count: 4, barWidth: 120 },
    { stars: 1, count: 1, barWidth: 16 },
  ]

  const filledStar = (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2l2.9 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 6 21l1.2-6.8-5-4.9 6.9-1L12 2z" fill="#FFB800" />
    </svg>
  )
  const emptyStar = (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2l2.9 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 6 21l1.2-6.8-5-4.9 6.9-1L12 2z" fill="#E0E0E0" />
    </svg>
  )

  return (
    <div
      className="w-[340px] rounded-[16px] p-4 flex flex-col gap-5"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
      }}
    >
      <div className="flex flex-col gap-[2px]">
        <h3 className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px]" style={{ color: 'var(--label)' }}>
          {t.promoMyRatings}
        </h3>
        <p className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-secondary)' }}>
          {t.promoMyRatingsSub}
        </p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-bold leading-[34px] tracking-[0.38px]" style={{ color: 'var(--label)' }}>3.1</span>
        <span className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-secondary)' }}>{t.promoAverageRating}</span>
      </div>

      <div className="flex gap-4 items-center">
        {/* Star rows */}
        <div className="flex flex-col gap-1 w-[120px] shrink-0">
          {ratings.map((r, i) => (
            <div key={i} className="flex h-6">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="flex-1">
                  {j < (5 - i) ? filledStar : emptyStar}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="flex flex-col gap-1 flex-1">
          {ratings.map((r, i) => (
            <div key={i} className="flex gap-2 items-center py-1 h-6">
              <div
                className="h-4 rounded-[4px]"
                style={{
                  width: r.barWidth,
                  backgroundColor: r.count > 0 ? '#E0EEFE' : 'var(--bg)',
                }}
              />
              {r.count > 0 && (
                <span className="text-[11px] font-semibold leading-[13px]" style={{ color: 'var(--label)' }}>
                  {r.count}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Footer({ t }: { t: ReturnType<typeof useT> }) {
  const { language, setLanguage } = useApp()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === language)!

  return (
    <div
      className="w-full relative flex flex-col items-center"
      style={{ backgroundColor: '#FFCC00', minHeight: 120, paddingBottom: 24 }}
    >
      <img
        src="/cloud.png"
        alt=""
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{ width: 100, height: 100 }}
      />
      <p
        className="text-[12px] leading-4 text-center"
        style={{ marginTop: 85, color: 'black' }}
      >
        {t.promoFooter}
      </p>

      {/* Language selector */}
      <div className="relative mt-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
          style={{
            backgroundColor: 'rgba(0,0,0,0.08)',
            color: 'black',
          }}
        >
          <span>{current.flag}</span>
          <span>{current.label}</span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            className="transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : undefined }}
          >
            <path d="M1 1l4 4 4-4" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 rounded-[12px] overflow-hidden py-1"
              style={{
                backgroundColor: 'white',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                minWidth: 140,
                zIndex: 10,
              }}
            >
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors text-left"
                  style={{
                    color: 'var(--label)',
                    backgroundColor: lang.code === language ? 'rgba(0,0,0,0.05)' : 'transparent',
                  }}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                  {lang.code === language && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-auto">
                      <path d="M2 6l3 3 5-5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Shared animation variants ──────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1 },
}

const slideFromLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
}

const slideFromRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
}

const soft = { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }
const viewportOnce = { once: true, margin: '-60px' as const }

function LoginPromoContent({ onCtaClick }: { onCtaClick: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center pt-16" style={{ width: '100vw', marginLeft: '-24px', marginRight: '-24px' }}>
      {/* Section 1: Remember your favourite books */}
      <div
        className="w-full relative border-t overflow-hidden"
        style={{ borderColor: 'var(--fill)', backgroundColor: 'white' }}
      >
        {/* Top area: text left + illustration right */}
        <div className="flex items-start px-4 pt-20 pb-6 gap-4 max-w-[460px] mx-auto">
          <motion.div
            className="flex flex-col gap-2 w-[199px] shrink-0"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            transition={soft}
          >
            <h2
              className="text-[22px] font-bold tracking-[-0.26px] leading-[28px]"
              style={{ color: 'var(--primary)' }}
            >
              {t.promoRememberTitle}
            </h2>
            <p
              className="text-[15px] leading-5 tracking-[-0.23px]"
              style={{ color: 'var(--label-secondary)' }}
            >
              {t.promoRememberSubtitle}
            </p>
          </motion.div>
          <motion.div
            className="relative w-[246px] h-[200px] shrink-0 -mt-4"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            transition={{ ...soft, delay: 0.15 }}
          >
            <img
              src="/books-cat.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </motion.div>
        </div>

        {/* Dashboard preview */}
        <motion.div
          className="flex justify-center pb-0"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          transition={{ ...soft, delay: 0.25 }}
        >
          <MockDashboard />
        </motion.div>
      </div>

      {/* Section 2: Personal insights + Footer */}
      <div className="w-full flex flex-col items-center">
        <div
          className="w-full relative overflow-hidden"
          style={{ backgroundColor: 'white' }}
        >
          {/* Top area: text left + cat illustration right */}
          <div className="flex items-start px-4 pt-20 pb-6 gap-4 max-w-[460px] mx-auto">
            <motion.div
              className="flex flex-col gap-2 w-[203px] shrink-0"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={soft}
            >
              <h2
                className="text-[22px] font-bold tracking-[-0.26px] leading-[28px]"
                style={{ color: 'var(--primary)' }}
              >
                {t.promoInsightsTitle}
              </h2>
              <p
                className="text-[15px] leading-5 tracking-[-0.23px]"
                style={{ color: 'var(--label-secondary)' }}
              >
                {t.promoInsightsSubtitle}
              </p>
            </motion.div>
            <motion.div
              className="relative w-[200px] h-[200px] shrink-0 -mt-8"
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ ...soft, delay: 0.15 }}
            >
              <img
                src="/cat-chart.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            </motion.div>
          </div>

          {/* Staggered cards */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: 497, minHeight: 520 }}>
              <motion.div
                className="absolute"
                style={{ left: 0, top: 0, zIndex: 1 }}
                variants={slideFromLeft}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                transition={{ ...soft, delay: 0.1 }}
              >
                <ReadingSpeedChart t={t} />
              </motion.div>
              <motion.div
                className="absolute"
                style={{ left: 157, top: 179, zIndex: 2 }}
                variants={slideFromRight}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                transition={{ ...soft, delay: 0.35 }}
              >
                <RatingsCard t={t} />
              </motion.div>
            </div>
          </div>

          {/* Bottom CTA */}
          <motion.div
            className="flex justify-center px-4 pb-8"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            transition={{ ...soft, delay: 0.1 }}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onCtaClick}
              className="w-full max-w-[329px] py-[14px] rounded-[1000px] text-white text-[17px] tracking-[-0.43px] leading-[22px]"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {t.promoCtaButton}
            </motion.button>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          className="w-full"
          variants={fadeIn}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          transition={{ ...soft, delay: 0.1 }}
        >
          <Footer t={t} />
        </motion.div>
      </div>
    </div>
  )
}

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
    <div className="overflow-hidden shrink-0" style={{ width: 300, height: 285 }}>
      <img
        src="/login-cat.png"
        alt="" width={300} height={300}
      />
    </div>
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
      <div className="min-h-screen flex flex-col items-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
        {illustration}
        <div className="w-full max-w-[360px] flex flex-col gap-5">
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
    <div className="min-h-screen flex flex-col items-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
      {illustration}

      <div className="w-full max-w-[360px] flex flex-col gap-5">
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

        {/* Forgot password link (signin only) */}
        {mode === 'signin' && (
          <div className="flex justify-center">
            <button type="button" onClick={() => switchMode('forgot')}
                    className="text-[15px] font-medium" style={{ color: 'var(--primary)' }}>
              {t.forgotPassword}
            </button>
          </div>
        )}

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

      {/* Promotional content below the login form */}
      <LoginPromoContent onCtaClick={() => document.getElementById('scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' })} />
    </div>
  )
}
