import { Head } from '@inertiajs/react'
import { Building2, CheckCircle2, ShieldCheck, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader } from '~/components/shared/page-header'
import { fmtDate, fmtNum } from '~/lib/helpers'

type Tenant = {
  id: string
  name: string
  slug: string
  document?: string | null
  status: string
  plan?: string | null
  rbacVersion?: number
  rbac_version?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

type Props = {
  tenant: Tenant
  activeMemberCount: number
}

const STATUS_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  active: { label: 'Ativo', variant: 'success' },
  trial: { label: 'Trial', variant: 'warning' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
  archived: { label: 'Arquivado', variant: 'secondary' },
}

export default function SettingsTenant({ tenant, activeMemberCount }: Props) {
  const statusMeta = STATUS_LABEL[tenant.status] ?? {
    label: tenant.status,
    variant: 'secondary' as const,
  }
  const rbacVersion = tenant.rbacVersion ?? tenant.rbac_version ?? 1
  const createdAt = tenant.createdAt ?? tenant.created_at
  const updatedAt = tenant.updatedAt ?? tenant.updated_at

  return (
    <>
      <Head title="Configurações · Tenant" />

      <PageHeader
        title="Configurações do tenant"
        description="Detalhes da organização ativa nesta sessão."
        breadcrumbs={[{ label: 'Configurações' }, { label: 'Tenant' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Building2 className="size-4" />
                Identidade
              </h2>
              <Badge variant={statusMeta.variant} appearance="light">
                {statusMeta.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Razão social" value={tenant.name} />
            <Field label="Slug" value={`/${tenant.slug}`} mono />
            <Field label="Documento (CNPJ)" value={tenant.document ?? '—'} mono />
            <Field label="Plano" value={tenant.plan ?? '—'} />
            <Field label="Cadastrado em" value={createdAt ? fmtDate(createdAt) : '—'} />
            <Field label="Atualizado em" value={updatedAt ? fmtDate(updatedAt) : '—'} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="size-3.5" />
                Equipe
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-bold tabular-nums">{fmtNum(activeMemberCount)}</div>
                <div className="text-xs text-muted-foreground">membros ativos</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="size-3.5" />
                Governança
              </h2>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <SummaryRow
                label="rbac_version"
                value={`v${rbacVersion}`}
                hint="incrementa em mudanças de permissão"
              />
              <SummaryRow label="ID interno" value={tenant.id.slice(0, 13) + '…'} mono />
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-medium">Multi-tenant ativo</div>
                <div className="text-muted-foreground mt-0.5">
                  Isolamento via <code className="font-mono">tenant_id</code> + RLS no schema{' '}
                  <code className="font-mono">pii.*</code>.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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
  hint,
  mono,
}: {
  label: string
  value: string
  hint?: string
  mono?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-medium tabular-nums ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  )
}
