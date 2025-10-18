import { ReactNode } from 'react'
import { Demo8Header } from '@/components/demos/demo8/header'
import { Demo8Sidebar } from '@/components/demos/demo8/sidebar'

interface Demo8LayoutProps {
  children: ReactNode
}

export function Demo8Layout({ children }: Demo8LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile, drawer toggle via header */}
      <div
        id="demo8-sidebar"
        className="hidden lg:flex flex-col shrink-0 [--kt-drawer-enable:true] lg:[--kt-drawer-enable:false]"
        data-kt-drawer="true"
        data-kt-drawer-class="kt-drawer kt-drawer-start flex"
      >
        <Demo8Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Demo8Header />
        <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
      </div>
    </div>
  )
}
