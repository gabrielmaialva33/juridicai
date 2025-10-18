import { ReactNode } from 'react'
import { Demo10Header } from '@/components/demos/demo10/header'
import { Demo10Sidebar } from '@/components/demos/demo10/sidebar'

interface Demo10LayoutProps {
  children: ReactNode
}

export function Demo10Layout({ children }: Demo10LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile, drawer toggle via header */}
      <div
        id="demo10-sidebar"
        className="hidden lg:flex flex-col shrink-0 [--kt-drawer-enable:true] lg:[--kt-drawer-enable:false]"
        data-kt-drawer="true"
        data-kt-drawer-class="kt-drawer kt-drawer-start flex"
      >
        <Demo10Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Demo10Header />
        <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
      </div>
    </div>
  )
}
