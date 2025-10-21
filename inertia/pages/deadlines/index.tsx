import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { useState } from 'react'
import { Plus, Search, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { useDeadlines, useUpcomingDeadlines } from '@/hooks/use-deadlines'
import type { DeadlineFilters } from '@/types/api'
import { DeadlineFormDialog } from '@/components/deadlines/deadline-form-dialog'

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
import { cn } from '@/lib/utils'

const STATUS_LABELS = {
  pending: 'Pendente',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
  cancelled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
}

function Deadlines() {
  const [filters, setFilters] = useState<DeadlineFilters>({
    page: 1,
    per_page: 10,
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { data: deadlinesData, isLoading, error } = useDeadlines(filters)
  const { data: upcomingDeadlines } = useUpcomingDeadlines(7)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }))
  }

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      status: value === 'all' ? undefined : (value as 'pending' | 'completed' | 'cancelled'),
      page: 1,
    }))
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  }

  const getDeadlineUrgency = (deadlineDate: string, status: string) => {
    if (status !== 'pending') return null

    const date = new Date(deadlineDate)
    if (isPast(date)) return 'overdue'
    if (isToday(date)) return 'today'
    if (isTomorrow(date)) return 'tomorrow'

    const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 3) return 'soon'

    return 'normal'
  }

  const getUrgencyBadge = (urgency: string | null) => {
    switch (urgency) {
      case 'overdue':
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">Atrasado</Badge>
      case 'today':
        return <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400">Hoje</Badge>
      case 'tomorrow':
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Amanhã</Badge>
      case 'soon':
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">Em breve</Badge>
      default:
        return null
    }
  }

  return (
    <>
      <Head title="Prazos" />

      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 backdrop-blur-xl shadow-lg shadow-primary/20 border border-primary/30 text-primary">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Prazos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie e acompanhe todos os prazos processuais
              </p>
            </div>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo Prazo
          </Button>
        </div>

        {/* Upcoming Deadlines Card */}
        {upcomingDeadlines && upcomingDeadlines.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Prazos Urgentes (Próximos 7 Dias)
              </CardTitle>
              <CardDescription>
                {upcomingDeadlines.length} prazo(s) com vencimento próximo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 5).map((deadline) => {
                  const urgency = getDeadlineUrgency(deadline.deadline_date, deadline.status)
                  return (
                    <div
                      key={deadline.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{deadline.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Vencimento: {formatDate(deadline.deadline_date)}
                          </p>
                        </div>
                      </div>
                      {getUrgencyBadge(urgency)}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Refine sua busca de prazos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título ou descrição..."
                    className="pl-9"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deadlines Table */}
        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center">
                <p className="text-destructive">Erro ao carregar prazos: {error.message}</p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Carregando prazos...</p>
              </div>
            ) : !deadlinesData?.data.length ? (
              <div className="p-8 text-center">
                <Calendar className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum prazo encontrado</h3>
                <p className="text-muted-foreground">
                  Comece criando seu primeiro prazo clicando no botão acima.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead>Data do Prazo</TableHead>
                        <TableHead>Prazo Interno</TableHead>
                        <TableHead>Fatal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Urgência</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deadlinesData.data.map((deadline) => {
                        const urgency = getDeadlineUrgency(deadline.deadline_date, deadline.status)
                        const isOverdue = urgency === 'overdue'

                        return (
                          <TableRow
                            key={deadline.id}
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              isOverdue && "bg-red-50/50 dark:bg-red-950/10"
                            )}
                          >
                            <TableCell className="font-medium">
                              <div>
                                {deadline.title}
                                {deadline.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {deadline.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {deadline.case?.case_number || deadline.case?.internal_number || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(deadline.deadline_date)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {deadline.internal_deadline_date ? formatDate(deadline.internal_deadline_date) : '-'}
                            </TableCell>
                            <TableCell>
                              {deadline.is_fatal ? (
                                <Badge variant="destructive" className="text-xs">Fatal</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Não Fatal</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[deadline.status]}>
                                {STATUS_LABELS[deadline.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getUrgencyBadge(urgency)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {deadlinesData.meta && deadlinesData.meta.lastPage > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {deadlinesData.meta.from} a {deadlinesData.meta.to} de {deadlinesData.meta.total} prazos
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(deadlinesData.meta!.currentPage - 1)}
                        disabled={deadlinesData.meta.currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(deadlinesData.meta!.currentPage + 1)}
                        disabled={deadlinesData.meta.currentPage === deadlinesData.meta.lastPage}
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
        <DeadlineFormDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          mode="create"
        />
      </div>
    </>
  )
}

Deadlines.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default Deadlines
