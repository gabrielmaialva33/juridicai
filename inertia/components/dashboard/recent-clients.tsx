import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardDescription,
  CardToolbar,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@inertiajs/react'
import { ArrowRight, User, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRecentClients } from '@/hooks/use-dashboard'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function RecentClients() {
  const { data: clients, isLoading, error } = useRecentClients()

  if (error) {
    return (
      <Card className="bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 backdrop-blur-2xl shadow-2xl shadow-destructive/20 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">Erro ao carregar clientes recentes</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !clients) {
    return (
      <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (clients.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
        <CardContent className="p-8 text-center">
          <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda</p>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (dateString: string): string => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: ptBR,
    })
  }

  return (
    <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
      <CardHeader className="py-4">
        <CardHeading>
          <div>
            <CardTitle className="mb-1">Clientes Recentes</CardTitle>
            <CardDescription>Últimos clientes adicionados ao sistema</CardDescription>
          </div>
        </CardHeading>
        <CardToolbar>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clients">
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-0">
          {clients.map((client, index) => {
            const displayName = client.full_name || client.company_name || 'Cliente sem nome'
            const clientType = client.client_type === 'individual' ? 'PF' : 'PJ'

            return (
              <div
                key={client.id}
                className={cn(
                  'p-5 bg-gradient-to-r from-primary/8 via-primary/5 to-primary/3 backdrop-blur-xl hover:from-primary/12 hover:via-primary/8 hover:to-primary/5 hover:backdrop-blur-2xl transition-all duration-300 ease-out',
                  {
                    'rounded-t-xl': index === 0,
                    'rounded-b-xl': index === clients.length - 1,
                  }
                )}
              >
                <div className="flex items-start justify-between gap-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate"
                        >
                          {displayName}
                        </Link>
                        <Badge
                          variant={clientType === 'PF' ? 'primary' : 'secondary'}
                          appearance="light"
                          size="xs"
                          className="shrink-0"
                        >
                          {clientType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-2">{client.email}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {client.phone && <span>{client.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDate(client.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
