'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { type Locale, type Translations, translations } from '@/lib/translations'
import { resolveAvatarSeed } from '@/lib/avatar'

export type ViewMode = 'grid' | 'list'
export type Theme = 'system' | 'dark'

const VALID_LOCALES: Locale[] = ['en', 'de', 'fr', 'es', 'pl']

/** Map navigator.language (e.g. "de-DE", "fr-FR") to a supported locale, defaulting to 'en'. */
function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = (navigator.language ?? '').toLowerCase()
  if (lang.startsWith('de')) return 'de'
  if (lang.startsWith('fr')) return 'fr'
  if (lang.startsWith('es')) return 'es'
  if (lang.startsWith('pl')) return 'pl'
  return 'en'
}

interface AppContextValue {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  cozyMode: boolean
  setCozyMode: (enabled: boolean) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
  toReadCount: number
  setToReadCount: (n: number) => void
  wishlistCount: number
  setWishlistCount: (n: number) => void
  language: Locale
  setLanguage: (lang: Locale) => void
  user: User | null
  isAuthLoading: boolean
  displayName: string
  updateDisplayName: (name: string) => Promise<{ error: string | null }>
  /** Seed the user's generated image is drawn from — their shuffle, else the account id. */
  avatarSeed: string
  /** Pass null to go back to the account id. */
  updateAvatarSeed: (seed: string | null) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  changePassword: (newPassword: string) => Promise<{ error: string | null }>
  deleteAccount: () => Promise<{ error: string | null }>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('grid')
  const [cozyMode, setCozyModeState] = useState(false)
  const [theme, setThemeState] = useState<Theme>('system')
  const [isDark, setIsDark] = useState(false)
  const [toReadCount, setToReadCountState] = useState(0)
  const [wishlistCount, setWishlistCountState] = useState(0)
  const [language, setLanguageState] = useState<Locale>('en')
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [avatarSeed, setAvatarSeed] = useState('')

  const router = useRouter()
  const pathname = usePathname()

  // ── Restore UI preferences ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const v = localStorage.getItem('bookshelf_view_mode') as ViewMode | null
      if (v === 'grid' || v === 'list') setViewModeState(v)
      const c = localStorage.getItem('bookshelf_cozy_mode')
      if (c === 'true') setCozyModeState(true)
      const th = localStorage.getItem('bookshelf_theme') as Theme | null
      if (th === 'dark' || th === 'system') setThemeState(th)
      const l = localStorage.getItem('bookshelf_language') as Locale | null
      if (l && VALID_LOCALES.includes(l)) setLanguageState(l)
      else setLanguageState(detectBrowserLocale())
    } catch { /* ignore */ }
  }, [])

  // ── Apply dark class to <html> based on theme + system preference ────────────
  useEffect(() => {
    function apply() {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = theme === 'dark' || (theme === 'system' && systemDark)
      document.documentElement.classList.toggle('dark', dark)
      setIsDark(dark)
      // Keep the browser-chrome / status-bar color in sync when dark mode is
      // forced manually (the static media-query themeColor can't cover that).
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', dark ? '#000000' : '#F2F2F7'))
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  // ── Auth init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      setDisplayName(u?.user_metadata?.display_name ?? '')
      setAvatarSeed(resolveAvatarSeed(u?.id ?? '', u?.user_metadata?.avatar_seed))
      setIsAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null
      setUser(u)
      setDisplayName(u?.user_metadata?.display_name ?? '')
      setAvatarSeed(resolveAvatarSeed(u?.id ?? '', u?.user_metadata?.avatar_seed))
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Redirect guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading) return
    if (!user && pathname !== '/login' && pathname !== '/reset') router.replace('/login')
    if (user && pathname === '/login') router.replace('/')
  }, [user, isAuthLoading, pathname, router])

  // ── UI preference setters ────────────────────────────────────────────────────
  function setViewMode(mode: ViewMode) {
    setViewModeState(mode)
    try { localStorage.setItem('bookshelf_view_mode', mode) } catch { /* ignore */ }
  }

  function setCozyMode(enabled: boolean) {
    setCozyModeState(enabled)
    try { localStorage.setItem('bookshelf_cozy_mode', String(enabled)) } catch { /* ignore */ }
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    try { localStorage.setItem('bookshelf_theme', t) } catch { /* ignore */ }
  }

  function setLanguage(lang: Locale) {
    setLanguageState(lang)
    try { localStorage.setItem('bookshelf_language', lang) } catch { /* ignore */ }
  }

  function setToReadCount(n: number) { setToReadCountState(n) }
  function setWishlistCount(n: number) { setWishlistCountState(n) }

  // ── Auth methods ─────────────────────────────────────────────────────────────
  async function signIn(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null, needsConfirmation: false }
  }

  async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null, needsConfirmation: !data.session }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  async function resetPassword(email: string): Promise<{ error: string | null }> {
    // Prefer an explicit env var so the redirect target is consistent across
    // tabs, embedded contexts, and staging/preview deployments.
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset`,
    })
    return { error: error?.message ?? null }
  }

  async function changePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }

  async function updateDisplayName(name: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ data: { display_name: name } })
    if (!error) setDisplayName(name)
    return { error: error?.message ?? null }
  }

  async function updateAvatarSeed(seed: string | null): Promise<{ error: string | null }> {
    // GoTrue merges `data` into user_metadata and drops keys set to null, so
    // passing null resets the image without touching display_name.
    const { error } = await supabase.auth.updateUser({ data: { avatar_seed: seed } })
    if (!error) setAvatarSeed(resolveAvatarSeed(user?.id ?? '', seed))
    return { error: error?.message ?? null }
  }

  async function deleteAccount(): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('delete_user')
    if (!error) await supabase.auth.signOut()
    return { error: error?.message ?? null }
  }

  // ── Loading screen while session restores ────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-[var(--fill)] rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      viewMode, setViewMode,
      cozyMode, setCozyMode,
      theme, setTheme,
      isDark,
      toReadCount, setToReadCount,
      wishlistCount, setWishlistCount,
      language, setLanguage,
      user, isAuthLoading,
      displayName, updateDisplayName,
      avatarSeed, updateAvatarSeed,
      signIn, signUp, signOut, resetPassword, changePassword, deleteAccount,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

/** Returns the full translation object for the current locale. */
export function useT(): Translations {
  const { language } = useApp()
  return translations[language]
}
