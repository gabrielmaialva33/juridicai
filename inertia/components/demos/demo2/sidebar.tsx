import { Logo } from '@/components/layout/common/logo'

export function Demo2Sidebar() {
  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center">
      <div className="p-4">
        <Logo variant="icon" />
      </div>
      <nav className="px-2 py-4 flex-1 flex flex-col gap-2">
        {/* Compact icon-only navigation */}
        <a
          href="/dashboard"
          className="p-3 rounded-md hover:bg-accent flex items-center justify-center"
          title="Dashboard"
        >
          <i className="ki-filled ki-home-3 text-xl"></i>
        </a>
        <a
          href="/clients"
          className="p-3 rounded-md hover:bg-accent flex items-center justify-center"
          title="Clientes"
        >
          <i className="ki-filled ki-profile-circle text-xl"></i>
        </a>
        <a
          href="/cases"
          className="p-3 rounded-md hover:bg-accent flex items-center justify-center"
          title="Processos"
        >
          <i className="ki-filled ki-document text-xl"></i>
        </a>
        <a
          href="/deadlines"
          className="p-3 rounded-md hover:bg-accent flex items-center justify-center"
          title="Prazos"
        >
          <i className="ki-filled ki-calendar text-xl"></i>
        </a>
      </nav>
    </aside>
  )
}
