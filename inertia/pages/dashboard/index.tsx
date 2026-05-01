import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Activity, FileSearch, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '~/components/shared/page-header'
import { EmptyState } from '~/components/shared/empty-state'
import { fmtBRL, fmtNum, fmtRelative } from '~/lib/helpers'

type AssetMetrics = {
  tenant_id: string
  total_assets: string | number
  paid_assets: string | number
  approved_for_analysis: string | number
  total_face_value: string | number
  total_estimated_updated_value: string | number
  refreshed_at: string
}

type DebtorAggregate = {
  tenant_id: string
  debtor_id: string
  name: string
  asset_count: string | number
  total_face_value: string | number
  average_score: string | number
  refreshed_at: string
}

type Props = {
  assetMetrics: AssetMetrics | null
  debtorAggregates: DebtorAggregate[]
}

export default function DashboardIndex({ assetMetrics, debtorAggregates }: Props) {
  const topDebtors = [...debtorAggregates]
    .sort((a, b) => Number(b.total_face_value) - Number(a.total_face_value))
    .slice(0, 10)

  const maxValue = topDebtors[0] ? Number(topDebtors[0].total_face_value) : 0
  const totalAssets = Number(assetMetrics?.total_assets ?? 0)
  const paidAssets = Number(assetMetrics?.paid_assets ?? 0)
  const approvedForAnalysis = Number(assetMetrics?.approved_for_analysis ?? 0)
  const paidPct = totalAssets > 0 ? (paidAssets / totalAssets) * 100 : 0
  const approvedPct = totalAssets > 0 ? (approvedForAnalysis / totalAssets) * 100 : 0

  return (
    <>
      <Head title="Dashboard" />

      <PageHeader
        title="Radar Federal"
        description={
          assetMetrics?.refreshed_at
            ? `Métricas atualizadas ${fmtRelative(assetMetrics.refreshed_at)}`
            : 'Visão geral do tenant ativo.'
        }
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/precatorios">
            <FileSearch className="me-1 size-3.5" />
            Ver precatórios
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/health">
            <Activity className="me-1 size-3.5" />
            Health
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total de assets"
          value={fmtNum(totalAssets)}
          subtitle="Precatórios na base"
          accent="primary"
        />
        <KpiCard
          label="Pagos"
          value={fmtNum(paidAssets)}
          subtitle={`${paidPct.toFixed(1)}% do total`}
          accent="success"
        />
        <KpiCard
          label="Aprovados análise"
          value={fmtNum(approvedForAnalysis)}
          subtitle={`${approvedPct.toFixed(1)}% do total`}
          accent="info"
        />
        <KpiCard
          label="Valor face total"
          value={fmtBRL(assetMetrics?.total_face_value)}
          subtitle={`Estimado: ${fmtBRL(assetMetrics?.total_estimated_updated_value)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Top devedores por valor</h2>
              <Badge variant="outline" appearance="ghost" size="sm">
                {topDebtors.length} de {fmtNum(debtorAggregates.length)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topDebtors.length === 0 ? (
              <EmptyState
                icon={<Users className="size-10" />}
                message="Sem devedores"
                description="Importe precatórios SIOP para popular o radar."
              >
                <Button asChild size="sm">
                  <Link href="/siop/imports/new">Novo import</Link>
                </Button>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {topDebtors.map((d, idx) => {
                  const value = Number(d.total_face_value)
                  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
                  return (
                    <li key={d.debtor_id} className="px-5 py-3 hover:bg-muted/40 transition-colors">
                      <Link href={`/debtors/${d.debtor_id}`} className="block">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate font-medium">{d.name}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground shrink-0">
                            {fmtBRL(value)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                          <span>{fmtNum(d.asset_count)} ativos</span>
                          <span>·</span>
                          <span>score {Number(d.average_score ?? 0).toFixed(1)}</span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Resumo</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow label="Devedores únicos" value={fmtNum(debtorAggregates.length)} />
            <SummaryRow
              label="Score médio (top 10)"
              value={
                topDebtors.length > 0
                  ? (
                      topDebtors.reduce((sum, d) => sum + Number(d.average_score ?? 0), 0) /
                      topDebtors.length
                    ).toFixed(1)
                  : '—'
              }
            />
            <SummaryRow
              label="Última atualização"
              value={assetMetrics?.refreshed_at ? fmtRelative(assetMetrics.refreshed_at) : '—'}
              hint={
                <Button variant="ghost" size="sm" mode="icon" className="size-6">
                  <RefreshCw className="size-3" />
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function KpiCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string
  value: string
  subtitle?: string
  accent?: 'primary' | 'success' | 'info'
}) {
  const accentClass =
    accent === 'primary'
      ? 'before:bg-primary'
      : accent === 'success'
        ? 'before:bg-emerald-500'
        : accent === 'info'
          ? 'before:bg-violet-500'
          : 'before:bg-muted-foreground/30'

  return (
    <Card
      className={`relative overflow-hidden before:absolute before:inset-y-0 before:start-0 before:w-0.5 ${accentClass}`}
    >
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums leading-tight">{value}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

function SummaryRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
        {value}
        {hint}
      </span>
    </div>
  )
}
