import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft, Building2, Hash, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
        {/* Left: tabs com detalhes */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="events">
                Eventos {asset.events?.length ? `(${asset.events.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="raw">Dados brutos</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-3">
              <Card>
                <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="CNJ" value={asset.cnjNumber ?? '—'} mono />
                  <Field label="ID externo" value={asset.externalId ?? '—'} mono />
                  <Field
                    label="Source"
                    value={
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{asset.source}</span>
                    }
                  />
                  <Field
                    label="Natureza"
                    value={
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{asset.nature}</span>
                    }
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
                <CardContent className="p-0">
                  {!asset.events || asset.events.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Sem eventos registrados.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {asset.events.map((ev) => (
                        <li key={ev.id} className="px-5 py-3 flex items-start gap-3">
                          <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-sm font-mono">{ev.eventType}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {fmtRelative(ev.eventDate)}
                              </span>
                            </div>
                            {ev.payload && (
                              <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                                {JSON.stringify(ev.payload, null, 0)}
                              </pre>
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
              <Card>
                <CardContent className="p-0">
                  {!asset.rawData ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Sem dados brutos.
                    </div>
                  ) : (
                    <pre className="p-5 text-xs font-mono whitespace-pre-wrap break-all max-h-[500px] overflow-auto">
                      {JSON.stringify(asset.rawData, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: sticky summary */}
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
