import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '~/components/shared/page-header'
import { fmtBRL, fmtRelative } from '~/lib/helpers'

type PricingResult = {
  faceValue: number
  offerRate: number
  discountRate: number
  acquisitionCost: number
  termMonths: number
  annualCorrectionRate: number
  expectedPayment: number
  operationalCost: number
  taxRate: number
  estimatedTax: number
  netProceeds: number
  netProfit: number
  expectedAnnualIrr: number
  paymentProbability: number
  riskAdjustedIrr: number
  finalScore: number
  grade: string
  decision: 'aggressive_buy' | 'buy' | 'watch' | 'avoid'
  assumptions?: {
    correctionRule?: string
    marketRatesAsOf?: string | null
  }
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
  asset: {
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
    budgetYear?: number | null
  }
  debtor: {
    id?: string | null
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
  pipeline: {
    stage: string
    opportunityId?: string | null
    targetCloseAt?: string | null
  }
  pricing: PricingResult
  signals: { positive: Signal[]; negative: Signal[] }
}

type Props = {
  opportunity: Opportunity
  judicialProcesses: any[]
  publications: any[]
  events: any[]
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'bg-emerald-500',
  'A': 'bg-emerald-400',
  'B+': 'bg-violet-500',
  'B': 'bg-violet-400',
  'C': 'bg-amber-500',
  'D': 'bg-red-500',
}

const DECISION_LABEL: Record<string, { label: string; color: string }> = {
  aggressive_buy: {
    label: 'COMPRA AGRESSIVA',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  buy: {
    label: 'COMPRAR',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  },
  watch: {
    label: 'MONITORAR',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  avoid: {
    label: 'EVITAR',
    color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  },
}

const fmtPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`

export default function OpportunityShow({ opportunity: initial, events }: Props) {
  const [pricing, setPricing] = useState<PricingResult>(initial.pricing)
  const [opportunity, setOpportunity] = useState<Opportunity>(initial)
  const [offerRate, setOfferRate] = useState<number>(initial.pricing.offerRate)
  const [termMonths, setTermMonths] = useState<number>(initial.pricing.termMonths)
  const [recomputing, setRecomputing] = useState(false)

  // Recompute pricing on slider change.
  useEffect(() => {
    if (offerRate === initial.pricing.offerRate && termMonths === initial.pricing.termMonths) {
      return
    }
    const timer = setTimeout(async () => {
      setRecomputing(true)
      try {
        const csrf =
          document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
        const r = await fetch(`/operations/opportunities/${initial.asset.id}/pricing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
            'Accept': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({ offerRate, termMonths }),
        })
        if (r.ok) {
          const data = await r.json()
          setPricing(data.opportunity.pricing)
          setOpportunity(data.opportunity)
        }
      } catch {
        // Keep the current pricing visible if recomputation fails.
      } finally {
        setRecomputing(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [
    offerRate,
    termMonths,
    initial.asset.id,
    initial.pricing.offerRate,
    initial.pricing.termMonths,
  ])

  const cdiRate = 0.12
  const irrVsCdi = cdiRate > 0 ? (pricing.riskAdjustedIrr / cdiRate) * 100 : 0
  const multiplier = pricing.netProceeds > 0 ? pricing.netProceeds / pricing.acquisitionCost : 0
  const decision = DECISION_LABEL[pricing.decision] ?? DECISION_LABEL.watch

  const debtor = opportunity.debtor
  const recentEvents = useMemo(() => events.slice(0, 8), [events])

  return (
    <>
      <Head
        title={`${opportunity.asset.cnjNumber ?? opportunity.asset.id.slice(0, 8)} · Calculadora`}
      />

      <PageHeader
        title={
          opportunity.asset.cnjNumber ??
          opportunity.asset.assetNumber ??
          `#${opportunity.asset.id.slice(0, 8)}`
        }
        description={
          opportunity.asset.debtorName
            ? `${opportunity.asset.debtorName} · ${opportunity.asset.nature} · Exec. ${opportunity.asset.exerciseYear ?? '—'}`
            : 'Detalhe da oportunidade'
        }
        breadcrumbs={[
          { label: 'Mesa', href: '/operations/desk' },
          { label: 'Inbox', href: '/operations/opportunities' },
          { label: `#${opportunity.asset.id.slice(0, 8)}` },
        ]}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/operations/opportunities">
            <ArrowLeft className="me-1 size-3.5" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={`flex flex-col items-center justify-center size-16 rounded-xl text-white shrink-0 ${
                    GRADE_COLOR[pricing.grade] ?? 'bg-muted-foreground'
                  }`}
                >
                  <span className="text-2xl font-bold leading-none">{pricing.grade}</span>
                  <span className="text-[9px] font-medium opacity-80 mt-0.5">SCORE</span>
                </div>
                <div className="flex-1">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${decision.color}`}
                  >
                    {decision.label}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        TIR ajustada
                      </div>
                      <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmtPct(pricing.riskAdjustedIrr)}
                      </div>
                      <div className="text-[10px] tabular-nums text-muted-foreground">
                        {irrVsCdi.toFixed(0)}% do CDI
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Múltiplo
                      </div>
                      <div className="text-2xl font-bold tabular-nums">
                        {multiplier.toFixed(2)}x
                      </div>
                      <div className="text-[10px] tabular-nums text-muted-foreground">
                        TIR esperada {fmtPct(pricing.expectedAnnualIrr)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Probabilidade
                      </div>
                      <div className="text-2xl font-bold tabular-nums">
                        {fmtPct(pricing.paymentProbability)}
                      </div>
                      <div className="text-[10px] tabular-nums text-muted-foreground">
                        de pagamento
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Star className="size-4 text-emerald-500" />
                Perfil do devedor
              </h2>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat
                label="Multiplier histórico"
                value={`${debtor.historicalMultiplier.toFixed(1)}x`}
                hint={debtor.historicalMultiplier > 1 ? 'acima da média' : 'abaixo da média'}
                accent={debtor.historicalMultiplier > 1 ? 'success' : 'muted'}
              />
              <Stat
                label="Tempo médio pgto"
                value={
                  debtor.averagePaymentMonths ? `${debtor.averagePaymentMonths.toFixed(0)}m` : '—'
                }
              />
              <Stat
                label="Taxa pgto no prazo"
                value={fmtPct(debtor.onTimePaymentRate)}
                accent={(debtor.onTimePaymentRate ?? 0) > 0.85 ? 'success' : 'muted'}
              />
              <Stat
                label="RCL/dívida"
                value={fmtPct(debtor.rclDebtRatio, 2)}
                hint={debtor.regimeSpecialActive ? '⚠ regime especial' : undefined}
              />
            </CardContent>
          </Card>

          {(opportunity.signals.positive.length > 0 || opportunity.signals.negative.length > 0) && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Sinais detectados</h2>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {opportunity.signals.positive.map((s, i) => (
                  <SignalRow key={`p-${i}`} signal={s} />
                ))}
                {opportunity.signals.negative.map((s, i) => (
                  <SignalRow key={`n-${i}`} signal={s} />
                ))}
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="events">
            <TabsList>
              <TabsTrigger value="events">Eventos ({events.length})</TabsTrigger>
              <TabsTrigger value="comparison">Comparativo</TabsTrigger>
              <TabsTrigger value="assumptions">Premissas</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-3">
              <Card>
                <CardContent className="p-0">
                  {recentEvents.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Sem eventos registrados.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {recentEvents.map((ev: any) => (
                        <li key={ev.id} className="px-5 py-3 flex items-start gap-3">
                          <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-sm font-mono">{ev.eventType}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {fmtRelative(ev.eventDate ?? ev.createdAt)}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison" className="mt-3">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <ComparisonRow
                    label="Esta oportunidade"
                    value={fmtPct(pricing.riskAdjustedIrr)}
                    pct={(pricing.riskAdjustedIrr / 0.6) * 100}
                    accent="primary"
                  />
                  <ComparisonRow
                    label="FIDC top decil (Hurst/Precato)"
                    value="20% a.a."
                    pct={(0.2 / 0.6) * 100}
                    accent="info"
                  />
                  <ComparisonRow
                    label="CDI 2026"
                    value={fmtPct(cdiRate, 2)}
                    pct={(cdiRate / 0.6) * 100}
                    accent="muted"
                  />
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    Esta oferta entrega{' '}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{((pricing.riskAdjustedIrr - cdiRate) * 100).toFixed(1)}pp
                    </span>{' '}
                    sobre o CDI atual.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assumptions" className="mt-3">
              <Card>
                <CardContent className="p-5 space-y-3 text-sm">
                  <SummaryRow
                    label="Modelo de correção"
                    value="EC 136/2025 — min(IPCA+2%, Selic)"
                  />
                  <SummaryRow
                    label="Modelo tributário"
                    value={`Ganho de capital flat ${fmtPct(pricing.taxRate)}`}
                  />
                  <SummaryRow label="Custo operacional" value={fmtBRL(pricing.operationalCost)} />
                  <SummaryRow
                    label="Correção anual estimada"
                    value={fmtPct(pricing.annualCorrectionRate)}
                  />
                  <SummaryRow
                    label="Snapshot de mercado"
                    value={
                      pricing.assumptions?.marketRatesAsOf
                        ? fmtRelative(pricing.assumptions.marketRatesAsOf)
                        : '—'
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Calculadora de Cessão
                </h2>
                {recomputing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Stat label="Valor face" value={fmtBRL(pricing.faceValue)} accent="primary" large />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Sua oferta (% do face)
                  </label>
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {(offerRate * 100).toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[offerRate]}
                  onValueChange={(v) => setOfferRate(v[0])}
                  min={0.1}
                  max={0.95}
                  step={0.01}
                />
                <div className="text-sm tabular-nums font-medium">
                  Custo: {fmtBRL(pricing.acquisitionCost)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Prazo estimado
                  </label>
                  <span className="font-mono text-sm font-bold tabular-nums">{termMonths}m</span>
                </div>
                <Slider
                  value={[termMonths]}
                  onValueChange={(v) => setTermMonths(Math.round(v[0]))}
                  min={1}
                  max={120}
                  step={1}
                />
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <SummaryRow label="Recebimento esperado" value={fmtBRL(pricing.expectedPayment)} />
                <SummaryRow
                  label="Tributos estimados"
                  value={`− ${fmtBRL(pricing.estimatedTax)}`}
                />
                <SummaryRow
                  label="Custos operacionais"
                  value={`− ${fmtBRL(pricing.operationalCost)}`}
                />
                <SummaryRow
                  label="Lucro líquido"
                  value={fmtBRL(pricing.netProfit)}
                  bold
                  accent="success"
                />
              </div>

              <div className="border-t border-border pt-4 space-y-1.5">
                <SummaryRow
                  label="TIR ajustada"
                  value={fmtPct(pricing.riskAdjustedIrr)}
                  bold
                  accent="success"
                />
                <SummaryRow label="Múltiplo" value={`${multiplier.toFixed(2)}x`} />
                <SummaryRow label="Payback" value={`${termMonths} meses`} />
                <SummaryRow
                  label="vs CDI"
                  value={`${irrVsCdi.toFixed(0)}%`}
                  accent={irrVsCdi > 200 ? 'success' : 'muted'}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button>
                  <Save className="me-1 size-3.5" />
                  Salvar oferta
                </Button>
                <Button variant="outline" size="sm">
                  <Briefcase className="me-1 size-3.5" />
                  Adicionar ao Pipeline
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
  large,
}: {
  label: string
  value: string
  hint?: string
  accent?: 'primary' | 'success' | 'muted'
  large?: boolean
}) {
  const colorClass =
    accent === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'primary'
        ? 'text-foreground'
        : 'text-foreground'
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={`mt-1 ${large ? 'text-2xl' : 'text-base'} font-bold tabular-nums ${colorClass}`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string
  value: string
  bold?: boolean
  accent?: 'success' | 'muted'
}) {
  const colorClass =
    accent === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : 'font-medium'} ${colorClass}`}>
        {value}
      </span>
    </div>
  )
}

