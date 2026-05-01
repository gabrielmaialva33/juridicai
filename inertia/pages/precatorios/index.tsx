import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react'
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
import { StatusBadge } from '~/components/status-badge'
import { fmtBRL, fmtNum, fmtRelative } from '~/lib/helpers'

const LIFECYCLE_OPTIONS = [
  { value: 'unknown', label: 'Sem sinal' },
  { value: 'discovered', label: 'Novo' },
  { value: 'expedited', label: 'Expedido' },
  { value: 'pending', label: 'Em fila' },
  { value: 'in_payment', label: 'Em pagamento' },
  { value: 'paid', label: 'Pago' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'suspended', label: 'Suspenso' },
]

const COMPLIANCE_OPTIONS = [
  { value: 'pending', label: 'Sem revisão' },
  { value: 'approved_for_analysis', label: 'Elegível' },
  { value: 'approved_for_sales', label: 'Negociável' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'opt_out', label: 'Opt-out' },
]

const NATURE_OPTIONS = [
  { value: 'alimentar', label: 'Alimentar' },
  { value: 'comum', label: 'Comum' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'unknown', label: 'Desconhecida' },
]

const SOURCE_OPTIONS = [
  { value: 'siop', label: 'SIOP' },
  { value: 'datajud', label: 'DataJud' },
  { value: 'djen', label: 'DJEN' },
  { value: 'tribunal', label: 'Tribunal' },
  { value: 'manual', label: 'Manual' },
  { value: 'api_private', label: 'API privada' },
]

const NATURE_LABELS = Object.fromEntries(
  NATURE_OPTIONS.map((option) => [option.value, option.label])
)

type Asset = {
  id: string
  cnjNumber?: string | null
  externalId?: string | null
  source: string
  nature: string
  exerciseYear?: number | null
  faceValue?: string | number | null
  estimatedUpdatedValue?: string | number | null
  lifecycleStatus: string
  complianceStatus: string
  piiStatus: string
  currentScore?: number | null
  createdAt: string
  debtor?: {
    id: string
    name: string
    debtorType?: string
    stateCode?: string | null
  } | null
}

