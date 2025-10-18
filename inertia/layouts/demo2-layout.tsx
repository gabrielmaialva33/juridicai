import { ReactNode } from 'react'
import { Demo2Header } from '@/components/demos/demo2/header'
import { Demo2Sidebar } from '@/components/demos/demo2/sidebar'
import { Demo2Footer } from '@/components/demos/demo2/footer'

interface Demo2LayoutProps {
  children: ReactNode
}

export function Demo2Layout({ children }: Demo2LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Compact Sidebar - Icon only */}
      <Demo2Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Fixed Header */}
        <Demo2Header />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Footer */}
        <Demo2Footer />
      </div>
    </div>
  )
}
