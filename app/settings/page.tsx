'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, ChevronDown, BookOpen, BookMarked, Settings, Check } from 'lucide-react'
import Link from 'next/link'
import { useApp, useT } from '@/contexts/AppContext'
import { LANGUAGES } from '@/lib/translations'

type View = 'settings' | 'changePassword'

export default function SettingsPage() {
  const router = useRouter()
  const { cozyMode, setCozyMode, language, setLanguage, signOut, changePassword, deleteAccount } = useApp()
  const t = useT()

  const [view, setView] = useState<View>('settings')
  const [langOpen, setLangOpen] = useState(false)

  // Change password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [cpLoading, setCpLoading] = useState(false)
  const [cpError, setCpError] = useState<string | null>(null)
  const [cpSuccess, setCpSuccess] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const currentLang = LANGUAGES.find(l => l.code === language)

  const inputClass = `
    w-full px-4 py-3 rounded-2xl border border-[rgba(23,23,23,0.12)]
    bg-white text-[#171717] text-[16px] leading-6
    placeholder:text-[rgba(23,23,23,0.35)]
    focus:outline-none focus:border-[rgba(23,23,23,0.4)]
    transition-colors
  `

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setCpError(null)
    setCpSuccess(false)
    if (newPassword !== confirmNewPassword) {
      setCpError(t.passwordMismatch)
      return
    }
    setCpLoading(true)
    const { error } = await changePassword(newPassword)
    setCpLoading(false)
    if (error) {
      setCpError(error)
    } else {
      setCpSuccess(true)
      setNewPassword('')
      setConfirmNewPassword('')
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    setDeleteError(null)
    const { error } = await deleteAccount()
    setDeleteLoading(false)
    if (error) {
      setDeleteError(error)
    } else {
      router.replace('/login')
    }
  }

  // ── Bottom navigation bar ────────────────────────────────────────────────────
  const BottomNav = () => (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white z-50 bottom-nav-safe"
      style={{ borderTop: '1px solid #e0e0e0' }}
    >
      <div className="h-20 flex">
        <Link
          href="/"
          className="flex flex-col items-center pt-[11px] gap-[2px] flex-1 text-[#7c7c7c]"
        >
          <BookOpen size={24} strokeWidth={1.5} />
          <span className="text-[12px] font-medium leading-[16px]">{t.tabRead}</span>
        </Link>

        <Link
          href="/"
          className="flex flex-col items-center pt-[11px] gap-[2px] flex-1 text-[#7c7c7c]"
        >
          <BookMarked size={24} strokeWidth={1.5} />
          <span className="text-[12px] font-medium leading-[16px]">{t.tabToRead}</span>
        </Link>

        <button className="flex flex-col items-center pt-[11px] gap-[2px] flex-1 text-[#171717]">
          <Settings size={24} strokeWidth={2} />
          <span className="text-[12px] font-medium leading-[16px]">{t.settings}</span>
        </button>
      </div>
    </nav>
  )

  // ── Change Password sub-view ─────────────────────────────────────────────────
  if (view === 'changePassword') {
    return (
      <div className="min-h-screen flex flex-col page-bottom-safe">

        {/* Back header */}
        <div className="flex items-center p-3 h-[60px]">
          <button
            onClick={() => { setView('settings'); setCpError(null); setCpSuccess(false); setNewPassword(''); setConfirmNewPassword('') }}
            className="p-[6px] w-[36px] flex items-center justify-center text-[#171717]"
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Title */}
        <div className="px-4 pb-6">
          <h1 className="text-[24px] font-black text-[#171717] leading-8">{t.changePassword}</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleChangePassword} className="px-4 flex flex-col gap-3">
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder={t.newPassword}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder={t.confirmNewPassword}
            value={confirmNewPassword}
            onChange={e => setConfirmNewPassword(e.target.value)}
            className={inputClass}
          />

          {cpError && (
            <p className="text-red-500 text-[14px] leading-5 px-1">{cpError}</p>
          )}
          {cpSuccess && (
            <p className="text-green-600 text-[14px] leading-5 px-1">{t.passwordChangedSuccess}</p>
          )}

          <button
            type="submit"
            disabled={cpLoading}
            className="w-full py-4 mt-1 rounded-full text-white text-[16px] font-bold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {cpLoading ? t.savingPassword : t.savePassword}
          </button>
        </form>

        <BottomNav />
      </div>
    )
  }

  // ── Main settings view ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col page-bottom-safe">

      {/* Title */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-[24px] font-black text-[#171717] leading-8">{t.settings}</h1>
      </div>

      <div className="px-4 pb-10 flex flex-col gap-6">

        {/* ── Cozy mode ──────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2">
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-[18px] font-bold text-[#171717] leading-6 tracking-[-0.3px]">{t.cozyMode}</p>
            <p className="text-[16px] text-[#171717] leading-6">{t.cozyModeDescription}</p>
          </div>
          <button
            onClick={() => setCozyMode(!cozyMode)}
            className="relative w-[51px] h-[31px] rounded-[100px] shrink-0 transition-colors duration-300"
            style={{ backgroundColor: cozyMode ? '#34C759' : 'rgba(120,120,128,0.16)' }}
            aria-pressed={cozyMode}
            aria-label="Toggle cozy mode"
          >
            <div
              className="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-[100px] transition-transform duration-300"
              style={{
                transform: cozyMode ? 'translateX(22px)' : 'translateX(2px)',
                boxShadow: '0px 0px 0px 0px rgba(0,0,0,0.04), 0px 3px 8px 0px rgba(0,0,0,0.15), 0px 3px 1px 0px rgba(0,0,0,0.06)',
              }}
            />
          </button>
        </div>

        {/* ── Language dropdown ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-[18px] font-bold text-[#171717] leading-6 tracking-[-0.3px]">{t.language}</p>
          <div className="relative">
            <button
              onClick={() => setLangOpen(o => !o)}
              className="w-full h-[60px] flex items-center justify-between px-4 py-3 rounded-[12px] bg-white"
              style={{ border: '2px solid rgba(23,23,23,0.16)' }}
            >
              <span className="text-[16px] text-[#171717] leading-6">
                {currentLang?.flag}&nbsp;&nbsp;{currentLang?.label}
              </span>
              <ChevronDown
                size={24}
                className="text-[#171717] transition-transform duration-200"
                style={{ transform: langOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {langOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1 bg-white rounded-[12px] z-10 overflow-hidden"
                style={{ border: '2px solid rgba(23,23,23,0.16)' }}
              >
                {LANGUAGES.map((lang, i) => (
                  <button
                    key={lang.code}
                    onClick={() => { setLanguage(lang.code); setLangOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[rgba(23,23,23,0.04)] ${
                      i < LANGUAGES.length - 1 ? 'border-b border-[rgba(23,23,23,0.08)]' : ''
                    }`}
                  >
                    <span className="text-[18px] leading-none">{lang.flag}</span>
                    <span className="flex-1 text-[16px] text-[#171717] leading-6">{lang.label}</span>
                    {language === lang.code && (
                      <Check size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="h-px bg-[#e0e0e0]" />

        {/* ── My Account ──────────────────────────────────────────────────── */}
        <p className="text-[24px] font-black text-[#171717] leading-8">{t.myAccount}</p>

        <div className="flex flex-col -mt-2">
          <button
            onClick={() => setView('changePassword')}
            className="flex items-center p-4 w-full text-left"
          >
            <span className="flex-1 text-[16px] font-bold text-[#171717] leading-6">{t.changePassword}</span>
            <ChevronRight size={24} className="text-[#171717] shrink-0" />
          </button>

          <button
            onClick={async () => { await signOut(); router.replace('/login') }}
            className="flex items-center p-4 w-full text-left"
          >
            <span className="flex-1 text-[16px] font-bold text-[#171717] leading-6">{t.signOut}</span>
            <ChevronRight size={24} className="text-[#171717] shrink-0" />
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center p-4 w-full text-left"
          >
            <span className="flex-1 text-[16px] font-bold text-red-500 leading-6">{t.deleteAccount}</span>
            <ChevronRight size={24} className="text-red-500 shrink-0" />
          </button>
        </div>

      </div>

      {/* ── Delete account confirmation dialog ──────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="w-full max-w-[400px] bg-white rounded-3xl p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 className="text-[24px] font-black text-[#171717] leading-8">{t.deleteAccount}?</h2>
              <p className="text-[16px] text-[rgba(23,23,23,0.56)] leading-6">{t.deleteAccountDesc}</p>
            </div>

            {deleteError && (
              <p className="text-red-500 text-[14px] leading-5">{deleteError}</p>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="w-full py-4 rounded-full text-white text-[16px] font-bold bg-red-500 disabled:opacity-60 transition-opacity"
              >
                {deleteLoading ? t.deleting : t.deleteAccount}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                disabled={deleteLoading}
                className="w-full py-4 rounded-full text-[#171717] text-[16px] font-bold bg-[rgba(23,23,23,0.06)] disabled:opacity-60"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
