import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import {
  AlertTriangle,
  Database,
  FileCheck2,
  Filter,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'
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
import { FilterPanel, SelectFilter } from '~/components/shared/filter-controls'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
import { StatusBadge } from '~/components/status-badge'
import { fmtBRL, fmtNum } from '~/lib/helpers'
import { jsonRequest } from '~/lib/http'

type DataQuality = {
  status: 'complete' | 'review' | 'blocked'
  issues: string[]
  hasValuation: boolean
  hasDataJudProcess: boolean
  hasDjenPublication: boolean
  resolvedCoreFields: number
  fieldEvidenceConflicts: number
  sourceConflicts: number
  pendingCandidateReviews: number
}

type Asset = {
  id: string
  cnjNumber?: string | null
  assetNumber?: string | null
  debtorName?: string | null
  debtorType?: string | null
  source: string
  nature: string
  lifecycleStatus: string
  complianceStatus: string
  piiStatus: string
  faceValue: number
  estimatedUpdatedValue?: number | null
  exerciseYear?: number | null
  currentScore?: number | null
  dataQuality: DataQuality
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
  offerValue?: number
  acquisitionCost?: number
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
  source?: string | null
  dataIssue?: string | null
  minRiskAdjustedIrr?: number | null
  minFaceValue?: number | null
  maxFaceValue?: number | null
}

type QualitySummary = {
  total: number
  missingValue: number
  missingDataJud: number
  missingDjen: number
  missingFieldEvidence: number
  conflicts: number
  candidateReview: number
  blocked: number
  complete: number
}

type Props = {
  opportunities: Opportunity[]
  meta: Pagination
  filters: Filters
  qualitySummary: QualitySummary
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
  inbox: 'Triagem',
  qualified: 'Pronto para contato',
  contact: 'Contato',
  offer: 'Proposta',
  due_diligence: 'Diligência',
  cession: 'Formalização',
  paid: 'Concluído',
  lost: 'Encerrado',
}

const GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C', 'D'].map((grade) => ({
  value: grade,
  label: `Classe ${grade}`,
}))

const STAGE_OPTIONS = Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))

const IRR_OPTIONS = [
  { value: '0.15', label: '≥ 15% a.a.' },
  { value: '0.20', label: '≥ 20% a.a.' },
  { value: '0.25', label: '≥ 25% a.a.' },
  { value: '0.30', label: '≥ 30% a.a.' },
  { value: '0.40', label: '≥ 40% a.a.' },
]

const SOURCE_OPTIONS = [
  { value: 'siop', label: 'SIOP' },
  { value: 'datajud', label: 'DataJud' },
  { value: 'djen', label: 'DJEN' },
  { value: 'tribunal', label: 'Tribunal' },
  { value: 'manual', label: 'Manual' },
  { value: 'api_private', label: 'API privada' },
]

const DATA_ISSUE_OPTIONS = [
  { value: 'missing_value', label: 'Sem valor confiável' },
  { value: 'missing_datajud', label: 'Sem processo DataJud' },
  { value: 'missing_djen', label: 'Sem publicação DJEN' },
  { value: 'missing_field_evidence', label: 'Evidência incompleta' },
  { value: 'conflicts', label: 'Com conflito' },
  { value: 'candidate_review', label: 'Candidato pendente' },
]

const NATURE_LABELS: Record<string, string> = {
  alimentar: 'Alimentar',
  comum: 'Comum',
  tributario: 'Tributário',
  unknown: 'Desconhecida',
}

const SOURCE_LABELS: Record<string, string> = {
  siop: 'SIOP',
  datajud: 'DataJud',
  djen: 'DJEN',
  tribunal: 'Tribunal',
  manual: 'Manual',
  api_private: 'API privada',
}

const fmtPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`

export default function OpportunitiesIndex({
  opportunities,
  meta,
  filters,
  qualitySummary,
}: Props) {
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
    try {
      await jsonRequest('/operations/opportunities/bulk-pipeline', {
        method: 'POST',
        body: { assetIds: Array.from(selected), stage: 'qualified' },
      })
      setSelected(new Set())
      router.reload({ only: ['opportunities', 'meta', 'qualitySummary'] })
    } catch {
      // Keep the selection so the operator can retry the bulk action.
    }
  }

  const totalSelectedValue = opportunities
    .filter((o) => selected.has(o.asset.id))
    .reduce((s, o) => s + o.pricing.faceValue, 0)

  return (
    <>
      <Head title="Triagem operacional de créditos" />

      <PageHeader
        title="Triagem operacional de créditos"
        description={`${fmtNum(meta.total)} registros para tratar · Qualidade de dados, cobertura e oportunidade em uma única fila`}
        breadcrumbs={[{ label: 'Painel', href: '/operations/desk' }, { label: 'Triagem' }]}
      >
        {selected.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground tabular-nums me-2">
              {selected.size} selecionados · {fmtBRL(totalSelectedValue)}
            </span>
            <Button size="sm" onClick={bulkMoveToPipeline}>
              <Target className="me-1 size-3.5" />
              Enviar para acompanhamento
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm">
            <Filter className="me-1 size-3.5" />
            Filtros
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QualityMetric
          icon={<Database className="size-4" />}
          label="Registros filtrados"
          value={fmtNum(qualitySummary.total)}
          hint={`${fmtNum(qualitySummary.complete)} completos`}
          tone="primary"
        />
        <QualityMetric
          icon={<AlertTriangle className="size-4" />}
          label="Sem valor confiável"
          value={fmtNum(qualitySummary.missingValue)}
          hint="Valor ausente ou zerado"
          tone={qualitySummary.missingValue > 0 ? 'warning' : 'success'}
        />
        <QualityMetric
          icon={<FileCheck2 className="size-4" />}
          label="Pendências de cobertura"
          value={fmtNum(qualitySummary.missingDataJud + qualitySummary.missingDjen)}
          hint={`${fmtNum(qualitySummary.missingDataJud)} sem processo · ${fmtNum(qualitySummary.missingDjen)} sem publicação`}
          tone="warning"
        />
        <QualityMetric
          icon={<ShieldAlert className="size-4" />}
          label="Bloqueios"
          value={fmtNum(qualitySummary.blocked)}
          hint={`${fmtNum(qualitySummary.conflicts)} conflitos · ${fmtNum(qualitySummary.candidateReview)} candidatos`}
          tone={qualitySummary.blocked > 0 ? 'danger' : 'success'}
        />
      </div>

      <FilterPanel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SelectFilter
            label="Pendência"
            value={filters.dataIssue}
            allLabel="Todas as pendências"
            options={DATA_ISSUE_OPTIONS}
            onChange={(value) => applyFilter({ dataIssue: value })}
          />
          <SelectFilter
            label="Fonte"
            value={filters.source}
            allLabel="Todas as fontes"
            options={SOURCE_OPTIONS}
            onChange={(value) => applyFilter({ source: value })}
          />
          <SelectFilter
            label="Classificação"
            value={filters.grade}
            allLabel="Todas as classificações"
            options={GRADE_OPTIONS}
            onChange={(value) => applyFilter({ grade: value })}
          />
          <SelectFilter
            label="Situação"
            value={filters.stage}
            allLabel="Todas as situações"
            options={STAGE_OPTIONS}
            onChange={(value) => applyFilter({ stage: value })}
          />
          <SelectFilter
            label="Retorno mínimo"
            value={filters.minRiskAdjustedIrr ? String(filters.minRiskAdjustedIrr) : null}
            allLabel="Qualquer retorno"
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
              message="Nenhum crédito no filtro atual"
              description="Ajuste os filtros ou aguarde novas importações SIOP/DataJud."
            />
          ) : (
            <>
              <Table className="min-w-[1100px] table-fixed">
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
                    <TableHead className="w-[96px]">Qualidade</TableHead>
                    <TableHead className="w-[230px]">Crédito</TableHead>
                    <TableHead className="w-[260px]">Devedor</TableHead>
                    <TableHead className="w-[160px]">Cobertura</TableHead>
                    <TableHead className="w-[120px] text-end">Valor</TableHead>
                    <TableHead className="w-[105px] text-end">Retorno</TableHead>
                    <TableHead className="w-[95px]">Situação</TableHead>
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
                    Página {meta.currentPage} de {meta.lastPage} · {fmtNum(meta.total)} créditos
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
  const acquisitionCost = op.pricing.acquisitionCost ?? op.pricing.offerValue ?? null
  const quality = op.asset.dataQuality
  const displayFaceValue =
    quality.hasValuation && op.pricing.faceValue > 0
      ? fmtBRL(op.pricing.faceValue)
      : 'Não informado'
  const offerLabel =
    acquisitionCost !== null && acquisitionCost > 0 ? fmtBRL(acquisitionCost) : 'Oferta pendente'

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
        <div className="space-y-1.5">
          <QualityBadge quality={quality} />
          {quality.issues.length > 0 && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {quality.issues.length} pendência{quality.issues.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex h-6 min-w-8 items-center justify-center rounded text-xs font-bold text-white ${
              GRADE_COLOR[op.pricing.grade] ?? 'bg-muted-foreground'
            }`}
          >
            {op.pricing.grade}
          </span>
          <LabelChip variant="info">{SOURCE_LABELS[op.asset.source] ?? op.asset.source}</LabelChip>
          <LabelChip>{NATURE_LABELS[op.asset.nature] ?? op.asset.nature}</LabelChip>
        </div>
        <div className="mt-1 font-mono text-xs tabular-nums text-foreground">
          {op.asset.cnjNumber ?? op.asset.assetNumber ?? op.asset.id.slice(0, 8)}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <StatusBadge kind="compliance" value={op.asset.complianceStatus} />
          <StatusBadge kind="pii" value={op.asset.piiStatus} />
        </div>
      </TableCell>
      <TableCell>
        <div className="truncate font-medium">
          {op.asset.debtorName ?? 'Devedor não identificado'}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
          {op.asset.exerciseYear && <span>Exec. {op.asset.exerciseYear}</span>}
          {op.asset.currentScore !== null && op.asset.currentScore !== undefined && (
            <span>Pontuação {op.asset.currentScore.toFixed(1)}</span>
          )}
        </div>
        {multiplier > 0 && (
          <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
            Histórico {multiplier.toFixed(1)}x
          </div>
        )}
      </TableCell>
      <TableCell>
        <DataCoverage
          quality={quality}
          positiveCount={positiveCount}
          negativeCount={negativeCount}
        />
      </TableCell>
      <TableCell className="text-end tabular-nums">
        <div className="font-semibold">{displayFaceValue}</div>
        {op.asset.estimatedUpdatedValue !== null &&
          op.asset.estimatedUpdatedValue !== undefined && (
            <div className="text-[10px] text-muted-foreground">
              Atual. {fmtBRL(op.asset.estimatedUpdatedValue)}
            </div>
          )}
        <div className="mt-1 text-[10px] text-muted-foreground">{offerLabel}</div>
      </TableCell>
      <TableCell className="text-end">
        <div
          className={`tabular-nums font-bold ${isHighIRR ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
        >
          {fmtPct(op.pricing.riskAdjustedIrr)}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          Prob. {fmtPct(op.pricing.paymentProbability)} · {op.pricing.termMonths}m
        </div>
      </TableCell>
      <TableCell>
        <LabelChip variant="info">{STAGE_LABELS[op.pipeline.stage] ?? op.pipeline.stage}</LabelChip>
      </TableCell>
    </TableRow>
  )
}

function QualityMetric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    primary: 'before:bg-primary',
    success: 'before:bg-emerald-500',
    warning: 'before:bg-amber-500',
    danger: 'before:bg-red-500',
  }[tone]

  return (
    <Card
      className={`relative overflow-hidden before:absolute before:inset-y-0 before:start-0 before:w-0.5 ${toneClass}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-primary">{icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QualityBadge({ quality }: { quality: DataQuality }) {
  if (quality.status === 'complete') {
    return <LabelChip variant="success">Completo</LabelChip>
  }

  if (quality.status === 'blocked') {
    return <LabelChip variant="danger">Bloqueado</LabelChip>
  }

  return <LabelChip variant="warning">Revisar</LabelChip>
}

