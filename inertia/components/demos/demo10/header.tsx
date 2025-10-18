import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'

export function Demo10Header() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2" data-kt-drawer-toggle="#demo10-sidebar">
          <i className="ki-filled ki-menu text-xl"></i>
        </button>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
            <input
              type="text"
              placeholder="Buscar processos, clientes..."
              className="w-64 pl-10 pr-4 py-2 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <i className="ki-filled ki-search-list text-xl"></i>
        </button>
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <i className="ki-filled ki-moon text-xl"></i>
        </button>
        <Notifications />
        <UserMenu />
      </div>
    </header>
  )
}
