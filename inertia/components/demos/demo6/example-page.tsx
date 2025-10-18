import { Head } from '@inertiajs/react'
import { router } from '@inertiajs/react'
import { Demo6Layout } from '@/layouts/demo6-layout'
import { Demo6Toolbar } from './toolbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Users, Scale, Clock } from 'lucide-react'

/**
 * Example page demonstrating Demo6 Layout usage
 *
 * This example shows:
 * - How to use Demo6Toolbar with actions
 * - Proper content padding and spacing
 * - Card-based content layout
 * - Integration with Inertia.js
 */
function Demo6ExamplePage() {
  const handleExport = () => {
    console.log('Exporting data...')
    // Add your export logic here
  }

  const handleFilter = () => {
    console.log('Opening filters...')
    // Add your filter logic here
  }

  const handleNew = () => {
    router.visit('/cases/new')
  }

  return (
    <>
      <Head title="Processos - Exemplo Demo6" />

      {/* Toolbar with page actions */}
      <Demo6Toolbar
        title="Processos"
        description="Gerencie todos os processos do escritório"
        showNew={true}
        showFilter={true}
        showExport={true}
        onNew={handleNew}
        onFilter={handleFilter}
        onExport={handleExport}
      />

      {/* Main content area */}
      <div className="p-5 lg:p-7.5 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Processos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">+12% em relação ao mês anterior</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">456</div>
              <p className="text-xs text-muted-foreground">+8% em relação ao mês anterior</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audiências Agendadas</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prazos Vencendo</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Cases */}
        <Card>
          <CardHeader>
            <CardTitle>Processos Recentes</CardTitle>
            <CardDescription>Últimos processos cadastrados no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  number: '0001234-56.2024.8.26.0100',
                  client: 'João Silva',
                  matter: 'Ação Trabalhista',
                  status: 'Em Andamento',
                },
                {
                  number: '0002345-67.2024.8.26.0200',
                  client: 'Maria Santos',
                  matter: 'Ação Civil',
                  status: 'Aguardando Documentos',
                },
                {
                  number: '0003456-78.2024.8.26.0300',
                  client: 'Pedro Oliveira',
                  matter: 'Ação Penal',
                  status: 'Em Andamento',
                },
              ].map((caso, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => console.log('Navigate to case:', caso.number)}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{caso.number}</p>
                    <p className="text-sm text-muted-foreground">{caso.client}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{caso.matter}</span>
                    <Badge variant="outline">{caso.status}</Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" className="w-full">
                Ver Todos os Processos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// Attach Demo6Layout
Demo6ExamplePage.layout = (page: React.ReactNode) => <Demo6Layout>{page}</Demo6Layout>

export default Demo6ExamplePage
