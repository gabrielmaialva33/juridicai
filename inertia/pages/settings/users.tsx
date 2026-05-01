import { Head } from '@inertiajs/react'
import { ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { getInitials } from '~/lib/helpers'
import { fmtRelative } from '~/lib/helpers'

type Role = { id: string; name: string; slug: string }

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
                                {r.name}
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

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Papéis disponíveis</h3>
            </div>
            <ul className="space-y-2">
              {allRoles.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <Badge variant={ROLE_BADGE[r.slug] ?? 'secondary'} appearance="light" size="sm">
                    {r.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono truncate">{r.slug}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border">
              Edição de papéis e convites virão na próxima iteração. Por enquanto, ajuste via
              seeders ou banco diretamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
