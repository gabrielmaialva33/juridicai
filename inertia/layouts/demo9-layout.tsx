import { ReactNode } from 'react'
import { Demo9Header } from '@/components/demos/demo9/header'
import { Demo9MobileMenu } from '@/components/demos/demo9/mobile-menu'

interface Demo9LayoutProps {
  children: ReactNode
}

export function Demo9Layout({ children }: Demo9LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Demo9Header />
      <Demo9MobileMenu />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  )
}
