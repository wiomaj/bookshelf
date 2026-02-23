'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('grid')
  const [cozyMode, setCozyModeState] = useState(false)
  const [language, setLanguageState] = useState<Locale>('en')

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

  return (
    <AppContext.Provider value={{ viewMode, setViewMode, cozyMode, setCozyMode, language, setLanguage }}>
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
