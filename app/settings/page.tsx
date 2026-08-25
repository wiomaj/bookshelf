'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Check, BookOpenCheck, Settings, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useApp, useT } from '@/contexts/AppContext'
import { LANGUAGES } from '@/lib/translations'
import { supabase } from '@/lib/supabase'
import { getBooks } from '@/lib/bookApi'
import { booksToCsv, downloadCsv } from '@/lib/csvExport'
import UserAvatar from '@/components/UserAvatar'
import AvatarPicker from '@/components/AvatarPicker'

type View = 'settings' | 'changePassword'

// ── Shared: floating glass bottom nav ────────────────────────────────────────
function BottomNav({ t, displayName }: { t: ReturnType<typeof useT>; displayName: string }) {
  const router = useRouter()
  return (
    <nav className="fixed bottom-5 left-4 right-4 z-50 max-w-[568px] mx-auto">
      <div className="glass flex items-center rounded-[28px] px-2 py-2"
           style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>

        {/* Books tab */}
        <button
          onClick={() => router.push('/')}
          className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px]"
          style={{ color: 'var(--label-secondary)' }}
        >
          <BookOpenCheck size={22} strokeWidth={1.5} />
          <span className="text-[10px] font-medium tracking-[-0.1px]">{t.tabBooks}</span>
        </button>

        {/* Dashboard tab */}
        <button
          onClick={() => { sessionStorage.setItem('bookshelf_returnMainTab', 'dashboard'); router.push('/') }}
          className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px]"
          style={{ color: 'var(--label-secondary)' }}
        >
          {/* A 22px slot matches the other tabs' icon size, so the bar's height never
              changes. The image is decorative — the label already reads the name —
              and floats above the slot via absolute positioning, raised and oversized
              since this tab is never the active one on this screen. */}
          <div className="relative w-[22px] h-[22px]">
            <motion.div
              className="absolute"
              style={{ top: -11.5, left: -11.5, width: 45, height: 45 }}
              animate={{ y: -18 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            >
              <UserAvatar
                size={45}
                shape="circle"
                decorative
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}
              />
            </motion.div>
          </div>
          <span className="text-[10px] font-medium tracking-[-0.1px] max-w-[64px] truncate">{displayName || t.tabDashboard}</span>
        </button>

        {/* Settings tab — active */}
        <button className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] relative">
          <div className="absolute inset-0 rounded-[22px]" style={{ backgroundColor: 'var(--primary-muted)' }} />
          <Settings size={22} strokeWidth={2} className="relative" style={{ color: 'var(--primary)' }} />
          <span className="text-[10px] font-medium tracking-[-0.1px] relative" style={{ color: 'var(--primary)' }}>
            {t.settings}
          </span>
        </button>

      </div>
    </nav>
  )
}

