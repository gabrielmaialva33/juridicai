import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { useState } from 'react'
import { Plus, Search, FolderOpen } from 'lucide-react'

import { useCases } from '@/hooks/use-cases'
import type { CaseFilters } from '@/types/api'
import { CaseFormDialog } from '@/components/cases/case-form-dialog'

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
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const STATUS_LABELS = {
  active: 'Ativo',
  closed: 'Encerrado',
  archived: 'Arquivado',
  suspended: 'Suspenso',
}

const STATUS_COLORS = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400',
  closed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  archived: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  suspended: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
}

const CASE_TYPE_LABELS = {
  civil: 'Cível',
  criminal: 'Criminal',
  labor: 'Trabalhista',
  family: 'Família',
  tax: 'Tributário',
  administrative: 'Administrativo',
  other: 'Outro',
}

const PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

const PRIORITY_COLORS = {
  low: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  medium: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  high: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  urgent: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

function Cases() {
  const [filters, setFilters] = useState<CaseFilters>({
    page: 1,
    per_page: 10,
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { data: casesData, isLoading, error } = useCases(filters)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }))
  }

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      status:
        value === 'all' ? undefined : (value as 'active' | 'closed' | 'archived' | 'suspended'),
      page: 1,
    }))
  }

  const handleCaseTypeChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      case_type: value === 'all' ? undefined : (value as any),
      page: 1,
    }))
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const formatCurrency = (value: string | null) => {
    if (!value) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value))
  }

  return (
    <>
      <Head title="Processos" />

      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 backdrop-blur-xl shadow-lg shadow-primary/20 border border-primary/30 text-primary">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Processos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe todos os processos jurídicos
              </p>
            </div>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo Processo
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Refine sua busca de processos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, cliente ou descrição..."
                    className="pl-9"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Case Type Filter */}
              <div>
                <Select value={filters.case_type || 'all'} onValueChange={handleCaseTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="civil">Cível</SelectItem>
                    <SelectItem value="criminal">Criminal</SelectItem>
                    <SelectItem value="labor">Trabalhista</SelectItem>
                    <SelectItem value="family">Família</SelectItem>
                    <SelectItem value="tax">Tributário</SelectItem>
                    <SelectItem value="administrative">Administrativo</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases Table */}
        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center">
                <p className="text-destructive">Erro ao carregar processos: {error.message}</p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Carregando processos...</p>
              </div>
            ) : !casesData?.data.length ? (
              <div className="p-8 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum processo encontrado</h3>
                <p className="text-muted-foreground">
                  Comece criando seu primeiro processo clicando no botão acima.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Valor da Causa</TableHead>
                        <TableHead>Tribunal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {casesData.data.map((caseItem) => (
                        <TableRow key={caseItem.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {caseItem.case_number || caseItem.internal_number}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{CASE_TYPE_LABELS[caseItem.case_type]}</Badge>
                          </TableCell>
                          <TableCell>
                            {caseItem.client?.full_name || caseItem.client?.company_name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[caseItem.status]}>
                              {STATUS_LABELS[caseItem.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={PRIORITY_COLORS[caseItem.priority]}>
                              {PRIORITY_LABELS[caseItem.priority]}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(caseItem.case_value)}</TableCell>
                          <TableCell>{caseItem.court || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {casesData.meta && casesData.meta.lastPage > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {casesData.meta.from} a {casesData.meta.to} de{' '}
                      {casesData.meta.total} processos
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(casesData.meta!.currentPage - 1)}
                        disabled={casesData.meta.currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(casesData.meta!.currentPage + 1)}
                        disabled={casesData.meta.currentPage === casesData.meta.lastPage}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <CaseFormDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          mode="create"
        />
      </div>
    </>
  )
}

Cases.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default Cases
