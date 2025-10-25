import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'

import { useClients } from '@/hooks/use-clients'
import type { ClientFilters } from '@/types/api'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Custom components (to be created)
import { ClientsTable } from '@/components/clients/clients-table'
import { ClientFormDialog } from '@/components/clients/client-form-dialog'

function Clients() {
  const [filters, setFilters] = useState<ClientFilters>({
    page: 1,
    per_page: 10,
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { data: clientsData, isLoading, error } = useClients(filters)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }))
  }

  const handleTypeChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      client_type: value === 'all' ? undefined : (value as 'individual' | 'company'),
      page: 1,
    }))
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  return (
    <>
      <Head title="Clientes" />

      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie seus clientes e informações de contato
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Refine sua busca de clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF, CNPJ ou email..."
                    className="pl-9"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Client Type Filter */}
              <div>
                <Select value={filters.client_type || 'all'} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="individual">Pessoa Física</SelectItem>
                    <SelectItem value="company">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center">
                <p className="text-destructive">Erro ao carregar clientes: {error.message}</p>
              </div>
            ) : (
              <ClientsTable
                data={clientsData?.data || []}
                meta={clientsData?.meta}
                isLoading={isLoading}
                onPageChange={handlePageChange}
              />
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <ClientFormDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          mode="create"
        />
      </div>
    </>
  )
}

Clients.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default Clients
