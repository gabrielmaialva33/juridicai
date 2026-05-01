import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft, Building2, FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader } from '~/components/shared/page-header'
import { fmtBRL, fmtRelative } from '~/lib/helpers'

type Asset = {
  id: string
  cnjNumber?: string | null
  faceValue?: string | number | null
  exerciseYear?: number | null
  lifecycleStatus: string
}

type Debtor = {
  id: string
  name: string
  debtorType: string
  cnpj?: string | null
  stateCode?: string | null
  paymentRegime?: string | null
  paymentReliabilityScore?: number | null
  rclEstimate?: string | number | null
  debtStockEstimate?: string | number | null
  createdAt: string
  updatedAt: string
  assets?: Asset[]
}

type Props = {
  debtor: Debtor
}

const DEBTOR_TYPE_LABEL: Record<string, string> = {
  union: 'União',
  state: 'Estado',
  municipality: 'Município',
  autarchy: 'Autarquia',
  foundation: 'Fundação',
}

export default function DebtorShow({ debtor }: Props) {
  const assets = debtor.assets ?? []
  const totalFace = assets.reduce((s, a) => s + Number(a.faceValue ?? 0), 0)

  return (
    <>
      <Head title={debtor.name} />

      <PageHeader
        title={debtor.name}
        description={`${DEBTOR_TYPE_LABEL[debtor.debtorType] ?? debtor.debtorType} · ${debtor.stateCode ?? '—'}`}
        breadcrumbs={[
          { label: 'Devedores', href: '/debtors' },
          { label: debtor.name.slice(0, 40) + (debtor.name.length > 40 ? '...' : '') },
        ]}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/debtors">
            <ArrowLeft className="me-1 size-3.5" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Identificação</h2>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field
                label="Tipo"
                value={
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">
                    {DEBTOR_TYPE_LABEL[debtor.debtorType] ?? debtor.debtorType}
                  </span>
                }
              />
              <Field label="UF" value={debtor.stateCode ?? '—'} mono />
              <Field label="CNPJ" value={debtor.cnpj ?? '—'} mono />
              <Field label="Regime de pagamento" value={debtor.paymentRegime ?? '—'} />
              <Field
                label="RCL estimada"
                value={debtor.rclEstimate ? fmtBRL(debtor.rclEstimate) : '—'}
              />
              <Field
                label="Estoque de dívida"
                value={debtor.debtStockEstimate ? fmtBRL(debtor.debtStockEstimate) : '—'}
              />
              <Field
                label="Score de confiabilidade"
                value={
                  debtor.paymentReliabilityScore !== null &&
                  debtor.paymentReliabilityScore !== undefined
                    ? debtor.paymentReliabilityScore.toFixed(1)
                    : '—'
                }
              />
              <Field label="Atualizado" value={fmtRelative(debtor.updatedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <FileSearch className="size-4" />
                  Precatórios deste devedor
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {assets.length} mais recentes
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {assets.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum precatório vinculado.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {assets.slice(0, 20).map((a) => (
                    <li key={a.id} className="px-5 py-3 hover:bg-muted/40 transition-colors">
                      <Link
                        href={`/precatorios/${a.id}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono tabular-nums text-muted-foreground">
                            {a.cnjNumber ?? a.id.slice(0, 8)}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">
                            {a.exerciseYear ?? '—'}
                          </span>
                        </div>
                        <span className="font-medium tabular-nums shrink-0">
                          {fmtBRL(a.faceValue)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 className="size-3.5" />
                Resumo
              </h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryRow label="Total de assets visíveis" value={String(assets.length)} />
              <SummaryRow label="Soma face value" value={fmtBRL(totalFace)} mono />
              <SummaryRow label="Cadastrado" value={fmtRelative(debtor.createdAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}
      </div>
      <div className={`text-sm ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</div>
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`tabular-nums text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
