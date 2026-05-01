import { Head } from '@inertiajs/react'
import { ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '~/components/shared/page-header'
import { EmptyState } from '~/components/shared/empty-state'
import { LabelChip } from '~/components/shared/label-chip'
import { getInitials } from '~/lib/helpers'
import { fmtRelative } from '~/lib/helpers'

type Role = {
  id: string
  name: string
  slug: string
  description?: string | null
  permissionCount?: string | number
}

type Membership = {
  id: string
  fullName: string
  email: string
  userStatus: string
  membershipId: string
  membershipStatus: string
  joinedAt: string
  roles: Role[]
}

type Props = {
  memberships: Membership[]
  allRoles: Role[]
}

const ROLE_BADGE: Record<
  string,
  'primary' | 'success' | 'warning' | 'info' | 'destructive' | 'secondary'
> = {
  root: 'destructive',
  tenant_admin: 'primary',
  operations_lead: 'success',
  compliance_officer: 'warning',
  analyst: 'info',
  viewer: 'secondary',
}

export default function SettingsUsers({ memberships, allRoles }: Props) {
  return (
    <>
      <Head title="Configurações · Permissões" />

      <PageHeader
        title="Permissões"
        description={`${memberships.length} membros · ${allRoles.length} papéis disponíveis`}
        breadcrumbs={[{ label: 'Configurações' }, { label: 'Permissões' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
            {memberships.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="size-12" />}
                message="Sem membros"
                description="Convide colaboradores pra começar a operar."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead>Papéis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Membro desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                            {getInitials(m.fullName, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.fullName}</div>
                            <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">sem papel</span>
                          ) : (
                            m.roles.map((r) => (
                              <Badge
                                key={r.id}
                                variant={ROLE_BADGE[r.slug] ?? 'secondary'}
                                appearance="light"
                                size="sm"
                              >
                                {roleLabel(r.slug, r.name)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.membershipStatus === 'active' ? 'success' : 'secondary'}
                          appearance="light"
                          size="sm"
                        >
                          {m.membershipStatus === 'active' ? 'Ativo' : m.membershipStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                        {fmtRelative(m.joinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" />
                Papéis operacionais
              </h3>
              <LabelChip variant="default">{`${allRoles.length} ativos`}</LabelChip>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {allRoles.map((role) => (
              <div key={role.id} className="rounded-md border border-border bg-muted/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {roleLabel(role.slug, role.name)}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                      {role.slug}
                    </div>
                  </div>
                  <Badge
                    variant={ROLE_BADGE[role.slug] ?? 'secondary'}
                    appearance="light"
                    size="sm"
                    className="shrink-0"
                  >
                    {formatPermissionCount(role.permissionCount)}
                  </Badge>
                </div>
                {role.description && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {roleDescription(role.slug, role.description)}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function roleLabel(slug: string, fallback: string) {
  const labels: Record<string, string> = {
    owner: 'Proprietário',
    analyst: 'Analista',
    tenant_admin: 'Administrador',
    operations_lead: 'Líder de operações',
    compliance_officer: 'Compliance',
    viewer: 'Leitura',
  }

  return labels[slug] ?? fallback
}

function roleDescription(slug: string, fallback: string) {
  const descriptions: Record<string, string> = {
    owner: 'Acesso completo à operação, dados, integrações e administração do tenant.',
    analyst: 'Acesso de leitura e análise para radar, devedores, integrações e mesa operacional.',
  }

  return descriptions[slug] ?? fallback
}

function formatPermissionCount(value?: string | number) {
  const count = Number(value ?? 0)
  return `${count} perm.`
}
