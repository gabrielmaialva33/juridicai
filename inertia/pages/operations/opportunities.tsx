import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import { Filter, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '~/components/shared/page-header'
import { EmptyState } from '~/components/shared/empty-state'
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
      // silent fail — manter seleção pro user tentar novamente
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

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Select
            value={filters.grade ?? '__all'}
            onValueChange={(v) => applyFilter({ grade: v === '__all' ? null : v })}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os scores</SelectItem>
              <SelectItem value="A+">A+ apenas</SelectItem>
              <SelectItem value="A">A apenas</SelectItem>
              <SelectItem value="B+">B+ apenas</SelectItem>
              <SelectItem value="B">B apenas</SelectItem>
              <SelectItem value="C">C apenas</SelectItem>
              <SelectItem value="D">D apenas</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.stage ?? '__all'}
            onValueChange={(v) => applyFilter({ stage: v === '__all' ? null : v })}
          >
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos estágios</SelectItem>
              {Object.entries(STAGE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(filters.minRiskAdjustedIrr ?? '__any')}
            onValueChange={(v) =>
              applyFilter({ minRiskAdjustedIrr: v === '__any' ? null : Number(v) })
            }
          >
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="TIR mínima" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">TIR qualquer</SelectItem>
              <SelectItem value="0.15">≥ 15% a.a.</SelectItem>
              <SelectItem value="0.20">≥ 20% a.a.</SelectItem>
              <SelectItem value="0.25">≥ 25% a.a.</SelectItem>
              <SelectItem value="0.30">≥ 30% a.a.</SelectItem>
              <SelectItem value="0.40">≥ 40% a.a.</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
              <Table>
                <TableHeader>
                  <TableRow>
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
    <TableRow className="cursor-pointer hover:bg-muted/40 align-top" onClick={goToDetail}>
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
          <span className="px-1 py-0.5 rounded bg-muted text-foreground">{op.asset.nature}</span>
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
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
          {STAGE_LABELS[op.pipeline.stage] ?? op.pipeline.stage}
        </span>
      </TableCell>
    </TableRow>
  )
}
