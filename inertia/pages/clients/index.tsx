import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { Users } from 'lucide-react'

function Clients() {
  return (
    <>
      <Head title="Clientes" />

      <div className="p-4 sm:p-5 lg:p-6">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 backdrop-blur-xl shadow-lg shadow-primary/20 border border-primary/30 text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie seus clientes e informações de contato
            </p>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30 rounded-lg p-8 text-center">
          <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Página de Clientes</h2>
          <p className="text-muted-foreground">
            A navegação está funcionando! Esta página será desenvolvida em breve.
          </p>
        </div>
      </div>
    </>
  )
}

Clients.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default Clients
