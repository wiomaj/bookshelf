'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ViewMode = 'grid' | 'list'

interface AppContextValue {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  cozyMode: boolean
  setCozyMode: (enabled: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('grid')
  const [cozyMode, setCozyModeState] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem('bookshelf_view_mode') as ViewMode | null
      if (v === 'grid' || v === 'list') setViewModeState(v)
      const c = localStorage.getItem('bookshelf_cozy_mode')
      if (c === 'true') setCozyModeState(true)
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

  return (
    <AppContext.Provider value={{ viewMode, setViewMode, cozyMode, setCozyMode }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
