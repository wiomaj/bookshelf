'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { useApp, useT } from '@/contexts/AppContext'
import { LANGUAGES } from '@/lib/translations'

type View = 'settings' | 'changePassword'

export default function SettingsPage() {
  const router = useRouter()
  const { cozyMode, setCozyMode, language, setLanguage, signOut, changePassword, deleteAccount } = useApp()
  const t = useT()

  const [view, setView] = useState<View>('settings')

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

  // ── Change Password sub-view ───────────────────────────────────────────────
  if (view === 'changePassword') {
    return (
      <div className="min-h-screen">
        <div className="max-w-[393px] mx-auto flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-3 h-[60px]">
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
            <h1 className="text-[32px] font-black text-[#171717] leading-8">{t.changePassword}</h1>
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
        </div>
      </div>
    )
  }

  // ── Main settings view ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="max-w-[393px] mx-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-end p-3 h-[60px]">
          <button
            onClick={() => router.back()}
            className="p-[6px] w-[36px] flex items-center justify-center text-[#171717]"
            aria-label="Close settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* Title */}
        <div className="px-4 pb-6">
          <h1 className="text-[32px] font-black text-[#171717] leading-8">{t.settings}</h1>
        </div>

        <div className="px-4 pb-10 flex flex-col gap-6">

          {/* Cozy mode */}
          <div className="flex items-start gap-4">
            <div className="flex-1 flex flex-col gap-1">
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

          {/* Divider */}
          <div className="h-px bg-[rgba(23,23,23,0.08)]" />

          {/* Language */}
          <div className="flex flex-col gap-3">
            <p className="text-[18px] font-bold text-[#171717] leading-6 tracking-[-0.3px]">{t.language}</p>
            <div className="flex flex-col">
              {LANGUAGES.map((lang, i) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex items-center gap-3 py-3 text-left transition-colors
                    ${i < LANGUAGES.length - 1 ? 'border-b border-[rgba(23,23,23,0.08)]' : ''}`}
                >
                  <span className="text-[22px] leading-none w-8 text-center">{lang.flag}</span>
                  <span className="flex-1 text-[16px] text-[#171717] leading-6">{lang.label}</span>
                  {language === lang.code && (
                    <Check size={20} strokeWidth={2.5} style={{ color: 'var(--primary)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[rgba(23,23,23,0.08)]" />

          {/* My Account section */}
          <p className="text-[24px] font-black text-[#171717] leading-8">{t.myAccount}</p>

          <div className="flex flex-col -mt-2">

            {/* Change password */}
            <button
              onClick={() => setView('changePassword')}
              className="flex items-center gap-3 p-4 w-full text-left border-b border-[rgba(23,23,23,0.08)]"
            >
              <span className="flex-1 text-[16px] font-bold text-[#171717] leading-6">{t.changePassword}</span>
              <ChevronRight size={24} className="text-[#171717] shrink-0" />
            </button>

            {/* Sign out */}
            <button
              onClick={async () => { await signOut(); router.replace('/login') }}
              className="flex items-center gap-3 p-4 w-full text-left border-b border-[rgba(23,23,23,0.08)]"
            >
              <span className="flex-1 text-[16px] font-bold text-[#171717] leading-6">{t.signOut}</span>
              <ChevronRight size={24} className="text-[#171717] shrink-0" />
            </button>

            {/* Delete account */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-3 p-4 w-full text-left"
            >
              <span className="flex-1 text-[16px] font-bold text-red-500 leading-6">{t.deleteAccount}</span>
              <ChevronRight size={24} className="text-red-500 shrink-0" />
            </button>

          </div>
        </div>
      </div>

      {/* Delete account confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="w-full max-w-[393px] bg-white rounded-3xl p-6 flex flex-col gap-5">
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
    </div>
  )
}
