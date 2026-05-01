import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import { Filter, Sparkles, Target } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '~/components/shared/empty-state'
import { FilterPanel, SelectFilter } from '~/components/shared/filter-controls'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
import { fmtBRL, fmtNum } from '~/lib/helpers'

type Asset = {
  id: string
  cnjNumber?: string | null
  assetNumber?: string | null
  debtorName?: string | null
  debtorType?: string | null
  nature: string
  lifecycleStatus: string
  faceValue: number
  estimatedUpdatedValue?: number | null
  exerciseYear?: number | null
  currentScore?: number | null
}

type Debtor = {
  name?: string | null
  paymentRegime?: string | null
  paymentReliabilityScore: number
  historicalMultiplier: number
  rclDebtRatio?: number | null
  averagePaymentMonths?: number | null
  onTimePaymentRate?: number | null
  regimeSpecialActive?: boolean
  recentDefault?: boolean
}

type Pipeline = {
  stage: string
  opportunityId?: string | null
  priority?: number
  targetCloseAt?: string | null
}

type Pricing = {
  faceValue: number
  offerRate: number
  offerValue: number
  termMonths: number
  expectedAnnualIrr: number
  riskAdjustedIrr: number
  paymentProbability: number
  finalScore: number
  grade: string
  decision?: string
}

type Signal = {
  code: string
  label: string
  polarity: 'positive' | 'negative'
  paymentMultiplier?: number
  eventDate?: string | null
}

type Opportunity = {
  id: string
  asset: Asset
  debtor: Debtor
  pipeline: Pipeline
  pricing: Pricing
  signals: { positive: Signal[]; negative: Signal[] }
}

type Pagination = {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

type Filters = {
  page: number
  limit: number
  q?: string | null
  grade?: string | null
  stage?: string | null
  minRiskAdjustedIrr?: number | null
  minFaceValue?: number | null
  maxFaceValue?: number | null
}

type Props = {
  opportunities: Opportunity[]
  meta: Pagination
  filters: Filters
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'bg-emerald-500',
  'A': 'bg-emerald-400',
  'B+': 'bg-violet-500',
  'B': 'bg-violet-400',
  'C': 'bg-amber-500',
  'D': 'bg-red-500',
}

const STAGE_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  qualified: 'Qualificada',
  contact: 'Contato',
  offer: 'Oferta',
  due_diligence: 'DD',
  cession: 'Cessão',
  paid: 'Paga',
  lost: 'Perdida',
}

const GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C', 'D'].map((grade) => ({
  value: grade,
  label: `${grade} apenas`,
}))

const STAGE_OPTIONS = Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))

const IRR_OPTIONS = [
  { value: '0.15', label: '≥ 15% a.a.' },
  { value: '0.20', label: '≥ 20% a.a.' },
  { value: '0.25', label: '≥ 25% a.a.' },
  { value: '0.30', label: '≥ 30% a.a.' },
  { value: '0.40', label: '≥ 40% a.a.' },
]

const NATURE_LABELS: Record<string, string> = {
  alimentar: 'Alimentar',
  comum: 'Comum',
  tributario: 'Tributário',
  unknown: 'Desconhecida',
}

const SIGNAL_ICON: Record<string, string> = {
  payment_available: '⚡',
  direct_agreement_opened: '🤝',
  superpreference_granted: '⭐',
  final_judgment: '🟢',
  calculation_homologated: '🟢',
  requisition_issued: '🟢',
  prior_cession_detected: '🛑',
  lien_detected: '🔴',
  suspension_detected: '🔴',
  objection_pending: '🟡',
  beneficiary_inventory_pending: '🟡',
}

const fmtPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`

export default function OpportunitiesIndex({ opportunities, meta, filters }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function applyFilter(patch: Partial<Filters>) {
    const next: Record<string, any> = { ...filters, ...patch, page: patch.page ?? 1 }
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === undefined || next[k] === '') delete next[k]
    })
    router.get('/operations/opportunities', next, {
      preserveState: true,
      preserveScroll: true,
    })
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleSelectAll() {
    if (selected.size === opportunities.length) setSelected(new Set())
    else setSelected(new Set(opportunities.map((o) => o.asset.id)))
  }

  async function bulkMoveToPipeline() {
    if (selected.size === 0) return
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
    try {
      const r = await fetch('/operations/opportunities/bulk-pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ assetIds: Array.from(selected), stage: 'qualified' }),
      })
      if (r.ok) {
        setSelected(new Set())
        router.reload({ only: ['opportunities', 'meta'] })
      }
    } catch {
      // Keep the selection so the operator can retry the bulk action.
    }
  }

  const totalSelectedValue = opportunities
    .filter((o) => selected.has(o.asset.id))
    .reduce((s, o) => s + o.pricing.faceValue, 0)

  return (
    <>
      <Head title="Oportunidades · Inbox A+" />

      <PageHeader
        title="Inbox A+"
        description={`${fmtNum(meta.total)} oportunidades · Ranqueadas por TIR ajustada e score`}
        breadcrumbs={[{ label: 'Mesa', href: '/operations/desk' }, { label: 'Inbox' }]}
      >
        {selected.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground tabular-nums me-2">
              {selected.size} sel · {fmtBRL(totalSelectedValue)}
            </span>
            <Button size="sm" onClick={bulkMoveToPipeline}>
              <Target className="me-1 size-3.5" />
              Adicionar ao Pipeline
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm">
            <Filter className="me-1 size-3.5" />
            Filtros avançados
          </Button>
        )}
      </PageHeader>

      <FilterPanel>
        <div className="grid gap-3 md:grid-cols-3 lg:max-w-2xl">
          <SelectFilter
            label="Score"
            value={filters.grade}
            allLabel="Todos os scores"
            options={GRADE_OPTIONS}
            onChange={(value) => applyFilter({ grade: value })}
          />
          <SelectFilter
            label="Estágio"
            value={filters.stage}
            allLabel="Todos os estágios"
            options={STAGE_OPTIONS}
            onChange={(value) => applyFilter({ stage: value })}
          />
          <SelectFilter
            label="TIR mínima"
            value={filters.minRiskAdjustedIrr ? String(filters.minRiskAdjustedIrr) : null}
            allLabel="Qualquer TIR"
            options={IRR_OPTIONS}
            onChange={(value) =>
              applyFilter({ minRiskAdjustedIrr: value === null ? null : Number(value) })
            }
          />
        </div>
      </FilterPanel>

      <Card>
        <CardContent className="p-0">
          {opportunities.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-12" />}
              message="Nenhuma oportunidade no filtro atual"
              description="Ajuste os filtros ou aguarde novos imports SIOP/DataJud."
            />
          ) : (
            <>
              <Table className="min-w-[1040px]">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[36px]">
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === opportunities.length}
                        onChange={toggleSelectAll}
                        className="size-3.5"
                      />
                    </TableHead>
                    <TableHead className="w-[60px]">Score</TableHead>
                    <TableHead>Devedor</TableHead>
                    <TableHead className="text-end">TIR aj.</TableHead>
                    <TableHead className="text-end">Face</TableHead>
                    <TableHead className="text-end">Oferta</TableHead>
                    <TableHead className="text-end">Prazo</TableHead>
                    <TableHead>Eventos</TableHead>
                    <TableHead>Estágio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((op) => (
                    <OpportunityRow
                      key={op.id}
                      op={op}
                      selected={selected.has(op.asset.id)}
                      onToggle={() => toggleSelect(op.asset.id)}
                    />
                  ))}
                </TableBody>
              </Table>

              {meta.lastPage > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                  <div className="tabular-nums">
                    Página {meta.currentPage} de {meta.lastPage} · {fmtNum(meta.total)}{' '}
                    oportunidades
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.currentPage <= 1}
                      onClick={() => applyFilter({ page: meta.currentPage - 1 })}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.currentPage >= meta.lastPage}
                      onClick={() => applyFilter({ page: meta.currentPage + 1 })}
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

function OpportunityRow({
  op,
  selected,
  onToggle,
}: {
  op: Opportunity
  selected: boolean
  onToggle: () => void
}) {
  const goToDetail = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input,button')) return
    router.visit(`/operations/opportunities/${op.asset.id}`)
  }

  const positiveCount = op.signals?.positive?.length ?? 0
  const negativeCount = op.signals?.negative?.length ?? 0
  const multiplier = op.debtor.historicalMultiplier
  const isHighIRR = op.pricing.riskAdjustedIrr >= 0.3

  return (
    <TableRow className="cursor-pointer align-top hover:bg-orange-50/60" onClick={goToDetail}>
      <TableCell>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="size-3.5"
        />
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center justify-center min-w-[36px] h-7 rounded text-xs font-bold text-white ${
            GRADE_COLOR[op.pricing.grade] ?? 'bg-muted-foreground'
          }`}
        >
          {op.pricing.grade}
        </span>
      </TableCell>
      <TableCell className="max-w-xs">
        <div className="font-medium truncate">{op.asset.debtorName ?? '—'}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums mt-0.5">
          <span className="font-mono">
            {op.asset.cnjNumber ?? op.asset.assetNumber ?? op.asset.id.slice(0, 8)}
          </span>
          {op.asset.exerciseYear && <span>· {op.asset.exerciseYear}</span>}
          <LabelChip>{NATURE_LABELS[op.asset.nature] ?? op.asset.nature}</LabelChip>
        </div>
        {multiplier > 0 && (
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
            ⭐ {multiplier.toFixed(1)}x histórico
          </div>
        )}
      </TableCell>
      <TableCell className="text-end">
        <div
          className={`tabular-nums font-bold ${isHighIRR ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
        >
          {fmtPct(op.pricing.riskAdjustedIrr)}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          P {fmtPct(op.pricing.paymentProbability)}
        </div>
      </TableCell>
      <TableCell className="text-end tabular-nums font-medium">
        {fmtBRL(op.pricing.faceValue)}
      </TableCell>
      <TableCell className="text-end tabular-nums text-sm">
        {fmtBRL(op.pricing.offerValue)}
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {fmtPct(op.pricing.offerRate)} face
        </div>
      </TableCell>
      <TableCell className="text-end tabular-nums text-sm">{op.pricing.termMonths}m</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {op.signals?.positive?.slice(0, 4).map((s, i) => (
            <Tooltip key={`p-${i}`}>
              <TooltipTrigger asChild>
                <span className="cursor-default">{SIGNAL_ICON[s.code] ?? '🟢'}</span>
              </TooltipTrigger>
              <TooltipContent>{s.label}</TooltipContent>
            </Tooltip>
          ))}
          {op.signals?.negative?.slice(0, 3).map((s, i) => (
            <Tooltip key={`n-${i}`}>
              <TooltipTrigger asChild>
                <span className="cursor-default">{SIGNAL_ICON[s.code] ?? '🔴'}</span>
              </TooltipTrigger>
              <TooltipContent>{s.label}</TooltipContent>
            </Tooltip>
          ))}
          {positiveCount + negativeCount === 0 && (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <LabelChip variant="info">{STAGE_LABELS[op.pipeline.stage] ?? op.pipeline.stage}</LabelChip>
      </TableCell>
    </TableRow>
  )
}
