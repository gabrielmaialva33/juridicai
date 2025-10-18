import { ReactNode } from 'react'
import { Demo3Header } from '@/components/demos/demo3/header'
import { Demo3Footer } from '@/components/demos/demo3/footer'

interface Demo3LayoutProps {
  children: ReactNode
}

export function Demo3Layout({ children }: Demo3LayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Navigation Header */}
      <Demo3Header />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Footer */}
      <Demo3Footer />
    </div>
  )
}