function ComparisonRow({
  label,
  value,
  pct,
  accent,
}: {
  label: string
  value: string
  pct: number
  accent: 'primary' | 'info' | 'muted'
}) {
  const barClass =
    accent === 'primary'
      ? 'bg-emerald-500'
      : accent === 'info'
        ? 'bg-violet-500'
        : 'bg-muted-foreground/40'
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className={accent === 'primary' ? 'font-medium' : 'text-muted-foreground'}>
          {label}
        </span>
        <span className="tabular-nums font-bold">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barClass} rounded-full`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

function SignalRow({ signal }: { signal: Signal }) {
  const positive = signal.polarity === 'positive'
  return (
    <div className="flex items-start gap-2.5 text-sm">
      {positive ? (
        <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium">{signal.label}</div>
        {signal.eventDate && (
          <div className="text-xs text-muted-foreground tabular-nums">
            <Calendar className="inline size-3 me-1" />
            {fmtRelative(signal.eventDate)}
          </div>
        )}
      </div>
      {signal.paymentMultiplier !== undefined && (
        <span
          className={`text-xs font-mono tabular-nums shrink-0 ${
            signal.paymentMultiplier > 1
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {signal.paymentMultiplier > 1 ? '×' : '÷'}
          {Math.abs(
            signal.paymentMultiplier > 1
              ? signal.paymentMultiplier
              : 1 / Math.max(signal.paymentMultiplier, 0.01)
          ).toFixed(2)}
        </span>
      )}
    </div>
  )
}
