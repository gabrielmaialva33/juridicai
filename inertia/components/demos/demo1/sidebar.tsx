import { Logo } from '@/components/layout/common/logo'

export function Demo1Sidebar() {
  return (
    <aside className="w-64 bg-card border-r border-border">
      <div className="p-4">
        <Logo />
      </div>
      <nav className="px-2 py-4">
        <p className="text-sm text-muted-foreground px-3">Demo 1 Sidebar</p>
        {/* Add navigation items here */}
      </nav>
    </aside>
  )
}
