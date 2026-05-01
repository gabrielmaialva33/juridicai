import { Head } from '@inertiajs/react'
import { CalendarDays, Fingerprint, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { LabelChip } from '~/components/shared/label-chip'
import { PageHeader } from '~/components/shared/page-header'
import { fmtDate, fmtRelative } from '~/lib/helpers'

type Role = {
  id: string
  name: string
  slug: string
}

type Profile = {
  user: {
    id: string
    fullName: string | null
    email: string
    initials: string
    status: string
    createdAt: string
    updatedAt: string
  }
  membership?: {
    id: string
    status: string
    createdAt: string
    tenantName: string
    slug: string
  } | null
  roles: Role[]
}

export default function ProfileShow({ profile }: { profile: Profile }) {
  const displayName = profile.user.fullName ?? profile.user.email

  return (
    <>
      <Head title="Perfil" />

      <PageHeader
        title="Perfil"
        description="Conta, organização ativa e permissões operacionais."
        breadcrumbs={[{ label: 'Perfil' }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 lg:self-start">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
                {profile.user.initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{displayName}</h2>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5" />
                  <span className="truncate">{profile.user.email}</span>
                </div>
                <div className="mt-3">
                  <LabelChip variant={profile.user.status === 'active' ? 'success' : 'warning'}>
                    {profile.user.status === 'active' ? 'Ativo' : profile.user.status}
                  </LabelChip>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              Organização ativa
            </h2>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ProfileField
              icon={<UserRound className="size-4" />}
              label="Organização"
              value={profile.membership?.tenantName ?? '—'}
              hint={profile.membership?.slug}
            />
            <ProfileField
              icon={<ShieldCheck className="size-4" />}
              label="Status no tenant"
              value={statusLabel(profile.membership?.status)}
            />
            <ProfileField
              icon={<CalendarDays className="size-4" />}
              label="Membro desde"
              value={profile.membership?.createdAt ? fmtDate(profile.membership.createdAt) : '—'}
            />
            <ProfileField
              icon={<Fingerprint className="size-4" />}
              label="ID da conta"
              value={profile.user.id.slice(0, 12)}
              hint={`Atualizado ${fmtRelative(profile.user.updatedAt)}`}
              mono
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-base font-semibold">Papéis e acesso</h2>
          </CardHeader>
          <CardContent>
            {profile.roles.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nenhum papel atribuído no tenant ativo.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.roles.map((role) => (
                  <LabelChip key={role.id} variant="primary">
                    {role.name}
                  </LabelChip>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function statusLabel(status?: string | null) {
  if (!status) return '—'

  const labels: Record<string, string> = {
    active: 'Ativo',
    inactive: 'Inativo',
    suspended: 'Suspenso',
  }

  return labels[status] ?? status
}

function ProfileField({
  icon,
  label,
  value,
  hint,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string | null
  mono?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
