'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { type Locale, type Translations, translations } from '@/lib/translations'

export type ViewMode = 'grid' | 'list'

const VALID_LOCALES: Locale[] = ['en', 'de', 'fr', 'es', 'pl']

interface AppContextValue {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  cozyMode: boolean
  setCozyMode: (enabled: boolean) => void
  language: Locale
  setLanguage: (lang: Locale) => void
  user: User | null
  isAuthLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('grid')
  const [cozyMode, setCozyModeState] = useState(false)
  const [language, setLanguageState] = useState<Locale>('en')
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  const router = useRouter()
  const pathname = usePathname()

  // ── Restore UI preferences ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const v = localStorage.getItem('bookshelf_view_mode') as ViewMode | null
      if (v === 'grid' || v === 'list') setViewModeState(v)
      const c = localStorage.getItem('bookshelf_cozy_mode')
      if (c === 'true') setCozyModeState(true)
      const l = localStorage.getItem('bookshelf_language') as Locale | null
      if (l && VALID_LOCALES.includes(l)) setLanguageState(l)
    } catch { /* ignore */ }
  }, [])

  // ── Auth init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setIsAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Redirect guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading) return
    if (!user && pathname !== '/login') router.replace('/login')
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

  function setLanguage(lang: Locale) {
    setLanguageState(lang)
    try { localStorage.setItem('bookshelf_language', lang) } catch { /* ignore */ }
  }

  // ── Auth methods ─────────────────────────────────────────────────────────────
  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  // ── Loading screen while session restores ────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      viewMode, setViewMode,
      cozyMode, setCozyMode,
      language, setLanguage,
      user, isAuthLoading,
      signIn, signUp, signOut,
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
