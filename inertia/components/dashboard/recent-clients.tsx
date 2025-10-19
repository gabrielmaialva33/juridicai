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
import { ArrowRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Client {
  id: number
  name: string
  email: string
  cpf_cnpj: string
  type: 'PF' | 'PJ'
  created_at: string
  cases_count: number
}

interface RecentClientsProps {
  clients?: Client[]
}

const defaultClients: Client[] = [
  {
    id: 1,
    name: 'João Silva Santos',
    email: 'joao.silva@email.com',
    cpf_cnpj: '123.456.789-00',
    type: 'PF',
    created_at: '2025-01-15',
    cases_count: 3,
  },
  {
    id: 2,
    name: 'TechCorp Ltda',
    email: 'contato@techcorp.com',
    cpf_cnpj: '12.345.678/0001-90',
    type: 'PJ',
    created_at: '2025-01-14',
    cases_count: 7,
  },
  {
    id: 3,
    name: 'Maria Oliveira Costa',
    email: 'maria.costa@email.com',
    cpf_cnpj: '987.654.321-00',
    type: 'PF',
    created_at: '2025-01-12',
    cases_count: 2,
  },
  {
    id: 4,
    name: 'Construtora ABC S/A',
    email: 'juridico@abc.com.br',
    cpf_cnpj: '98.765.432/0001-10',
    type: 'PJ',
    created_at: '2025-01-10',
    cases_count: 12,
  },
  {
    id: 5,
    name: 'Pedro Henrique Alves',
    email: 'pedro.alves@email.com',
    cpf_cnpj: '456.789.123-00',
    type: 'PF',
    created_at: '2025-01-08',
    cases_count: 1,
  },
]

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `Há ${diffDays} dias`
  if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function RecentClients({ clients = defaultClients }: RecentClientsProps) {
  return (
    <Card>
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
          {clients.map((client, index) => (
            <div key={client.id} className={cn("p-5 bg-gradient-to-r from-primary/8 via-primary/5 to-primary/3 backdrop-blur-xl hover:from-primary/12 hover:via-primary/8 hover:to-primary/5 hover:backdrop-blur-2xl transition-all duration-300 ease-out", {
              "rounded-t-xl": index === 0,
              "rounded-b-xl": index === clients.length - 1
            })}>
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
                        {client.name}
                      </Link>
                      <Badge
                        variant={client.type === 'PF' ? 'primary' : 'secondary'}
                        appearance="light"
                        size="xs"
                        className="shrink-0"
                      >
                        {client.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-2">{client.email}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{client.cpf_cnpj}</span>
                      <span>•</span>
                      <span>
                        {client.cases_count} {client.cases_count === 1 ? 'processo' : 'processos'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(client.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
