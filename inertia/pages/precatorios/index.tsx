import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
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
import { StatusBadge } from '~/components/status-badge'
import { fmtBRL, fmtNum, fmtRelative } from '~/lib/helpers'

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
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === undefined || next[k] === '') delete next[k]
    })
    router.get('/precatorios', next, { preserveState: true, preserveScroll: true })
  }

  function toggleSort(col: string) {
    if (!SORTABLE.has(col)) return
    if (filters.sortBy === col) {
      applyFilter({ sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc' })
    } else {
      applyFilter({ sortBy: col as any, sortDirection: 'desc' })
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
      <Head title="Precatórios" />

      <PageHeader
        title="Precatórios"
        description={`${fmtNum(assets.meta.total)} ativos no radar federal.`}
        breadcrumbs={[{ label: 'Precatórios' }]}
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
                placeholder="Buscar CNJ, número externo ou devedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilter({ q: search || null })
                }}
                onBlur={() => filters.q !== search && applyFilter({ q: search || null })}
                className="pl-9"
              />
            </div>

            <FilterSelect
              placeholder="Lifecycle"
              value={filters.lifecycleStatus ?? undefined}
              onChange={(v) => applyFilter({ lifecycleStatus: v })}
              options={[
                'unknown',
                'discovered',
                'expedited',
                'pending',
                'in_payment',
                'paid',
                'cancelled',
                'suspended',
              ]}
            />
            <FilterSelect
              placeholder="Compliance"
              value={filters.complianceStatus ?? undefined}
              onChange={(v) => applyFilter({ complianceStatus: v })}
              options={[
                'pending',
                'approved_for_analysis',
                'approved_for_sales',
                'blocked',
                'opt_out',
              ]}
            />
            <FilterSelect
              placeholder="Natureza"
              value={filters.nature ?? undefined}
              onChange={(v) => applyFilter({ nature: v })}
              options={['alimentar', 'comum', 'tributario', 'unknown']}
            />
            <FilterSelect
              placeholder="Source"
              value={filters.source ?? undefined}
              onChange={(v) => applyFilter({ source: v })}
              options={['siop', 'datajud', 'djen', 'tribunal', 'manual', 'api_private']}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {assets.data.length === 0 ? (
            <EmptyState
              message="Sem precatórios"
              description={
                hasFilters
                  ? 'Ajuste os filtros pra ver mais resultados.'
                  : 'Importe um arquivo SIOP para popular o radar.'
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">CNJ</TableHead>
                    <TableHead>Devedor</TableHead>
                    <TableHead>
                      <SortHead
                        col="exercise_year"
                        label="Exec"
                        filters={filters}
                        onClick={toggleSort}
                      />
                    </TableHead>
                    <TableHead>Natureza</TableHead>
                    <TableHead className="text-end">
                      <SortHead
                        col="face_value"
                        label="Valor face"
                        filters={filters}
                        onClick={toggleSort}
                        align="end"
                      />
                    </TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>PII</TableHead>
                    <TableHead className="text-end">
                      <SortHead
                        col="current_score"
                        label="Score"
                        filters={filters}
                        onClick={toggleSort}
                        align="end"
                      />
                    </TableHead>
                    <TableHead className="text-end">Criado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.data.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.visit(`/precatorios/${a.id}`)}
                    >
                      <TableCell className="font-mono text-xs tabular-nums">
                        {a.cnjNumber ?? a.externalId ?? a.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">{a.debtor?.name ?? '—'}</div>
                        {a.debtor?.stateCode && (
                          <div className="text-xs text-muted-foreground">{a.debtor.stateCode}</div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {a.exerciseYear ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">{a.nature}</span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums font-medium">
                        {fmtBRL(a.faceValue)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="lifecycle" value={a.lifecycleStatus} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="compliance" value={a.complianceStatus} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="pii" value={a.piiStatus} />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {a.currentScore !== null && a.currentScore !== undefined
                          ? a.currentScore.toFixed(1)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                        {fmtRelative(a.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {assets.meta.lastPage > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
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

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string
  value?: string
  onChange: (v: string | null) => void
  options: string[]
}) {
  return (
    <Select value={value ?? '__all'} onValueChange={(v) => onChange(v === '__all' ? null : v)}>
      <SelectTrigger className="w-[160px] h-9 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">Todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
      className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${active ? 'text-foreground' : 'text-muted-foreground'} ${align === 'end' ? 'justify-end' : ''}`}
    >
      {label}
      <Icon className="size-3" />
    </button>
  )
}