function DataCoverage({
  quality,
  positiveCount,
  negativeCount,
}: {
  quality: DataQuality
  positiveCount: number
  negativeCount: number
}) {
  return (
    <div className="flex max-w-[170px] flex-wrap gap-1">
      <CoverageChip ok={quality.hasValuation} label="Valor" />
      <CoverageChip ok={quality.hasDataJudProcess} label="DataJud" />
      <CoverageChip ok={quality.hasDjenPublication} label="DJEN" />
      <CoverageChip
        ok={quality.resolvedCoreFields >= 4}
        label={`Evid. ${quality.resolvedCoreFields}/4`}
      />
      {(quality.sourceConflicts > 0 || quality.fieldEvidenceConflicts > 0) && (
        <LabelChip variant="danger">Conflito</LabelChip>
      )}
      {quality.pendingCandidateReviews > 0 && (
        <LabelChip variant="warning">{`${quality.pendingCandidateReviews} candidato`}</LabelChip>
      )}
      {positiveCount + negativeCount > 0 && (
        <LabelChip variant={negativeCount > 0 ? 'warning' : 'success'}>
          {`${positiveCount}+/${negativeCount}-`}
        </LabelChip>
      )}
    </div>
  )
}

function CoverageChip({ ok, label }: { ok: boolean; label: string }) {
  return <LabelChip variant={ok ? 'success' : 'warning'}>{ok ? label : `Sem ${label}`}</LabelChip>
}
