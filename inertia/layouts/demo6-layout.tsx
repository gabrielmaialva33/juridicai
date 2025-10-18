import { ReactNode } from 'react'

interface Demo6LayoutProps {
  children: ReactNode
}

export function Demo6Layout({ children }: Demo6LayoutProps) {
  return (
    <div className="flex grow">
      {/* Sidebar - visible on desktop, drawer on mobile */}
      <div
        id="sidebar"
        className="fixed top-0 bottom-0 z-20 hidden lg:flex flex-col shrink-0 w-[var(--sidebar-width)] bg-muted [--kt-drawer-enable:true] lg:[--kt-drawer-enable:false]"
        data-kt-drawer="true"
        data-kt-drawer-class="kt-drawer kt-drawer-start flex top-0 bottom-0"
      >
        {/* Sidebar Header */}
        <div id="sidebar_header">
          <div className="flex items-center gap-2.5 px-3.5 h-[70px]">
            <a href="/">
              <div className="h-[42px] w-[42px] rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                J
              </div>
            </a>
            <div className="flex-1">
              <button className="flex items-center justify-between w-full text-left">
                <span className="text-base font-medium">JuridicAI</span>
                <i className="ki-filled ki-down text-xs"></i>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="pt-2.5 px-3.5 mb-1">
            <div className="relative">
              <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input
                type="text"
                placeholder="Buscar processos, clientes..."
                className="w-full pl-10 pr-20 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground whitespace-nowrap">
                cmd + /
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Menu */}
        <div className="flex items-stretch grow shrink-0 justify-center my-5" id="sidebar_menu">
          <div className="overflow-y-auto grow px-3.5">
            <div className="flex flex-col w-full gap-1.5">
              {/* Dashboard */}
              <a
                href="/dashboard"
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-md border border-transparent hover:bg-background hover:border-border"
              >
                <i className="ki-filled ki-home-3 text-lg text-muted-foreground"></i>
                <span className="text-sm font-medium">Dashboard</span>
              </a>

              {/* Clientes */}
              <a
                href="/clients"
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-md border border-transparent hover:bg-background hover:border-border"
              >
                <i className="ki-filled ki-profile-circle text-lg text-muted-foreground"></i>
                <span className="text-sm font-medium">Clientes</span>
              </a>

              {/* Processos */}
              <a
                href="/cases"
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-md border border-transparent hover:bg-background hover:border-border"
              >
                <i className="ki-filled ki-document text-lg text-muted-foreground"></i>
                <span className="text-sm font-medium">Processos</span>
              </a>

              {/* Prazos */}
              <a
                href="/deadlines"
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-md border border-transparent hover:bg-background hover:border-border"
              >
                <i className="ki-filled ki-calendar text-lg text-muted-foreground"></i>
                <span className="text-sm font-medium">Prazos</span>
              </a>

              {/* Documentos */}
              <a
                href="/documents"
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-md border border-transparent hover:bg-background hover:border-border"
              >
                <i className="ki-filled ki-file text-lg text-muted-foreground"></i>
                <span className="text-sm font-medium">Documentos</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - only visible on mobile */}
      <header
        id="header"
        className="flex lg:hidden items-center fixed z-10 top-0 left-0 right-0 shrink-0 bg-muted h-[var(--header-height)]"
      >
        <div className="container mx-auto flex items-center justify-between px-4">
          <a href="/">
            <div className="h-[30px] w-[30px] rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              J
            </div>
          </a>
          <button className="p-2" data-kt-drawer-toggle="#sidebar">
            <i className="ki-filled ki-menu text-xl"></i>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col grow lg:ml-[var(--sidebar-width)] pt-[var(--header-height)] lg:pt-0">
        <main className="grow">{children}</main>
      </div>
    </div>
  )
}
