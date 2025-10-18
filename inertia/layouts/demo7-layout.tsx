import { ReactNode } from 'react'
import { Demo7Header } from '@/components/demos/demo7/header'
import { Demo7Sidebar } from '@/components/demos/demo7/sidebar'

interface Demo7LayoutProps {
  children: ReactNode
}

export function Demo7Layout({ children }: Demo7LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile, drawer toggle via header */}
      <div
        id="demo7-sidebar"
        className="hidden lg:flex flex-col shrink-0 [--kt-drawer-enable:true] lg:[--kt-drawer-enable:false]"
        data-kt-drawer="true"
        data-kt-drawer-class="kt-drawer kt-drawer-start flex"
      >
        <Demo7Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Demo7Header />
        <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
      </div>
    </div>
  )
}
