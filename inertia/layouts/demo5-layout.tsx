import { ReactNode } from 'react'
import { Demo5Header } from '@/components/demos/demo5/header'
import { Demo5Drawer } from '@/components/demos/demo5/drawer'
import { Demo5Footer } from '@/components/demos/demo5/footer'

interface Demo5LayoutProps {
  children: ReactNode
}

export function Demo5Layout({ children }: Demo5LayoutProps) {
  return (
    <>
      {/* Drawer Navigation - Toggleable from header */}
      <Demo5Drawer />

      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header with Drawer Toggle */}
        <Demo5Header />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Footer */}
        <Demo5Footer />
      </div>
    </>
  )
}
