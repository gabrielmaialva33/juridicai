import { ReactNode, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Sidebar } from '@/components/sidebar/sidebar'
import { Header } from '@/components/header/header'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Add body classes for layout
  useEffect(() => {
    const bodyClass = document.body.classList
    bodyClass.add('demo1', 'sidebar-fixed', 'header-fixed')

    if (sidebarCollapsed) {
      bodyClass.add('sidebar-collapse')
    } else {
      bodyClass.remove('sidebar-collapse')
    }

    const timer = setTimeout(() => {
      bodyClass.add('layout-initialized')
    }, 100)

    return () => {
      bodyClass.remove(
        'demo1',
        'sidebar-fixed',
        'sidebar-collapse',
        'header-fixed',
        'layout-initialized'
      )
      clearTimeout(timer)
    }
  }, [sidebarCollapsed])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold text-gray-800 dark:text-white">
              JuridicAI
            </span>
          )}
          {sidebarCollapsed && (
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">J</span>
          )}
        </div>

        {/* Sidebar Menu */}
        <Sidebar collapsed={sidebarCollapsed} />
      </aside>

      {/* Sidebar - Mobile */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={toggleMobileSidebar} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-lg font-semibold text-gray-800 dark:text-white">
                JuridicAI
              </span>
              <button
                onClick={toggleMobileSidebar}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar collapsed={false} />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <Header onToggleSidebar={toggleSidebar} onToggleMobileSidebar={toggleMobileSidebar} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