type Pagination = {
  data: Asset[]
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
  debtorId?: string | null
  source?: string | null
  nature?: string | null
  lifecycleStatus?: string | null
  complianceStatus?: string | null
  exerciseYearFrom?: number | null
  exerciseYearTo?: number | null
  minFaceValue?: number | null
  maxFaceValue?: number | null
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

type Props = {
  assets: Pagination
  filters: Filters
}

const SORTABLE = new Set(['created_at', 'face_value', 'exercise_year', 'current_score'])

export default function PrecatoriosIndex({ assets, filters }: Props) {
  const [search, setSearch] = useState(filters.q ?? '')

  function applyFilter(patch: Partial<Filters>) {
    const next: Record<string, any> = { ...filters, ...patch, page: patch.page ?? 1 }
    Object.keys(next).forEach((key) => {
      if (next[key] === null || next[key] === undefined || next[key] === '') delete next[key]
    })
    router.get('/precatorios', next, { preserveState: true, preserveScroll: true })
  }

  function toggleSort(col: string) {
    if (!SORTABLE.has(col)) return

    if (filters.sortBy === col) {
      applyFilter({ sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc' })
      return
    }

    applyFilter({ sortBy: col as Filters['sortBy'], sortDirection: 'desc' })
  }

  function commitSearch() {
    if ((filters.q ?? '') !== search) {
      applyFilter({ q: search || null })
    }
  }

  function clearFilters() {
    setSearch('')
    router.get(
      '/precatorios',
      { page: 1, limit: filters.limit, sortBy: 'created_at', sortDirection: 'desc' },
      { preserveState: false }
    )
  }

  const hasFilters = !!(
    filters.q ||
    filters.debtorId ||
    filters.source ||
    filters.nature ||
    filters.lifecycleStatus ||
    filters.complianceStatus ||
    filters.exerciseYearFrom ||
    filters.exerciseYearTo ||
    filters.minFaceValue ||
    filters.maxFaceValue
  )

  return (
    <>
      <Head title="Base de Ativos" />

      <PageHeader
        title="Base de Ativos"
        description={`${fmtNum(assets.meta.total)} precatórios monitorados para originação.`}
        breadcrumbs={[{ label: 'Base de Ativos' }]}
      >
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="me-1 size-3.5" />
            Limpar filtros
          </Button>
        )}
      </PageHeader>

      <FilterPanel>
        <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_repeat(4,minmax(9.5rem,11rem))]">
          <SearchFilter
            value={search}
            onChange={setSearch}
            onCommit={commitSearch}
            placeholder="CNJ, devedor ou identificador de origem"
          />
          <SelectFilter
            label="Etapa"
            value={filters.lifecycleStatus}
            onChange={(value) => applyFilter({ lifecycleStatus: value })}
            options={LIFECYCLE_OPTIONS}
          />
          <SelectFilter
            label="Revisão"
            value={filters.complianceStatus}
            onChange={(value) => applyFilter({ complianceStatus: value })}
            options={COMPLIANCE_OPTIONS}
          />
          <SelectFilter
            label="Natureza"
            value={filters.nature}
            onChange={(value) => applyFilter({ nature: value })}
            options={NATURE_OPTIONS}
          />
          <SelectFilter
            label="Origem"
            value={filters.source}
            onChange={(value) => applyFilter({ source: value })}
            options={SOURCE_OPTIONS}
          />
        </div>
      </FilterPanel>

      <Card>
        <CardContent className="p-0">
          {assets.data.length === 0 ? (
            <EmptyState
              message="Sem ativos"
              description={
                hasFilters
                  ? 'Ajuste os filtros pra ver mais resultados.'
                  : 'Conecte uma fonte pública ou importe um arquivo SIOP para popular a base.'
              }
            >
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </EmptyState>
          ) : (
            <>
              <div className="divide-y divide-border md:hidden">
                {assets.data.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => router.visit(`/precatorios/${asset.id}`)}
                    className="block w-full px-4 py-4 text-left transition-colors hover:bg-orange-50/60 dark:hover:bg-orange-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs tabular-nums">
                          {asset.cnjNumber ?? asset.externalId ?? asset.id.slice(0, 8)}
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold">
                          {asset.debtor?.name ?? 'Devedor não identificado'}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Exec. {asset.exerciseYear ?? '—'} ·{' '}
                          {NATURE_LABELS[asset.nature] ?? asset.nature}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                        {fmtBRL(asset.faceValue)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatusBadge kind="lifecycle" value={asset.lifecycleStatus} />
                      <StatusBadge kind="compliance" value={asset.complianceStatus} />
                      <StatusBadge kind="pii" value={asset.piiStatus} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden md:block">
                <Table className="min-w-[1060px] table-fixed">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[180px]">Ativo</TableHead>
                      <TableHead className="w-[180px]">Ente/devedor</TableHead>
                      <TableHead className="w-[60px]">
                        <SortHead
                          col="exercise_year"
                          label="Exec"
                          filters={filters}
                          onClick={toggleSort}
                        />
                      </TableHead>
                      <TableHead className="w-[88px]">Classe</TableHead>
                      <TableHead className="w-[126px] text-end">
                        <SortHead
                          col="face_value"
                          label="Face"
                          filters={filters}
                          onClick={toggleSort}
                          align="end"
                        />
                      </TableHead>
                      <TableHead className="w-[86px]">Etapa</TableHead>
                      <TableHead className="w-[94px]">Revisão</TableHead>
                      <TableHead className="w-[118px]">Dados sensíveis</TableHead>
                      <TableHead className="w-[62px] text-end">
                        <SortHead
                          col="current_score"
                          label="Score"
                          filters={filters}
                          onClick={toggleSort}
                          align="end"
                        />
                      </TableHead>
                      <TableHead className="w-[90px] text-end">Criado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.data.map((asset) => (
                      <TableRow
                        key={asset.id}
                        className="cursor-pointer hover:bg-orange-50/60 dark:hover:bg-orange-500/10"
                        onClick={() => router.visit(`/precatorios/${asset.id}`)}
                      >
                        <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                          {asset.cnjNumber ?? asset.externalId ?? asset.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div className="truncate font-medium">{asset.debtor?.name ?? '—'}</div>
                          {asset.debtor?.stateCode && (
                            <div className="text-xs text-muted-foreground">
                              {asset.debtor.stateCode}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {asset.exerciseYear ?? '—'}
                        </TableCell>
                        <TableCell>
                          <LabelChip>{NATURE_LABELS[asset.nature] ?? asset.nature}</LabelChip>
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums">
                          {fmtBRL(asset.faceValue)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="lifecycle" value={asset.lifecycleStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="compliance" value={asset.complianceStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="pii" value={asset.piiStatus} />
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {asset.currentScore !== null && asset.currentScore !== undefined
                            ? asset.currentScore.toFixed(1)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                          {fmtRelative(asset.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {assets.meta.lastPage > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  <div className="tabular-nums">
                    Página {assets.meta.currentPage} de {assets.meta.lastPage} ·{' '}
                    {fmtNum(assets.meta.total)} resultados
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assets.meta.currentPage <= 1}
                      onClick={() => applyFilter({ page: assets.meta.currentPage - 1 })}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assets.meta.currentPage >= assets.meta.lastPage}
                      onClick={() => applyFilter({ page: assets.meta.currentPage + 1 })}
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

function SortHead({
  col,
  label,
  filters,
  onClick,
  align,
}: {
  col: string
  label: string
  filters: Filters
  onClick: (c: string) => void
  align?: 'end'
}) {
  const active = filters.sortBy === col
  const Icon = !active ? ArrowUpDown : filters.sortDirection === 'asc' ? ArrowUp : ArrowDown

  return (
    <button
      onClick={() => onClick(col)}
      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground ${
        active ? 'text-foreground' : 'text-muted-foreground'
      } ${align === 'end' ? 'justify-end' : ''}`}
    >
      {label}
      <Icon className="size-3" />
    </button>
  )
}
