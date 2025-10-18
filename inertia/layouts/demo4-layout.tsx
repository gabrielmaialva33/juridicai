import { ReactNode } from 'react'
import { Demo4Header } from '@/components/demos/demo4/header'
import { Demo4Footer } from '@/components/demos/demo4/footer'

interface Demo4LayoutProps {
  children: ReactNode
}

export function Demo4Layout({ children }: Demo4LayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Mega Menu Header */}
      <Demo4Header />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Footer */}
      <Demo4Footer />
    </div>
  )
}
