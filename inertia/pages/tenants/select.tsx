import { Head, router } from '@inertiajs/react'
import { ArrowRight, Building2, LogOut, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fmtRelative } from '~/lib/helpers'

type RawMembership = {
  id: string
  tenantId: string
  status: string
  createdAt?: string
  tenant?: { id: string; name: string; slug: string }
}

type Props = {
  memberships: RawMembership[]
}

export default function TenantsSelect({ memberships }: Props) {
  const handleSelect = (tenantId: string) => {
    router.post('/tenants/select', { tenant_id: tenantId })
  }

  const handleLogout = () => {
    router.post('/logout')
  }

  return (
    <>
      <Head title="Selecionar organização" />
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-md bg-primary text-primary-foreground">
                <Scale className="size-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">JuridicAI</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="me-1 size-3.5" />
              Sair
            </Button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Selecione a organização</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha qual tenant usar para esta sessão.
              </p>
            </div>

            {memberships.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <Building2 className="size-12 text-muted-foreground mx-auto" />
                  <h3 className="text-base font-medium">Sem organizações ativas</h3>
                  <p className="text-sm text-muted-foreground">
                    Sua conta ainda não tem acesso a nenhuma organização. Solicite o convite ao
                    administrador.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {memberships.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m.tenantId)}
                    className="text-start group"
                  >
                    <Card className="hover:border-primary hover:shadow-sm transition-all">
                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center size-10 rounded-md bg-primary/10 text-primary shrink-0">
                            <Building2 className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {m.tenant?.name ?? m.tenantId}
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {m.tenant?.slug && <span>/{m.tenant.slug}</span>}
                              {m.createdAt && (
                                <span className="ms-2">
                                  Membro desde {fmtRelative(m.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all shrink-0" />
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
