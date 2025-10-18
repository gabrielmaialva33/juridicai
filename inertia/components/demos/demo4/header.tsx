import { Logo } from '@/components/layout/common/logo'
import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'

export function Demo4Header() {
  return (
    <header className="border-b border-border bg-background">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {/* Dashboard */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary rounded-md hover:bg-accent">
                <i className="ki-filled ki-home-3 text-lg"></i>
                <span>Dashboard</span>
                <i className="ki-filled ki-down text-xs"></i>
              </button>
              <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Dashboard Options</h3>
                  <a
                    href="/dashboard"
                    className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                  >
                    Overview
                  </a>
                  <a
                    href="/dashboard/analytics"
                    className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                  >
                    Analytics
                  </a>
                  <a
                    href="/dashboard/reports"
                    className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                  >
                    Reports
                  </a>
                </div>
              </div>
            </div>

            {/* Clientes */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary rounded-md hover:bg-accent">
                <i className="ki-filled ki-profile-circle text-lg"></i>
                <span>Clientes</span>
                <i className="ki-filled ki-down text-xs"></i>
              </button>
              <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Gestão de Clientes</h3>
                  <a href="/clients" className="block py-2 px-3 text-sm hover:bg-accent rounded-md">
                    Todos os Clientes
                  </a>
                  <a
                    href="/clients/create"
                    className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                  >
                    Novo Cliente
                  </a>
                </div>
              </div>
            </div>

            {/* Processos */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary rounded-md hover:bg-accent">
                <i className="ki-filled ki-document text-lg"></i>
                <span>Processos</span>
                <i className="ki-filled ki-down text-xs"></i>
              </button>
              <div className="absolute top-full left-0 mt-1 w-80 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Processos</h3>
                    <a href="/cases" className="block py-2 px-3 text-sm hover:bg-accent rounded-md">
                      Todos
                    </a>
                    <a
                      href="/cases/active"
                      className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                    >
                      Ativos
                    </a>
                    <a
                      href="/cases/archived"
                      className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                    >
                      Arquivados
                    </a>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Ações</h3>
                    <a
                      href="/cases/create"
                      className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                    >
                      Novo Processo
                    </a>
                    <a
                      href="/cases/import"
                      className="block py-2 px-3 text-sm hover:bg-accent rounded-md"
                    >
                      Importar
                    </a>
                  </div>
                </div>
              </div>
            </div>
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
