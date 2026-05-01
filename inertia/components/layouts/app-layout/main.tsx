import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useLayout } from './context'
import { Header } from './header'
import { Sidebar, SIDEBAR_SIZES } from './sidebar'

const HEADER_HEIGHT = 64
const HEADER_HEIGHT_MOBILE = 56

export function Main({
  children,
  tenantName,
}: {
  children: ReactNode
  tenantName?: string | null
}) {
  const isMobile = useIsMobile()
  const { sidebarCollapse } = useLayout()

  const sidebarWidth = sidebarCollapse
    ? SIDEBAR_SIZES.SIDEBAR_WIDTH_COLLAPSE
    : SIDEBAR_SIZES.SIDEBAR_WIDTH
  const headerHeight = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT

  return (
    <>
      {!isMobile && <Sidebar />}
      <div
        className="flex min-h-screen grow flex-col transition-[padding] duration-300 ease-in-out"
        style={{
          paddingInlineStart: isMobile ? 0 : sidebarWidth,
          paddingTop: headerHeight,
        }}
      >
        <Header
          sidebarWidth={!isMobile ? sidebarWidth : 0}
          headerHeight={headerHeight}
          tenantName={tenantName}
        />
        <main className="grow px-4 lg:px-8 py-6">{children}</main>
      </div>
    </>
  )
}
