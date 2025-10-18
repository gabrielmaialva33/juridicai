import { ReactNode } from 'react'
import { Demo1Header } from '@/components/demos/demo1/header'
import { Demo1Sidebar } from '@/components/demos/demo1/sidebar'
import { Demo1Footer } from '@/components/demos/demo1/footer'

interface Demo1LayoutProps {
  children: ReactNode
}

export function Demo1Layout({ children }: Demo1LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Classic fixed sidebar */}
      <Demo1Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Fixed Header */}
        <Demo1Header />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Footer */}
        <Demo1Footer />
      </div>
    </div>
  )
}
