import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import { Building2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '~/components/shared/empty-state'
import { FilterPanel, SearchFilter, SelectFilter } from '~/components/shared/filter-controls'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
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

const DEBTOR_TYPE_OPTIONS = Object.entries(DEBTOR_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}))

const REGIME_LABEL: Record<string, string> = {
  federal_unique: 'Federal',
  ordinary: 'Ordinário',
  special: 'Especial',
  direct_agreement: 'Acordo direto',
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

  function commitSearch() {
    if ((filters.q ?? '') !== search) {
      applyFilter({ q: search || null })
    }
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

      <FilterPanel>
        <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_minmax(10rem,12rem)]">
          <SearchFilter
            value={search}
            onChange={setSearch}
            onCommit={commitSearch}
            placeholder="Nome ou CNPJ"
          />
          <SelectFilter
            label="Tipo"
            value={filters.debtorType}
            options={DEBTOR_TYPE_OPTIONS}
            onChange={(value) => applyFilter({ debtorType: value })}
          />
        </div>
      </FilterPanel>

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
              <Table className="min-w-[880px]">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[320px]">Nome</TableHead>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead className="w-[72px]">UF</TableHead>
                    <TableHead className="w-[150px]">CNPJ</TableHead>
                    <TableHead className="w-[130px]">Regime</TableHead>
                    <TableHead className="w-[120px] text-end">Confiabilidade</TableHead>
                    <TableHead className="w-[110px] text-end">Atualizado</TableHead>
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
                        <LabelChip>{DEBTOR_TYPE_LABEL[d.debtorType] ?? d.debtorType}</LabelChip>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.stateCode ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {d.cnpj ?? '—'}
                      </TableCell>
                      <TableCell>
                        {d.paymentRegime ? (
                          <LabelChip variant={d.paymentRegime === 'special' ? 'warning' : 'info'}>
                            {REGIME_LABEL[d.paymentRegime] ?? d.paymentRegime}
                          </LabelChip>
                        ) : (
                          '—'
                        )}
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
