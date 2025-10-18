export function Demo9MobileMenu() {
  return (
    <div
      id="demo9-mobile-menu"
      className="fixed inset-y-0 right-0 z-50 w-64 bg-card border-l border-border shadow-lg transform translate-x-full transition-transform [--kt-drawer-enable:true] md:[--kt-drawer-enable:false]"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-end flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">Menu</h3>
        <button className="p-2" data-kt-drawer-dismiss="true">
          <i className="ki-filled ki-cross text-xl"></i>
        </button>
      </div>
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          <a
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            <i className="ki-filled ki-home-3"></i>
            <span>Dashboard</span>
          </a>
          <a
            href="/cases"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            <i className="ki-filled ki-document"></i>
            <span>Processos</span>
          </a>
          <a
            href="/clients"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            <i className="ki-filled ki-profile-circle"></i>
            <span>Clientes</span>
          </a>
          <a
            href="/deadlines"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            <i className="ki-filled ki-calendar"></i>
            <span>Prazos</span>
          </a>
          <a
            href="/documents"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            <i className="ki-filled ki-file"></i>
            <span>Documentos</span>
          </a>
        </div>
      </nav>
    </div>
  )
}
