import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

const SIDEBAR_COLLAPSE_KEY = 'juridicai:sidebar-collapsed'

function getStoredCollapse(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

interface LayoutState {
  sidebarCollapse: boolean
  setSidebarCollapse: (open: boolean) => void
  toggleSidebarCollapse: () => void
}

const LayoutContext = createContext<LayoutState | undefined>(undefined)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapse, setSidebarCollapseState] = useState(false)

  // hydrate from localStorage on mount (avoid SSR mismatch)
  useEffect(() => {
    setSidebarCollapseState(getStoredCollapse())
  }, [])

  const setSidebarCollapse = useCallback((value: boolean) => {
    setSidebarCollapseState(value)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(value))
    } catch {}
  }, [])

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapse(!sidebarCollapse)
  }, [sidebarCollapse, setSidebarCollapse])

  return (
    <LayoutContext.Provider value={{ sidebarCollapse, setSidebarCollapse, toggleSidebarCollapse }}>
      {children}
    </LayoutContext.Provider>
  )
}

export const useLayout = () => {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
