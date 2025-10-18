import { ReactNode } from 'react'
import { useBodyClass } from '@/hooks/use_body_class'
import { useIsMobile } from '@/hooks/use_media_query'
import { useTypedPage } from '@/hooks/use_typed_page'
import { Demo6Sidebar } from '@/components/demos/demo6/sidebar'
import { Demo6Header } from '@/components/demos/demo6/header'
import { Demo6Footer } from '@/components/demos/demo6/footer'

interface Demo6LayoutProps {
  children: ReactNode
}

/**
 * Demo6Layout - Professional Sidebar with Search
 *
 * Features:
 * - Fixed left sidebar (270px) with search bar and navigation
 * - Header only on mobile (responsive drawer)
 * - Content area with rounded corners and border
 * - Clean, modern design with proper spacing
 * - Body classes for CSS variables: --header-height, --sidebar-width
 */
export function Demo6Layout({ children }: Demo6LayoutProps) {
  const { props } = useTypedPage()
  const isMobile = useIsMobile()

  // Apply layout-specific body classes
  useBodyClass('[--header-height:60px] [--sidebar-width:270px] lg:overflow-hidden bg-muted!')

  return (
    <div className="flex min-h-screen bg-muted">
      {/* Sidebar - Desktop Only (270px fixed width) */}
      {!isMobile && <Demo6Sidebar currentPath={props.currentPath || '/dashboard'} />}

      {/* Main Content Wrapper */}
      <div className="flex flex-col flex-1 lg:ml-[270px]">
        {/* Header - Mobile Only */}
        {isMobile && <Demo6Header />}

        {/* Content Area with Rounded Border */}
        <div className="flex-1 m-[15px] lg:mt-[15px] lg:mr-[15px] lg:mb-[15px] rounded-xl bg-background border border-border overflow-hidden flex flex-col">
          {/* Scrollable Content */}
          <main className="flex-1 overflow-y-auto">{children}</main>

          {/* Footer */}
          <Demo6Footer />
        </div>
      </div>
    </div>
  )
}
