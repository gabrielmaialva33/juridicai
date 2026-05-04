import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Database,
  FileSearch,
  Gauge,
  ListChecks,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
import { fmtBRL, fmtNum, fmtRelative } from '~/lib/helpers'

type Summary = {
  count: number
  faceValueTotal: number
  averageRiskAdjustedIrr: number
  averagePaymentProbability: number
}

type ScoreBucket = {
  grade: string
  count: number
  faceValueTotal: number
  averageRiskAdjustedIrr: number
}

type CriticalEvent = {
  assetId: string
  debtorName: string | null
  grade: string
  riskAdjustedIrr: number
  code: string
  label: string
  polarity: 'positive' | 'negative'
  eventDate?: string | null
}

type MarketSnapshot = {
  benchmark: string
  targetSpreadLabel: string
  rates?: {
    cdi?: number | null
    selic?: number | null
    ipca?: number | null
    annualCorrectionRate?: number | null
  } | null
}

type DataOpsSummary = {
  totalAssets: number
  completeAssets: number
  completeRate: number
  primarySourceCoverage: number
  dataJudProcessCoverage: number
  djenPublicationCoverage: number
  valuationCoverage: number
  scoreCoverage: number
  fieldEvidenceCoverage: number
  fieldEvidenceResolvedCoverage: number
  conflictedAssets: number
  fieldEvidenceConflictAssets: number
  pendingCandidateReviewAssets: number
  courtsCount: number
  courtsWithAssetsCount: number
  readyCourtsCount: number
  criticalCourtsCount: number
}

type DataOpsCoverage = {
  key: string
  label: string
  value: number
  affected: number
}

type DataOpsQueue = {
  code: string
  label: string
  severity: 'high' | 'medium' | 'low'
  affected: number
  courts: string[]
  recommendedAction: string
}

type CriticalCourt = {
  courtAlias: string
  stateCode: string | null
  status: 'complete' | 'usable' | 'partial' | 'critical'
  totalAssets: number
  completeAssets: number
  completeRate: number
  recommendedActions: string[]
}

type DataOpsDesk = {
  generatedAt: string
  summary: DataOpsSummary
  coverage: DataOpsCoverage[]
  queues: DataOpsQueue[]
  criticalCourts: CriticalCourt[]
}

type Props = {
  inbox: Summary
  pipeline: Summary
  portfolio: Summary
  scoreDistribution: ScoreBucket[]
  criticalEvents: CriticalEvent[]
  market: MarketSnapshot
  dataOps: DataOpsDesk
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'bg-emerald-500',
  'A': 'bg-emerald-400',
  'B+': 'bg-violet-500',
  'B': 'bg-violet-400',
  'C': 'bg-amber-500',
  'D': 'bg-red-500',
}

const fmtPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`

export default function OperationsDesk({
  inbox,
  pipeline,
  portfolio,
  scoreDistribution,
  criticalEvents,
  market,
  dataOps,
}: Props) {
  const cdiRate = market.rates?.cdi ?? 0.12
  const portfolioVsCdi = cdiRate > 0 ? (portfolio.averageRiskAdjustedIrr / cdiRate) * 100 : 0
  const inboxVsCdi = cdiRate > 0 ? (inbox.averageRiskAdjustedIrr / cdiRate) * 100 : 0
  const maxScoreCount = Math.max(...scoreDistribution.map((bucket) => bucket.count), 1)
  const summary = dataOps.summary
  const blockingIssues =
    summary.conflictedAssets +
    summary.fieldEvidenceConflictAssets +
    summary.pendingCandidateReviewAssets

  return (
    <>
      <Head title="Painel operacional de dados" />

      <PageHeader
        title="Painel operacional de dados"
        description={`Fila operacional de qualidade, reconciliação e cobertura · atualizado ${fmtRelative(dataOps.generatedAt)}`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/siop/imports">
            <Database className="me-1 size-3.5" />
            Fontes
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/precatorios">
            <FileSearch className="me-1 size-3.5" />
            Base monitorada
          </Link>
        </Button>
      </PageHeader>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OperatorMetric
          icon={<Database className="size-5" />}
          label="Ativos canônicos"
          value={fmtNum(summary.totalAssets)}
          hint={`${fmtNum(summary.completeAssets)} completos`}
          tone="primary"
        />
        <OperatorMetric
          icon={<Gauge className="size-5" />}
          label="Completude nacional"
          value={fmtPct(summary.completeRate)}
          hint={`${fmtNum(summary.readyCourtsCount)} tribunais prontos de ${fmtNum(summary.courtsWithAssetsCount)}`}
          tone={summary.completeRate >= 0.9 ? 'success' : 'warning'}
        />
        <OperatorMetric
          icon={<ShieldAlert className="size-5" />}
          label="Bloqueios de confiança"
          value={fmtNum(blockingIssues)}
          hint={`${fmtNum(summary.conflictedAssets)} conflitos de fonte`}
          tone={blockingIssues > 0 ? 'danger' : 'success'}
        />
        <OperatorMetric
          icon={<ListChecks className="size-5" />}
          label="Candidatos pendentes"
          value={fmtNum(summary.pendingCandidateReviewAssets)}
          hint="Revisão DataJud ambígua"
          tone={summary.pendingCandidateReviewAssets > 0 ? 'warning' : 'success'}
        />
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card>
          <CardHeader className="items-stretch py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle className="size-4 text-primary" />
                  Filas que precisam de ação
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Problemas agregados por tipo, com impacto direto na confiabilidade da base.
                </p>
              </div>
              <Badge variant="outline" appearance="ghost" size="sm">
                {dataOps.queues.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dataOps.queues.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma fila operacional aberta no relatório atual.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {dataOps.queues.map((queue) => (
                  <li key={queue.code} className="px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityChip severity={queue.severity} />
                          <h3 className="text-sm font-semibold">{queue.label}</h3>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {fmtNum(queue.affected)} afetados
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {queue.recommendedAction}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {fmtNum(queue.courts.length)} tribunais ·{' '}
                          <span className="font-mono">
                            {queue.courts.slice(0, 6).join(', ').toUpperCase()}
                          </span>
                          {queue.courts.length > 6 ? '...' : ''}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/precatorios">
                          Abrir base
                          <ArrowRight className="ms-1 size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="size-4 text-primary" />
              Cobertura essencial
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {dataOps.coverage.map((item) => (
              <CoverageRow key={item.key} item={item} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader className="py-4">
            <h2 className="text-base font-semibold">Tribunais mais frágeis</h2>
          </CardHeader>
          <CardContent className="p-0">
            {dataOps.criticalCourts.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Todos os tribunais com ativos estão completos.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {dataOps.criticalCourts.map((court) => (
                  <li key={court.courtAlias} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold uppercase">
                            {court.courtAlias}
                          </span>
                          {court.stateCode && <LabelChip>{court.stateCode}</LabelChip>}
                          <CourtStatus status={court.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {fmtNum(court.completeAssets)} de {fmtNum(court.totalAssets)} completos
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="text-sm font-bold tabular-nums">
                          {fmtPct(court.completeRate)}
                        </div>
                        <div className="text-xs text-muted-foreground">completude</div>
                      </div>
                    </div>
                    {court.recommendedActions[0] && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {court.recommendedActions[0]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Sinais comerciais preservados</h2>
              <Button variant="outline" size="sm" asChild>
                <Link href="/operations/opportunities">
                  Triagem
                  <ArrowRight className="ms-1 size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <CommercialMetric
                icon={<Target className="size-4" />}
                label="Novos A+"
                value={fmtBRL(inbox.faceValueTotal)}
                hint={`${fmtNum(inbox.count)} créditos · ${inboxVsCdi.toFixed(0)}% CDI`}
              />
              <CommercialMetric
                icon={<Briefcase className="size-4" />}
                label="Acompanhamento"
                value={fmtBRL(pipeline.faceValueTotal)}
                hint={`${fmtNum(pipeline.count)} casos · P ${fmtPct(pipeline.averagePaymentProbability)}`}
              />
              <CommercialMetric
                icon={<TrendingUp className="size-4" />}
                label="Concluídos"
                value={fmtBRL(portfolio.faceValueTotal)}
                hint={`${portfolioVsCdi.toFixed(0)}% CDI realizado`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-base font-semibold">Classificação dos créditos</h2>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5">
            {scoreDistribution.map((bucket) => {
              const pct = (bucket.count / maxScoreCount) * 100

              return (
                <Link
                  key={bucket.grade}
                  href={`/operations/opportunities?grade=${encodeURIComponent(bucket.grade)}`}
                  className="block rounded px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/40"
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded text-xs font-bold text-white ${
                          GRADE_COLOR[bucket.grade] ?? 'bg-muted-foreground'
                        }`}
                      >
                        {bucket.grade}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtNum(bucket.count)} créditos
                      </span>
                    </div>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      Retorno {fmtPct(bucket.averageRiskAdjustedIrr)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${GRADE_COLOR[bucket.grade] ?? 'bg-muted-foreground'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {fmtBRL(bucket.faceValueTotal)} valor face
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Movimentações relevantes</h2>
              <Badge variant="outline" appearance="ghost" size="sm">
                {criticalEvents.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {criticalEvents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma movimentação relevante nas últimas 24 horas.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {criticalEvents.map((event, index) => (
                  <li key={`${event.assetId}-${event.code}-${index}`}>
                    <Link
                      href={`/operations/opportunities/${event.assetId}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          event.polarity === 'positive' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium">{event.label}</span>
                          <span
                            className={`inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${
                              GRADE_COLOR[event.grade] ?? 'bg-muted-foreground'
                            }`}
                          >
                            {event.grade}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{event.debtorName ?? '—'}</span>
                          <span>·</span>
                          <span className="shrink-0 tabular-nums">
                            Retorno est. {fmtPct(event.riskAdjustedIrr)}
                          </span>
                          {event.eventDate && (
                            <>
                              <span>·</span>
                              <span className="shrink-0">{fmtRelative(event.eventDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function OperatorMetric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    primary: 'before:bg-primary bg-primary/5 text-primary',
    success: 'before:bg-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    warning: 'before:bg-amber-500 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    danger: 'before:bg-red-500 bg-red-500/5 text-red-600 dark:text-red-400',
  }[tone]

  return (
    <Card
      className={`relative overflow-hidden before:absolute before:inset-y-0 before:start-0 before:w-0.5 ${toneClass}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold leading-tight tabular-nums text-foreground">
              {value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CoverageRow({ item }: { item: DataOpsCoverage }) {
  const tone =
    item.value >= 0.95 ? 'bg-emerald-500' : item.value >= 0.75 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{item.label}</span>
        <span className="tabular-nums text-muted-foreground">{fmtPct(item.value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${item.value * 100}%` }} />
      </div>
      {item.affected > 0 && (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          {fmtNum(item.affected)} registros ainda precisam de cobertura.
        </div>
      )}
    </div>
  )
}

function SeverityChip({ severity }: { severity: DataOpsQueue['severity'] }) {
  const variant = severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'info'
  const label = severity === 'high' ? 'Alta' : severity === 'medium' ? 'Média' : 'Baixa'

  return <LabelChip variant={variant}>{label}</LabelChip>
}

function CourtStatus({ status }: { status: CriticalCourt['status'] }) {
  const variant =
    status === 'critical'
      ? 'danger'
      : status === 'partial'
        ? 'warning'
        : status === 'usable'
          ? 'info'
          : 'success'
  const label =
    status === 'critical'
      ? 'Crítico'
      : status === 'partial'
        ? 'Parcial'
        : status === 'usable'
          ? 'Usável'
          : 'Completo'

  return <LabelChip variant={variant}>{label}</LabelChip>
}

function CommercialMetric({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-lg font-bold leading-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}
