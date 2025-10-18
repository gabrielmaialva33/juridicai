import { ReactNode } from 'react'
import { useBodyClass } from '@/hooks/use_body_class'
import { useIsDesktop } from '@/hooks/use_media_query'
import { Demo1Header } from '@/components/demos/demo1/header'
import { Demo1Sidebar } from '@/components/demos/demo1/sidebar'
import { Demo1Footer } from '@/components/demos/demo1/footer'

interface Demo1LayoutProps {
  children: ReactNode
}

/**
 * Demo1 Layout - Classic Sidebar Layout
 *
 * Features:
 * - Fixed left sidebar with accordion navigation (desktop)
 * - Mobile drawer sidebar using Sheet component
 * - Fixed header with breadcrumbs
 * - Responsive footer
 * - Professional Metronic v9.3.2 styling
 *
 * Body classes applied:
 * - demo1: Layout identifier
 * - sidebar-fixed: Fixed sidebar positioning
 * - header-fixed: Fixed header positioning
 */
export function Demo1Layout({ children }: Demo1LayoutProps) {
  const isDesktop = useIsDesktop()

  // Apply body classes for layout-specific styling
  useBodyClass('demo1 sidebar-fixed header-fixed')

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar - Fixed left sidebar, hidden on mobile */}
      {isDesktop && <Demo1Sidebar />}

      {/* Main Content Wrapper */}
      <div className="flex flex-col flex-1 lg:ml-[260px]">
        {/* Header - Contains logo (mobile), menu trigger, search, notifications, user menu */}
        <Demo1Header />

        {/* Main Content Area - Offset for fixed header */}
        <main className="flex-1 p-5 lg:p-7.5 pt-[70px]" role="main">
          <div className="container-fixed max-w-screen-2xl mx-auto">{children}</div>
        </main>

        {/* Footer */}
        <Demo1Footer />
      </div>
    </div>
  )
}
