import { Logo } from '@/components/layout/common/logo'
import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'

export function Demo3Header() {
  return (
    <header className="border-b border-border bg-background">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <i className="ki-filled ki-home-3 text-lg"></i>
              <span>Dashboard</span>
            </a>
            <a
              href="/clients"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <i className="ki-filled ki-profile-circle text-lg"></i>
              <span>Clientes</span>
            </a>
            <a
              href="/cases"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <i className="ki-filled ki-document text-lg"></i>
              <span>Processos</span>
            </a>
            <a
              href="/deadlines"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <i className="ki-filled ki-calendar text-lg"></i>
              <span>Prazos</span>
            </a>
            <a
              href="/documents"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <i className="ki-filled ki-file text-lg"></i>
              <span>Documentos</span>
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Notifications />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
