import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileJson,
  FileText,
  Hash,
  Lock,
  SearchCheck,
  ShieldAlert,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
import { StatusBadge } from '~/components/status-badge'
import { fmtBRL, fmtDate, fmtRelative } from '~/lib/helpers'
import { jsonRequest } from '~/lib/http'

type Asset = {
  id: string
  cnjNumber?: string | null
  externalId?: string | null
  source: string
  nature: string
  exerciseYear?: number | null
  faceValue?: string | number | null
  estimatedUpdatedValue?: string | number | null
  baseDate?: string | null
  budgetYear?: number | null
  queuePosition?: number | null
  lifecycleStatus: string
  complianceStatus: string
  piiStatus: string
  currentScore?: number | null
  rowFingerprint?: string | null
  rawData?: Record<string, any> | null
  createdAt: string
  updatedAt: string
  debtor?: {
    id: string
    name: string
    debtorType?: string
    stateCode?: string | null
    cnpj?: string | null
  } | null
  events?: Array<{
    id: string
    eventType: string
    eventDate: string
    payload?: Record<string, any> | null
  }>
  scores?: Array<{
    id: string
    finalScore?: number | null
    legalSignalScore?: number | null
    riskScore?: number | null
    maturityScore?: number | null
    liquidityScore?: number | null
    explanation?: Record<string, any> | null
    computedAt: string
  }>
  judicialProcesses?: Array<{
    id: string
    cnjNumber: string
    courtCode?: string | null
    courtName?: string | null
    className?: string | null
    subject?: string | null
    filedAt?: string | null
  }>
  publications?: Array<{
    id: string
    source: string
    publicationDate: string
    title?: string | null
    body: string
  }>
  cessionOpportunity?: {
    id: string
    stage: string
    grade?: string | null
    riskAdjustedIrr?: string | number | null
    paymentProbability?: string | number | null
    offerValue?: string | number | null
  } | null
}

type Props = {
  asset: Asset
}

type SignalTone = 'positive' | 'warning' | 'critical' | 'neutral'

type Signal = {
  label: string
  description: string
  tone: SignalTone
}

type EvidenceItem = {
  id: string
  title: string
  subtitle?: string
  meta?: string
}

