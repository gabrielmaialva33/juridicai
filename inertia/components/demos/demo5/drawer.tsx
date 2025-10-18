export function Demo5Drawer() {
  return (
    <div
      id="demo5-drawer"
      className="fixed top-0 left-0 z-40 w-80 h-screen bg-background border-r border-border transform -translate-x-full transition-transform"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start"
    >
      <div className="h-full flex flex-col">
        {/* Drawer Header */}
        <div className="h-16 px-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">Menu</h3>
          <button className="p-2 hover:bg-accent rounded-md" data-kt-drawer-dismiss="#demo5-drawer">
            <i className="ki-filled ki-cross text-lg"></i>
          </button>
        </div>

        {/* Drawer Content */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-accent"
            >
              <i className="ki-filled ki-home-3 text-xl"></i>
              <span className="text-sm font-medium">Dashboard</span>
            </a>
            <a
              href="/clients"
              className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-accent"
            >
              <i className="ki-filled ki-profile-circle text-xl"></i>
              <span className="text-sm font-medium">Clientes</span>
            </a>
            <a
              href="/cases"
              className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-accent"
            >
              <i className="ki-filled ki-document text-xl"></i>
              <span className="text-sm font-medium">Processos</span>
            </a>
            <a
              href="/deadlines"
              className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-accent"
            >
              <i className="ki-filled ki-calendar text-xl"></i>
              <span className="text-sm font-medium">Prazos</span>
            </a>
            <a
              href="/documents"
              className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-accent"
            >
              <i className="ki-filled ki-file text-xl"></i>
              <span className="text-sm font-medium">Documentos</span>
            </a>
          </div>

          {/* Collapsible Section Example */}
          <div className="mt-6">
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-md hover:bg-accent">
              <div className="flex items-center gap-3">
                <i className="ki-filled ki-setting-2 text-xl"></i>
                <span className="text-sm font-medium">Configurações</span>
              </div>
              <i className="ki-filled ki-down text-xs"></i>
            </button>
          </div>
        </nav>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">© 2025 JuridicAI</p>
        </div>
      </div>
    </div>
  )
}