// ── Grouped list row ──────────────────────────────────────────────────────────
function ListRow({
  label,
  labelColor,
  sublabel,
  onClick,
  accessory,
  first,
  last,
}: {
  label: string
  labelColor?: string
  sublabel?: string
  onClick?: () => void
  accessory?: React.ReactNode
  first?: boolean
  last?: boolean
}) {
  return (
    <>
      <button
        onClick={onClick}
        className="w-full flex items-center px-4 min-h-[52px] gap-3 text-left transition-colors active:opacity-60"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <div className="flex-1 py-3">
          <span className="text-[17px]" style={{ color: labelColor ?? 'var(--label)' }}>
            {label}
          </span>
          {sublabel && (
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--label-secondary)' }}>{sublabel}</p>
          )}
        </div>
        {accessory ?? <ChevronRight size={18} style={{ color: 'var(--label-tertiary)' }} />}
      </button>
      {!last && (
        <div className="h-px ml-4" style={{ backgroundColor: 'var(--separator)' }} />
      )}
    </>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, cozyMode, setCozyMode, theme, setTheme, language, setLanguage, signOut, changePassword, deleteAccount, displayName, updateDisplayName } = useApp()
  const t = useT()

  const [view, setView] = useState<View>('settings')
  const [langOpen, setLangOpen] = useState(false)
  const [nameValue, setNameValue] = useState(displayName)
  const [nameSaving, setNameSaving] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

  // Sync once displayName is loaded from Supabase
  useEffect(() => { setNameValue(displayName) }, [displayName])

  async function handleNameBlur() {
    const trimmed = nameValue.trim()
    if (trimmed === displayName) return
    setNameSaving(true)
    await updateDisplayName(trimmed)
    setNameSaving(false)
  }

  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [cpLoading, setCpLoading] = useState(false)
  const [cpError, setCpError] = useState<string | null>(null)
  const [cpSuccess, setCpSuccess] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExportCsv() {
    if (!user || exportLoading) return
    setExportLoading(true)
    setExportError(null)
    try {
      const books = await getBooks(supabase, user.id)
      const csv = booksToCsv(books, t.csvHeaders, t.seasonNames)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(csv, `bookshelf-export-${date}.csv`)
    } catch {
      setExportError(t.exportError)
    } finally {
      setExportLoading(false)
    }
  }

  const currentLang = LANGUAGES.find(l => l.code === language)

  const inputClass = `
    w-full px-4 py-[14px] rounded-[12px] text-[17px] transition-colors
    focus:outline-none
  `

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setCpError(null); setCpSuccess(false)
    if (newPassword !== confirmNewPassword) { setCpError(t.passwordMismatch); return }
    setCpLoading(true)
    const { error } = await changePassword(newPassword)
    setCpLoading(false)
    if (error) { setCpError(error) } else {
      setCpSuccess(true)
      setNewPassword(''); setConfirmNewPassword('')
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true); setDeleteError(null)
    const { error } = await deleteAccount()
    setDeleteLoading(false)
    if (error) { setDeleteError(error) } else { router.replace('/login') }
  }

  // ── Change Password sub-view ──────────────────────────────────────────────
  if (view === 'changePassword') {
    return (
      // pb-[110px] clears the floating bottom nav (fixed, ~90px incl. margin)
      // so the form can scroll fully into view.
      <div className="min-h-screen pb-[110px]">
        {/* Back nav */}
        <div className="flex items-center px-2 pt-3 h-[50px]">
          <button
            onClick={() => { setView('settings'); setCpError(null); setCpSuccess(false); setNewPassword(''); setConfirmNewPassword('') }}
            className="flex items-center gap-1 px-3 py-2 rounded-xl transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
            <span className="text-[17px]">{t.settings}</span>
          </button>
        </div>

        <div className="px-5 pt-2 pb-6">
          <h1 className="text-[34px] font-bold tracking-[-0.5px]" style={{ color: 'var(--label)' }}>
            {t.changePassword}
          </h1>
        </div>

        <form onSubmit={handleChangePassword} className="px-4 flex flex-col gap-3">
          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder={t.newPassword}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
              style={{ color: 'var(--label)', borderBottom: '1px solid var(--separator)' }}
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder={t.confirmNewPassword}
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              className={inputClass}
              style={{ color: 'var(--label)' }}
            />
          </div>

          {cpError && <p className="text-[14px] px-1" style={{ color: 'var(--danger)' }}>{cpError}</p>}
          {cpSuccess && <p className="text-[14px] px-1" style={{ color: 'var(--success)' }}>{t.passwordChangedSuccess}</p>}

          <motion.button
            type="submit"
            disabled={cpLoading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold mt-2 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {cpLoading ? t.savingPassword : t.savePassword}
          </motion.button>
        </form>

        <BottomNav t={t} displayName={displayName} />
      </div>
    )
  }

  // ── Main Settings view ────────────────────────────────────────────────────
  return (
    // pb-[110px] clears the floating bottom nav (fixed, ~90px incl. margin) so
    // the last section (Konto löschen) can scroll out from behind it.
    <div className="min-h-screen pb-[110px]">

      {/* Large title */}
      <div className="px-5 pt-4 pb-6">
        <h1 className="text-[34px] font-bold tracking-[-0.5px]" style={{ color: 'var(--label)' }}>
          {t.settings}
        </h1>
      </div>

      <div className="px-4 flex flex-col gap-8">

        {/* ── Profile section ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium uppercase tracking-wide px-1"
             style={{ color: 'var(--label-secondary)' }}>
            {t.profileSection}
          </p>
          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            {/* Generated image — the name beside it says who this is, so the
                image itself is decorative. Tapping opens the shuffle sheet. */}
            <button
              onClick={() => setAvatarPickerOpen(true)}
              className="w-full flex items-center px-4 py-4 gap-3 text-left transition-colors active:opacity-60"
            >
              <UserAvatar size={56} decorative />
              <div className="flex-1 min-w-0">
                <p className="text-[17px] truncate" style={{ color: 'var(--label)' }}>
                  {displayName || t.yourNamePlaceholder}
                </p>
                <p className="text-[13px] truncate mt-0.5" style={{ color: 'var(--label-secondary)' }}>
                  {t.shuffleImage}
                </p>
              </div>
              <ChevronRight size={18} strokeWidth={2.5} style={{ color: 'var(--label-tertiary)' }} />
            </button>

            <div className="h-px ml-4" style={{ backgroundColor: 'var(--separator)' }} />

            <div className="flex items-center px-4 min-h-[52px] gap-3">
              <label className="text-[17px] shrink-0" style={{ color: 'var(--label)' }}>
                {t.yourName}
              </label>
              <input
                type="text"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                placeholder={t.yourNamePlaceholder}
                className="flex-1 text-[17px] text-right bg-transparent focus:outline-none min-w-0"
                style={{
                  color: nameSaving ? 'var(--label-secondary)' : 'var(--label)',
                  caretColor: 'var(--primary)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Preferences section ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium uppercase tracking-wide px-1"
             style={{ color: 'var(--label-secondary)' }}>
            {t.preferencesSection}
          </p>

          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            {/* Cozy mode row */}
            <div className="flex items-center px-4 min-h-[52px] gap-3">
              <div className="flex-1 py-3">
                <p className="text-[17px]" style={{ color: 'var(--label)' }}>{t.cozyMode}</p>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--label-secondary)' }}>
                  {t.cozyModeDescription}
                </p>
              </div>
              <button
                onClick={() => setCozyMode(!cozyMode)}
                className="relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-300"
                style={{ backgroundColor: cozyMode ? 'var(--success)' : 'rgba(120,120,128,0.22)' }}
                aria-pressed={cozyMode}
              >
                <div
                  className="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full transition-transform duration-300"
                  style={{
                    transform: cozyMode ? 'translateX(22px)' : 'translateX(2px)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.06)',
                  }}
                />
              </button>
            </div>

            {/* Separator */}
            <div className="h-px ml-4" style={{ backgroundColor: 'var(--separator)' }} />

            {/* Dark mode row */}
            <div className="flex items-center px-4 min-h-[52px] gap-3">
              <div className="flex-1 py-3">
                <p className="text-[17px]" style={{ color: 'var(--label)' }}>{t.darkMode}</p>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--label-secondary)' }}>
                  {t.darkModeDescription}
                </p>
              </div>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'system' : 'dark')}
                className="relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-300"
                style={{ backgroundColor: theme === 'dark' ? 'var(--success)' : 'rgba(120,120,128,0.22)' }}
                aria-pressed={theme === 'dark'}
              >
                <div
                  className="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full transition-transform duration-300"
                  style={{
                    transform: theme === 'dark' ? 'translateX(22px)' : 'translateX(2px)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.06)',
                  }}
                />
              </button>
            </div>

            {/* Separator */}
            <div className="h-px ml-4" style={{ backgroundColor: 'var(--separator)' }} />

            {/* Language row */}
            <button
              onClick={() => setLangOpen(o => !o)}
              className="w-full flex items-center px-4 min-h-[52px] gap-3 text-left transition-colors active:opacity-60"
            >
              <span className="flex-1 text-[17px] py-3" style={{ color: 'var(--label)' }}>
                {t.language}
              </span>
              <span className="text-[17px]" style={{ color: 'var(--label-secondary)' }}>
                {currentLang?.flag}&nbsp;{currentLang?.label}
              </span>
              <ChevronRight
                size={18}
                className="transition-transform duration-200"
                style={{
                  color: 'var(--label-tertiary)',
                  transform: langOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {langOpen && (
              <>
                <div className="h-px ml-4" style={{ backgroundColor: 'var(--separator)' }} />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {LANGUAGES.map((lang, i) => (
                    <div key={lang.code}>
                      <button
                        onClick={() => { setLanguage(lang.code); setLangOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:opacity-60"
                      >
                        <span className="text-[18px] leading-none">{lang.flag}</span>
                        <span className="flex-1 text-[16px]" style={{ color: 'var(--label)' }}>{lang.label}</span>
                        {language === lang.code && (
                          <Check size={17} strokeWidth={2.5} style={{ color: 'var(--primary)' }} />
                        )}
                      </button>
                      {i < LANGUAGES.length - 1 && (
                        <div className="h-px ml-[52px]" style={{ backgroundColor: 'var(--separator)' }} />
                      )}
                    </div>
                  ))}
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* ── Data section ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium uppercase tracking-wide px-1"
             style={{ color: 'var(--label-secondary)' }}>
            {t.dataSection}
          </p>

          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <ListRow
              label={exportLoading ? t.exporting : t.exportCsv}
              sublabel={t.exportCsvDesc}
              onClick={handleExportCsv}
              accessory={
                exportLoading
                  ? <div className="w-[18px] h-[18px] border-2 border-[var(--fill)] rounded-full animate-spin shrink-0"
                         style={{ borderTopColor: 'var(--primary)' }} />
                  : <Download size={18} className="shrink-0" style={{ color: 'var(--label-tertiary)' }} />
              }
              first
              last
            />
          </div>

          {exportError && (
            <p className="text-[14px] px-1" style={{ color: 'var(--danger)' }}>{exportError}</p>
          )}
        </div>

        {/* ── My Account section ──────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium uppercase tracking-wide px-1"
             style={{ color: 'var(--label-secondary)' }}>
            {t.myAccount}
          </p>

          <div className="rounded-[16px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <ListRow
              label={t.changePassword}
              onClick={() => setView('changePassword')}
              first
            />
            <ListRow
              label={t.signOut}
              onClick={async () => { await signOut(); router.replace('/login') }}
            />
            <ListRow
              label={t.deleteAccount}
              labelColor='var(--danger)'
              onClick={() => setShowDeleteConfirm(true)}
              last
              accessory={<ChevronRight size={18} style={{ color: 'var(--danger)', opacity: 0.5 }} />}
            />
          </div>
        </div>

      </div>

      {/* ── Delete account sheet ─────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="w-full max-w-[600px] rounded-t-[28px] p-6 pb-10"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5"
                 style={{ backgroundColor: 'var(--separator-opaque)' }} />

            <div className="flex flex-col gap-2 mb-6">
              <h2 className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                {t.deleteAccount}?
              </h2>
              <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>
                {t.deleteAccountDesc}
              </p>
            </div>

            {deleteError && (
              <p className="text-[14px] mb-4" style={{ color: 'var(--danger)' }}>{deleteError}</p>
            )}

            <div className="flex flex-col gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--danger)' }}
              >
                {deleteLoading ? t.deleting : t.deleteAccount}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                disabled={deleteLoading}
                className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
              >
                {t.cancel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <BottomNav t={t} displayName={displayName} />

      <AvatarPicker open={avatarPickerOpen} onClose={() => setAvatarPickerOpen(false)} />
    </div>
  )
}
