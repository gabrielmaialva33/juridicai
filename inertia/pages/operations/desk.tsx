import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  LineChart as LineChartIcon,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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

type Props = {
  inbox: Summary
  pipeline: Summary
  portfolio: Summary
  scoreDistribution: ScoreBucket[]
  criticalEvents: CriticalEvent[]
  market: MarketSnapshot
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
}: Props) {
  const cdiRate = market.rates?.cdi ?? 0.12
  const portfolioVsCdi = cdiRate > 0 ? (portfolio.averageRiskAdjustedIrr / cdiRate) * 100 : 0
  const inboxVsCdi = cdiRate > 0 ? (inbox.averageRiskAdjustedIrr / cdiRate) * 100 : 0
  const maxScoreCount = Math.max(...scoreDistribution.map((b) => b.count), 1)

  return (
    <>
      <Head title="Mesa de Operações" />

      <PageHeader
        title="Mesa de Operações"
        description={`Benchmark ${market.benchmark} ${cdiRate ? `(${fmtPct(cdiRate, 2)} a.a.)` : ''} · Spread alvo ${market.targetSpreadLabel}`}
      >
        <Button asChild size="sm">
          <Link href="/operations/opportunities">
            <Target className="me-1 size-3.5" />
            Inbox A+
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/operations/pipeline">
            <Briefcase className="me-1 size-3.5" />
            Pipeline
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <BigKpiCard
          icon={<Target className="size-5" />}
          label="Inbox A+ (24h)"
          accent="primary"
          primary={fmtBRL(inbox.faceValueTotal)}
          subtitle={`${fmtNum(inbox.count)} oportunidades · TIR aj. média ${fmtPct(inbox.averageRiskAdjustedIrr)}`}
          hint={`${inboxVsCdi.toFixed(0)}% do CDI`}
          href="/operations/opportunities?grade=A%2B&stage=inbox"
        />
        <BigKpiCard
          icon={<Briefcase className="size-5" />}
          label="Pipeline ativo"
          accent="info"
          primary={fmtBRL(pipeline.faceValueTotal)}
          subtitle={`${fmtNum(pipeline.count)} ops · TIR aj. ${fmtPct(pipeline.averageRiskAdjustedIrr)}`}
          hint={`Probabilidade média ${fmtPct(pipeline.averagePaymentProbability)}`}
          href="/operations/pipeline"
        />
        <BigKpiCard
          icon={<CheckCircle2 className="size-5" />}
          label="Carteira fechada"
          accent="success"
          primary={fmtBRL(portfolio.faceValueTotal)}
          subtitle={`${fmtNum(portfolio.count)} pagos · TIR realizada ${fmtPct(portfolio.averageRiskAdjustedIrr)}`}
          hint={`${portfolioVsCdi.toFixed(0)}% do CDI`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-base font-semibold">Distribuição por score</h2>
          </CardHeader>
          <CardContent className="p-5 space-y-2.5">
            {scoreDistribution.map((bucket) => {
              const pct = (bucket.count / maxScoreCount) * 100
              return (
                <Link
                  key={bucket.grade}
                  href={`/operations/opportunities?grade=${encodeURIComponent(bucket.grade)}`}
                  className="block hover:bg-muted/40 rounded px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center size-6 rounded text-xs font-bold text-white ${
                          GRADE_COLOR[bucket.grade] ?? 'bg-muted-foreground'
                        }`}
                      >
                        {bucket.grade}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtNum(bucket.count)} ops
                      </span>
                    </div>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      TIR {fmtPct(bucket.averageRiskAdjustedIrr)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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
              <h2 className="text-base font-semibold flex items-center gap-2">
                <LineChartIcon className="size-4" />
                Eventos críticos (últimas 24h)
              </h2>
              <Badge variant="outline" appearance="ghost" size="sm">
                {criticalEvents.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {criticalEvents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum evento crítico nas últimas 24 horas.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {criticalEvents.map((ev, idx) => (
                  <li key={`${ev.assetId}-${ev.code}-${idx}`}>
                    <Link
                      href={`/operations/opportunities/${ev.assetId}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <span
                        className={`size-2 rounded-full shrink-0 ${
                          ev.polarity === 'positive' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium truncate">{ev.label}</span>
                          <span
                            className={`inline-flex items-center justify-center size-5 rounded text-[10px] font-bold text-white shrink-0 ${
                              GRADE_COLOR[ev.grade] ?? 'bg-muted-foreground'
                            }`}
                          >
                            {ev.grade}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{ev.debtorName ?? '—'}</span>
                          <span>·</span>
                          <span className="tabular-nums shrink-0">
                            TIR aj. {fmtPct(ev.riskAdjustedIrr)}
                          </span>
                          {ev.eventDate && (
                            <>
                              <span>·</span>
                              <span className="shrink-0">{fmtRelative(ev.eventDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <TrendingUp className="size-5 text-emerald-600" />
          <div className="flex-1">
            <div className="text-sm font-medium">
              Spread atual da carteira:{' '}
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                +{((portfolio.averageRiskAdjustedIrr - cdiRate) * 100).toFixed(1)}pp vs CDI
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Carteira renderindo {portfolioVsCdi.toFixed(0)}% do CDI · Alvo de mercado{' '}
              {market.targetSpreadLabel}
            </div>
          </div>
          {market.rates?.selic && (
            <div className="text-xs text-muted-foreground tabular-nums shrink-0">
              Selic {fmtPct(market.rates.selic, 2)} · IPCA {fmtPct(market.rates.ipca ?? 0, 2)}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function BigKpiCard({
  icon,
  label,
  primary,
  subtitle,
  hint,
  accent,
  href,
}: {
  icon: React.ReactNode
  label: string
  primary: string
  subtitle: string
  hint?: string
  accent: 'primary' | 'info' | 'success'
  href?: string
}) {
  const accentClass =
    accent === 'primary'
      ? 'before:bg-primary'
      : accent === 'info'
        ? 'before:bg-violet-500'
        : 'before:bg-emerald-500'
  const iconBg =
    accent === 'primary'
      ? 'bg-primary/10 text-primary'
      : accent === 'info'
        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'

  const inner = (
    <Card
      className={`relative overflow-hidden h-full before:absolute before:inset-y-0 before:start-0 before:w-0.5 ${accentClass}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center size-9 rounded-md shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums leading-tight">{primary}</div>
            <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
            {hint && (
              <div className="mt-2 text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {hint}
              </div>
            )}
          </div>
          {href && <ArrowRight className="size-4 text-muted-foreground shrink-0" />}
        </div>
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block group">
      {inner}
    </Link>
  ) : (
    inner
  )
}
