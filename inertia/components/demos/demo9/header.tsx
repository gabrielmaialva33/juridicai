import { Logo } from '@/components/layout/common/logo'
import { UserMenu } from '@/components/layout/common/user-menu'

export function Demo9Header() {
  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Logo size="sm" />
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/cases"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Processos
            </a>
            <a
              href="/clients"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clientes
            </a>
            <a
              href="/deadlines"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Prazos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button className="md:hidden p-2" data-kt-drawer-toggle="#demo9-mobile-menu">
              <i className="ki-filled ki-menu text-xl"></i>
            </button>
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