export default function PrecatorioShow({ asset }: Props) {
  const [movingToStage, setMovingToStage] = useState<string | null>(null)
  const eventsCount = asset.events?.length ?? 0
  const latestScore = asset.scores?.[0]
  const legalSignals = useMemo(() => buildLegalSignals(asset), [asset])
  const risks = useMemo(() => buildRiskChecklist(asset), [asset])
  const verdict = assetVerdict(asset)
  const opportunity = asset.cessionOpportunity

  async function moveToPipeline(stage: 'inbox' | 'qualified' | 'due_diligence') {
    setMovingToStage(stage)

    try {
      await jsonRequest(`/operations/opportunities/${asset.id}/pipeline`, {
        method: 'POST',
        body: { stage },
      })

      toast.success('Ativo enviado para o pipeline.')
      router.visit(`/operations/opportunities/${asset.id}`)
    } catch {
      toast.error('Não foi possível atualizar o pipeline.')
    } finally {
      setMovingToStage(null)
    }
  }

  return (
    <>
      <Head title={asset.cnjNumber ?? `Ativo ${asset.id.slice(0, 8)}`} />

      <PageHeader
        title={asset.cnjNumber ?? asset.externalId ?? `Precatório #${asset.id.slice(0, 8)}`}
        description={`${asset.debtor?.name ?? 'Devedor não identificado'} · ${enumLabel(asset.nature)} · Exec. ${asset.exerciseYear ?? '—'}`}
        breadcrumbs={[
          { label: 'Base de Ativos', href: '/precatorios' },
          { label: asset.cnjNumber ?? `#${asset.id.slice(0, 8)}` },
        ]}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/precatorios">
            <ArrowLeft className="me-1 size-3.5" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <Card className="mb-4 border-primary/20 bg-orange-50/60 dark:bg-orange-500/5">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <DecisionMetric
            label="Leitura operacional"
            value={<LabelChip variant={verdict.variant}>{verdict.label}</LabelChip>}
            hint={verdict.hint}
          />
          <DecisionMetric label="Valor face" value={fmtBRL(asset.faceValue)} strong />
          <DecisionMetric
            label="Score jurídico"
            value={formatScore(latestScore?.legalSignalScore ?? asset.currentScore)}
            hint={
              latestScore?.computedAt
                ? `Atualizado ${fmtRelative(latestScore.computedAt)}`
                : undefined
            }
            strong
          />
          <DecisionMetric
            label="Etapa"
            value={<StatusBadge kind="lifecycle" value={asset.lifecycleStatus} />}
          />
          <DecisionMetric
            label="Revisão"
            value={<StatusBadge kind="compliance" value={asset.complianceStatus} />}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Tabs defaultValue="dossier">
            <TabsList variant="line" size="sm" className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="dossier">Dossiê</TabsTrigger>
              <TabsTrigger value="events">
                Linha do tempo
                {eventsCount > 0 && (
                  <span className="text-[11px] tabular-nums">({eventsCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="raw">Origem e auditoria</TabsTrigger>
            </TabsList>

            <TabsContent value="dossier" className="mt-3 space-y-4">
              <Card>
                <CardHeader>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <SearchCheck className="size-4 text-primary" />
                    Resumo executivo
                  </h2>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
                  <Field label="Ativo" value={asset.cnjNumber ?? asset.externalId ?? '—'} mono />
                  <Field label="Devedor" value={asset.debtor?.name ?? '—'} />
                  <Field
                    label="Classe"
                    value={<LabelChip variant="primary">{enumLabel(asset.nature)}</LabelChip>}
                  />
                  <Field
                    label="Origem"
                    value={<LabelChip variant="info">{sourceLabel(asset.source)}</LabelChip>}
                  />
                  <Field label="Valor face" value={fmtBRL(asset.faceValue)} accent="primary" />
                  <Field
                    label="Valor atualizado estimado"
                    value={fmtBRL(asset.estimatedUpdatedValue)}
                    accent="primary"
                  />
                  <Field label="Exercício" value={asset.exerciseYear ?? '—'} />
                  <Field
                    label="Fila"
                    value={asset.queuePosition ? `Posição ${asset.queuePosition}` : '—'}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <CheckCircle2 className="size-4 text-[var(--color-success-accent)]" />
                      Sinais jurídicos
                    </h2>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {legalSignals.map((signal) => (
                      <SignalRow key={signal.label} signal={signal} />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <ShieldAlert className="size-4 text-[var(--color-warning-accent)]" />
                      Riscos e diligências
                    </h2>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {risks.map((risk) => (
                      <SignalRow key={risk.label} signal={risk} />
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <FileText className="size-4 text-primary" />
                    Processos e publicações
                  </h2>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 lg:grid-cols-2">
                  <EvidenceList
                    title="Processos vinculados"
                    empty="Nenhum processo vinculado."
                    items={(asset.judicialProcesses ?? []).slice(0, 3).map((process) => ({
                      id: process.id,
                      title: process.cnjNumber,
                      subtitle: [process.courtName, process.className].filter(Boolean).join(' · '),
                      meta: process.filedAt ? fmtDate(process.filedAt) : undefined,
                    }))}
                  />
                  <EvidenceList
                    title="Publicações recentes"
                    empty="Nenhuma publicação vinculada."
                    items={(asset.publications ?? []).slice(0, 3).map((publication) => ({
                      id: publication.id,
                      title: publication.title ?? publication.body.slice(0, 80),
                      subtitle: publication.body,
                      meta: fmtDate(publication.publicationDate),
                    }))}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="mt-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Clock3 className="size-4 text-primary" />
                      Eventos operacionais
                    </h2>
                    <LabelChip variant={eventsCount > 0 ? 'primary' : 'default'}>
                      {`${eventsCount} registro${eventsCount === 1 ? '' : 's'}`}
                    </LabelChip>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {!asset.events || asset.events.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Sem eventos registrados.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {asset.events.map((ev) => (
                        <li key={ev.id} className="flex items-start gap-3 px-5 py-4">
                          <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {eventLabel(ev.eventType)}
                                </div>
                                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                  {ev.eventType}
                                </div>
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {fmtRelative(ev.eventDate)}
                              </span>
                            </div>
                            {ev.payload && (
                              <details className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                                <summary className="cursor-pointer select-none font-medium text-muted-foreground">
                                  Payload
                                </summary>
                                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                                  {JSON.stringify(ev.payload, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="raw" className="mt-3">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Database className="size-4 text-primary" />
                      Proveniência
                    </h2>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field
                      label="Origem"
                      value={<LabelChip variant="info">{sourceLabel(asset.source)}</LabelChip>}
                    />
                    <Field label="ID externo" value={asset.externalId ?? '—'} mono />
                    <Field
                      label="Fingerprint"
                      value={asset.rowFingerprint ? asset.rowFingerprint.slice(0, 24) : '—'}
                      mono
                    />
                    <Field label="Última atualização" value={fmtRelative(asset.updatedAt)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <FileJson className="size-4 text-primary" />
                      Payload de origem
                    </h2>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!asset.rawData ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Sem payload de origem.
                      </div>
                    ) : (
                      <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-all p-5 font-mono text-xs leading-relaxed text-muted-foreground">
                        {JSON.stringify(asset.rawData, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Ações
              </h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {opportunity ? (
                <Button className="w-full justify-start" size="sm" asChild>
                  <Link href={`/operations/opportunities/${asset.id}`}>
                    <Target className="me-2 size-4" />
                    Ver oportunidade
                  </Link>
                </Button>
              ) : (
                <Button
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => moveToPipeline('qualified')}
                  disabled={movingToStage !== null}
                >
                  <Target className="me-2 size-4" />
                  Triar no pipeline
                </Button>
              )}
              <Button
                className="w-full justify-start"
                variant="outline"
                size="sm"
                onClick={() => moveToPipeline('due_diligence')}
                disabled={movingToStage !== null}
              >
                <SearchCheck className="me-2 size-4" />
                Abrir diligência
              </Button>
              <Button
                className="w-full justify-start"
                variant="ghost"
                size="sm"
                onClick={() => moveToPipeline('inbox')}
                disabled={movingToStage !== null}
              >
                <Eye className="me-2 size-4" />
                Monitorar sinais
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Leitura
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryStatusRow
                label="Etapa"
                badge={<StatusBadge kind="lifecycle" value={asset.lifecycleStatus} />}
              />
              <SummaryStatusRow
                label="Revisão"
                badge={<StatusBadge kind="compliance" value={asset.complianceStatus} />}
              />
              <SummaryStatusRow
                label="Dados"
                badge={<StatusBadge kind="pii" value={asset.piiStatus} />}
              />
              {opportunity && (
                <SummaryStatusRow
                  label="Pipeline"
                  badge={
                    <LabelChip variant="primary">{pipelineStageLabel(opportunity.stage)}</LabelChip>
                  }
                />
              )}
              <SummaryStatusRow
                label="Score"
                badge={
                  <span className="font-mono text-sm tabular-nums">
                    {asset.currentScore?.toFixed(1) ?? '—'}
                  </span>
                }
              />
            </CardContent>
          </Card>

          {asset.debtor && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Building2 className="size-3.5" />
                  Devedor
                </h2>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <Link
                  href={`/debtors/${asset.debtor.id}`}
                  className="font-medium hover:underline underline-offset-2"
                >
                  {asset.debtor.name}
                </Link>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {asset.debtor.debtorType && (
                    <span className="px-1.5 py-0.5 rounded bg-muted">
                      {asset.debtor.debtorType}
                    </span>
                  )}
                  {asset.debtor.stateCode && <span>{asset.debtor.stateCode}</span>}
                  {asset.debtor.cnpj && (
                    <span className="font-mono tabular-nums">{asset.debtor.cnpj}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Hash className="size-3.5" />
                Auditoria
              </h2>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <SummaryRow label="Criado" value={fmtRelative(asset.createdAt)} />
              <SummaryRow label="Atualizado" value={fmtRelative(asset.updatedAt)} />
              {asset.rowFingerprint && (
                <SummaryRow
                  label="Fingerprint"
                  value={asset.rowFingerprint.slice(0, 12) + '…'}
                  mono
                />
              )}
            </CardContent>
          </Card>

          {asset.piiStatus !== 'none' && (
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardContent className="p-4 flex items-start gap-2.5">
                <Lock className="size-4 text-violet-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-medium text-foreground">Dados sensíveis no bunker</div>
                  <div className="text-muted-foreground mt-0.5">
                    Beneficiários armazenados em schema isolado. Revelação exige permissão e gera
                    auditoria.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function DecisionMetric({
  label,
  value,
  hint,
  strong,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  strong?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`min-h-6 text-sm ${strong ? 'text-base font-semibold tabular-nums' : ''}`}>
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function SignalRow({ signal }: { signal: Signal }) {
  const Icon =
    signal.tone === 'positive'
      ? CheckCircle2
      : signal.tone === 'critical'
        ? ShieldAlert
        : signal.tone === 'warning'
          ? AlertTriangle
          : Eye

  const toneClass =
    signal.tone === 'positive'
      ? 'text-[var(--color-success-accent)] bg-[var(--color-success-soft)]'
      : signal.tone === 'critical'
        ? 'text-[var(--color-destructive-accent)] bg-[var(--color-destructive-soft)]'
        : signal.tone === 'warning'
          ? 'text-[var(--color-warning-accent)] bg-[var(--color-warning-soft)]'
          : 'text-[var(--color-info-accent)] bg-[var(--color-info-soft)]'

  return (
    <div className="flex gap-3 rounded-md border border-border bg-muted/20 p-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{signal.label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {signal.description}
        </div>
      </div>
    </div>
  )
}

function EvidenceList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: EvidenceItem[]
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  {item.subtitle && (
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {item.meta && (
                  <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {item.meta}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  accent?: 'primary'
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}
      </div>
      <div
        className={`text-sm ${mono ? 'font-mono tabular-nums' : ''} ${accent === 'primary' ? 'font-semibold text-base' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}

function SummaryStatusRow({ label, badge }: { label: string; badge: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{badge}</span>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
    </div>
  )
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    siop: 'SIOP',
    datajud: 'DataJud',
    djen: 'DJEN',
    trf2: 'TRF-2',
  }

  return labels[source.toLowerCase()] ?? enumLabel(source)
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    siop_imported: 'Importado do SIOP',
    score_computed: 'Score calculado',
    lifecycle_changed: 'Status atualizado',
    compliance_changed: 'Compliance atualizado',
    datajud_enriched: 'Enriquecido via DataJud',
    datajud_candidate_matched: 'Candidato DataJud encontrado',
    publication_detected: 'Publicação detectada',
    trf2_imported: 'Importado do TRF-2',
  }

  return labels[eventType] ?? enumLabel(eventType)
}

function buildLegalSignals(asset: Asset): Signal[] {
  const signals: Signal[] = []
  const hasProcess = (asset.judicialProcesses?.length ?? 0) > 0
  const publicationsCount = asset.publications?.length ?? 0
  const score = asset.scores?.[0]

  if (asset.nature === 'alimentar') {
    signals.push({
      label: 'Natureza alimentar',
      description: 'Classe costuma ter prioridade jurídica e pode melhorar atratividade de cessão.',
      tone: 'positive',
    })
  } else if (asset.nature === 'tributario') {
    signals.push({
      label: 'Natureza tributária',
      description: 'Exige leitura tributária própria para correção, compensação e liquidez.',
      tone: 'warning',
    })
  } else {
    signals.push({
      label: 'Classe do crédito',
      description: `Natureza registrada como ${enumLabel(asset.nature)}.`,
      tone: 'neutral',
    })
  }

  if (asset.lifecycleStatus === 'paid') {
    signals.push({
      label: 'Pagamento identificado',
      description:
        'Ativo já consta como pago; tratar como referência histórica ou baixa operacional.',
      tone: 'positive',
    })
  } else if (asset.lifecycleStatus === 'in_payment') {
    signals.push({
      label: 'Em pagamento',
      description: 'Sinal forte de liquidez; validar beneficiário, bloqueios e cessões anteriores.',
      tone: 'positive',
    })
  } else if (asset.lifecycleStatus === 'expedited') {
    signals.push({
      label: 'Requisitório expedido',
      description: 'Ativo já tem sinal de maturação para análise de fila e prazo estimado.',
      tone: 'positive',
    })
  } else {
    signals.push({
      label: 'Maturação em aberto',
      description: 'Ainda falta sinal conclusivo de pagamento, expedição ou andamento financeiro.',
      tone: 'warning',
    })
  }

  signals.push({
    label: hasProcess ? 'Processo vinculado' : 'Processo não vinculado',
    description: hasProcess
      ? `${asset.judicialProcesses?.length ?? 0} processo(s) conectado(s) ao ativo.`
      : 'Vincular processo melhora conferência de classe, partes, movimentações e publicações.',
    tone: hasProcess ? 'positive' : 'warning',
  })

  signals.push({
    label: publicationsCount > 0 ? 'Publicações capturadas' : 'Sem publicações vinculadas',
    description:
      publicationsCount > 0
        ? `${publicationsCount} publicação(ões) disponível(is) para leitura jurídica.`
        : 'Sem DJEN/tribunal vinculado neste dossiê; acompanhar fonte oficial antes de ofertar.',
    tone: publicationsCount > 0 ? 'positive' : 'warning',
  })

  if (score?.legalSignalScore !== null && score?.legalSignalScore !== undefined) {
    signals.push({
      label: 'Score jurídico calculado',
      description: `Pontuação jurídica atual: ${formatScore(score.legalSignalScore)}.`,
      tone: Number(score.legalSignalScore) >= 70 ? 'positive' : 'neutral',
    })
  }

  return signals
}

function buildRiskChecklist(asset: Asset): Signal[] {
  const text = searchableText(asset)
  const risks: Signal[] = []

  if (asset.complianceStatus === 'blocked' || asset.lifecycleStatus === 'suspended') {
    risks.push({
      label: 'Bloqueio operacional',
      description: 'Status atual impede evolução sem revisão jurídica.',
      tone: 'critical',
    })
  }

  if (includesAny(text, ['cessao', 'cessão', 'cessionario', 'cessionário'])) {
    risks.push({
      label: 'Cessão mencionada',
      description:
        'Há menção a cessão em eventos ou publicações; confirmar cadeia de titularidade.',
      tone: 'critical',
    })
  } else {
    risks.push({
      label: 'Cessão anterior não verificada',
      description:
        'Não há sinal de cessão no dossiê, mas a diligência documental segue necessária.',
      tone: 'warning',
    })
  }

  if (includesAny(text, ['penhora', 'bloqueio', 'indisponibilidade'])) {
    risks.push({
      label: 'Penhora ou bloqueio mencionado',
      description: 'Publicação ou evento sugere restrição sobre o crédito.',
      tone: 'critical',
    })
  }

  if (includesAny(text, ['suspensao', 'suspensão', 'liminar', 'sobrestado'])) {
    risks.push({
      label: 'Suspensão processual mencionada',
      description: 'Checar se o evento afeta pagamento, habilitação ou transferência.',
      tone: 'critical',
    })
  }

  if (includesAny(text, ['impugnacao', 'impugnação', 'embargos'])) {
    risks.push({
      label: 'Discussão pendente mencionada',
      description: 'Valor ou exigibilidade pode estar em disputa.',
      tone: 'warning',
    })
  }

  if (asset.piiStatus !== 'none') {
    risks.push({
      label: 'Beneficiário protegido',
      description: 'Dados pessoais estão no bunker; revelação exige permissão e justificativa.',
      tone: 'neutral',
    })
  }

  if (!asset.cnjNumber && (asset.judicialProcesses?.length ?? 0) === 0) {
    risks.push({
      label: 'Identificação processual incompleta',
      description: 'Sem CNJ ou processo vinculado, a conferência jurídica fica frágil.',
      tone: 'warning',
    })
  }

  if (risks.length === 0) {
    risks.push({
      label: 'Sem risco crítico detectado',
      description:
        'O dossiê não trouxe bloqueio textual evidente; revisar documentos antes da oferta.',
      tone: 'positive',
    })
  }

  return risks.slice(0, 6)
}

function assetVerdict(asset: Asset): {
  label: string
  hint: string
  variant: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
} {
  if (asset.lifecycleStatus === 'paid') {
    return { label: 'Recebido', hint: 'Baixa prioridade para originação', variant: 'success' }
  }

  if (asset.lifecycleStatus === 'suspended' || asset.complianceStatus === 'blocked') {
    return { label: 'Bloqueado', hint: 'Risco jurídico impeditivo', variant: 'danger' }
  }

  if (asset.complianceStatus === 'approved_for_sales') {
    return {
      label: 'Pronto para oferta',
      hint: 'Pode entrar no pipeline comercial',
      variant: 'success',
    }
  }

  if (asset.complianceStatus === 'approved_for_analysis') {
    return {
      label: 'Elegível para triagem',
      hint: 'Priorizar análise financeira',
      variant: 'primary',
    }
  }

  if (asset.lifecycleStatus === 'expedited' || asset.lifecycleStatus === 'in_payment') {
    return { label: 'Sinal positivo', hint: 'Acompanhar eventos e fila', variant: 'info' }
  }

  return { label: 'Monitorar', hint: 'Aguardando sinais de maturação', variant: 'warning' }
}

function pipelineStageLabel(stage: string) {
  const labels: Record<string, string> = {
    inbox: 'Inbox',
    qualified: 'Qualificada',
    contact: 'Contato',
    offer: 'Oferta',
    due_diligence: 'Diligência',
    cession: 'Cessão',
    paid: 'Pago',
    lost: 'Perdida',
  }

  return labels[stage] ?? enumLabel(stage)
}

function formatScore(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : String(value)
}

function searchableText(asset: Asset) {
  return [
    ...(asset.events ?? []).map(
      (event) => `${event.eventType} ${JSON.stringify(event.payload ?? {})}`
    ),
    ...(asset.publications ?? []).map(
      (publication) => `${publication.title ?? ''} ${publication.body}`
    ),
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) =>
    value.includes(
      needle
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
    )
  )
}

function enumLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
