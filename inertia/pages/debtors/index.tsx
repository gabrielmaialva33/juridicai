import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import { Building2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '~/components/shared/page-header'
import { EmptyState } from '~/components/shared/empty-state'
import { fmtNum, fmtRelative } from '~/lib/helpers'

type Debtor = {
  id: string
  name: string
  debtorType: string
  cnpj?: string | null
  stateCode?: string | null
  paymentRegime?: string | null
  paymentReliabilityScore?: number | null
  createdAt: string
  updatedAt: string
}

type Pagination = {
  data: Debtor[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}

type Filters = {
  page: number
  limit: number
  q?: string | null
  debtorType?: string | null
  stateCode?: string | null
  paymentRegime?: string | null
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

type Props = {
  debtors: Pagination
  filters: Filters
}

const DEBTOR_TYPE_LABEL: Record<string, string> = {
  union: 'União',
  state: 'Estado',
  municipality: 'Município',
  autarchy: 'Autarquia',
  foundation: 'Fundação',
}

export default function DebtorsIndex({ debtors, filters }: Props) {
  const [search, setSearch] = useState(filters.q ?? '')

  function applyFilter(patch: Partial<Filters>) {
    const next: Record<string, any> = { ...filters, ...patch, page: patch.page ?? 1 }
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === undefined || next[k] === '') delete next[k]
    })
    router.get('/debtors', next, { preserveState: true, preserveScroll: true })
  }

  function clearFilters() {
    setSearch('')
    router.get(
      '/debtors',
      { page: 1, limit: filters.limit, sortBy: 'name', sortDirection: 'asc' },
      { preserveState: false }
    )
  }

  const hasFilters = !!(
    filters.q ||
    filters.debtorType ||
    filters.stateCode ||
    filters.paymentRegime
  )

  return (
    <>
      <Head title="Devedores" />

      <PageHeader
        title="Devedores"
        description={`${fmtNum(debtors.meta.total)} entes públicos cadastrados.`}
        breadcrumbs={[{ label: 'Devedores' }]}
      >
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="me-1 size-3.5" />
            Limpar filtros
          </Button>
        )}
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilter({ q: search || null })}
                onBlur={() => filters.q !== search && applyFilter({ q: search || null })}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.debtorType ?? '__all'}
              onValueChange={(v) => applyFilter({ debtorType: v === '__all' ? null : v })}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                <SelectItem value="union">União</SelectItem>
                <SelectItem value="state">Estado</SelectItem>
                <SelectItem value="municipality">Município</SelectItem>
                <SelectItem value="autarchy">Autarquia</SelectItem>
                <SelectItem value="foundation">Fundação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {debtors.data.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-12" />}
              message="Sem devedores"
              description={
                hasFilters
                  ? 'Ajuste os filtros pra ver mais resultados.'
                  : 'Importe precatórios SIOP para popular os devedores.'
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Regime</TableHead>
                    <TableHead className="text-end">Confiabilidade</TableHead>
                    <TableHead className="text-end">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtors.data.map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.visit(`/debtors/${d.id}`)}
                    >
                      <TableCell className="font-medium max-w-md">
                        <div className="truncate">{d.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {DEBTOR_TYPE_LABEL[d.debtorType] ?? d.debtorType}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.stateCode ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {d.cnpj ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.paymentRegime ?? '—'}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {d.paymentReliabilityScore !== null &&
                        d.paymentReliabilityScore !== undefined
                          ? d.paymentReliabilityScore.toFixed(1)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                        {fmtRelative(d.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {debtors.meta.lastPage > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                  <div className="tabular-nums">
                    Página {debtors.meta.currentPage} de {debtors.meta.lastPage} ·{' '}
                    {fmtNum(debtors.meta.total)} resultados
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={debtors.meta.currentPage <= 1}
                      onClick={() => applyFilter({ page: debtors.meta.currentPage - 1 })}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={debtors.meta.currentPage >= debtors.meta.lastPage}
                      onClick={() => applyFilter({ page: debtors.meta.currentPage + 1 })}
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
    </>
  )
}
