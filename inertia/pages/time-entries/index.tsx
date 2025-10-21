import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { useState } from 'react'
import { Plus, Search, Clock, Play, Square, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { useTimeEntries, useTimeEntryStats } from '@/hooks/use-time-entries'
import type { TimeEntryFilters } from '@/types/api'

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

function TimeEntries() {
  const [filters, setFilters] = useState<TimeEntryFilters>({
    page: 1,
    per_page: 10,
  })

  const { data: timeEntriesData, isLoading, error } = useTimeEntries(filters)
  const { data: stats } = useTimeEntryStats(filters)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }))
  }

  const handleBillableChange = (value: string) => {
    if (value === 'all') {
      setFilters((prev) => ({ ...prev, billable: undefined, page: 1 }))
    } else {
      setFilters((prev) => ({ ...prev, billable: value === 'true', page: 1 }))
    }
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  }

  const formatCurrency = (value: string | null) => {
    if (!value) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value))
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <>
      <Head title="Lançamento de Horas" />

      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 backdrop-blur-xl shadow-lg shadow-primary/20 border border-primary/30 text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Lançamento de Horas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Controle e gerencie o tempo dedicado aos processos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Play className="w-4 h-4" />
              Iniciar Timer
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Lançamento
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total de Horas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_hours.toFixed(1)}h</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Horas Faturáveis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.billable_hours.toFixed(1)}h</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Valor Total</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Lançamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.entries_count}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Refine sua busca de lançamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descrição ou processo..."
                    className="pl-9"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Billable Filter */}
              <div>
                <Select
                  value={filters.billable === undefined ? 'all' : filters.billable ? 'true' : 'false'}
                  onValueChange={handleBillableChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Faturável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Faturável</SelectItem>
                    <SelectItem value="false">Não Faturável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Entries Table */}
        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center">
                <p className="text-destructive">Erro ao carregar lançamentos: {error.message}</p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Carregando lançamentos...</p>
              </div>
            ) : !timeEntriesData?.data.length ? (
              <div className="p-8 text-center">
                <Clock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum lançamento encontrado</h3>
                <p className="text-muted-foreground">
                  Comece registrando suas horas clicando nos botões acima.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Valor/Hora</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Faturável</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntriesData.data.map((entry) => {
                        const isRunning = !entry.end_time

                        return (
                          <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {isRunning && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                )}
                                <div>
                                  {entry.description}
                                  {entry.tags && entry.tags.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {entry.tags.map((tag, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.case?.case_number || entry.case?.internal_number || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(entry.start_time)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.end_time ? formatDate(entry.end_time) : (
                                <Badge variant="outline" className="gap-1">
                                  <Play className="w-3 h-3" />
                                  Em andamento
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.hourly_rate ? formatCurrency(entry.hourly_rate) : '-'}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {entry.hourly_rate && entry.duration_hours
                                ? formatCurrency((parseFloat(entry.hourly_rate) * entry.duration_hours).toFixed(2))
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {entry.is_billable ? (
                                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  Sim
                                </Badge>
                              ) : (
                                <Badge variant="outline">Não</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {timeEntriesData.meta && timeEntriesData.meta.lastPage > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {timeEntriesData.meta.from} a {timeEntriesData.meta.to} de {timeEntriesData.meta.total} lançamentos
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(timeEntriesData.meta!.currentPage - 1)}
                        disabled={timeEntriesData.meta.currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(timeEntriesData.meta!.currentPage + 1)}
                        disabled={timeEntriesData.meta.currentPage === timeEntriesData.meta.lastPage}
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
      </div>
    </>
  )
}

TimeEntries.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default TimeEntries
