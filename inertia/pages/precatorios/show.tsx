import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft, Building2, Clock3, Database, FileJson, Hash, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
import { StatusBadge } from '~/components/status-badge'
import { fmtBRL, fmtDate, fmtRelative } from '~/lib/helpers'

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
}

type Props = {
  asset: Asset
}

export default function PrecatorioShow({ asset }: Props) {
  const eventsCount = asset.events?.length ?? 0

  return (
    <>
      <Head title={asset.cnjNumber ?? `Precatório ${asset.id.slice(0, 8)}`} />

      <PageHeader
        title={asset.cnjNumber ?? asset.externalId ?? `Precatório #${asset.id.slice(0, 8)}`}
        description={asset.debtor?.name ?? 'Detalhes do ativo judicial.'}
        breadcrumbs={[
          { label: 'Precatórios', href: '/precatorios' },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList variant="line" size="sm" className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Resumo</TabsTrigger>
              <TabsTrigger value="events">
                Linha do tempo
                {eventsCount > 0 && (
                  <span className="text-[11px] tabular-nums">({eventsCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="raw">Origem e auditoria</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-3">
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold">Dados do ativo</h2>
                </CardHeader>
                <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="CNJ" value={asset.cnjNumber ?? '—'} mono />
                  <Field label="ID externo" value={asset.externalId ?? '—'} mono />
                  <Field
                    label="Origem"
                    value={<LabelChip variant="info">{sourceLabel(asset.source)}</LabelChip>}
                  />
                  <Field
                    label="Natureza"
                    value={<LabelChip variant="primary">{enumLabel(asset.nature)}</LabelChip>}
                  />
                  <Field label="Exercício" value={asset.exerciseYear ?? '—'} />
                  <Field label="Ano orçamentário" value={asset.budgetYear ?? '—'} />
                  <Field label="Fila (posição)" value={asset.queuePosition ?? '—'} />
                  <Field label="Data base" value={asset.baseDate ? fmtDate(asset.baseDate) : '—'} />
                  <Field label="Valor face" value={fmtBRL(asset.faceValue)} accent="primary" />
                  <Field
                    label="Valor estimado atualizado"
                    value={fmtBRL(asset.estimatedUpdatedValue)}
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
                Status
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryStatusRow
                label="Lifecycle"
                badge={<StatusBadge kind="lifecycle" value={asset.lifecycleStatus} />}
              />
              <SummaryStatusRow
                label="Compliance"
                badge={<StatusBadge kind="compliance" value={asset.complianceStatus} />}
              />
              <SummaryStatusRow
                label="PII"
                badge={<StatusBadge kind="pii" value={asset.piiStatus} />}
              />
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
                Trilha
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
                  <div className="font-medium text-foreground">PII no bunker</div>
                  <div className="text-muted-foreground mt-0.5">
                    Beneficiários armazenados em schema isolado. Acesso requer permissão e gera log
                    de auditoria.
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

function enumLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
