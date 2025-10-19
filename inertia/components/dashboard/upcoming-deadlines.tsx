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
import { ArrowRight, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Deadline {
  id: number
  title: string
  case_number: string
  case_id: number
  due_date: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  responsible: string
  status: 'pending' | 'in_progress' | 'completed'
}

interface UpcomingDeadlinesProps {
  deadlines?: Deadline[]
}

const defaultDeadlines: Deadline[] = [
  {
    id: 1,
    title: 'Apresentação de Recurso',
    case_number: '0001234-56.2024.8.26.0100',
    case_id: 101,
    due_date: '2025-01-20',
    priority: 'urgent',
    responsible: 'Dr. Carlos Silva',
    status: 'pending',
  },
  {
    id: 2,
    title: 'Contestação',
    case_number: '0002345-67.2024.8.26.0200',
    case_id: 102,
    due_date: '2025-01-22',
    priority: 'high',
    responsible: 'Dra. Ana Santos',
    status: 'in_progress',
  },
  {
    id: 3,
    title: 'Perícia Técnica',
    case_number: '0003456-78.2024.8.26.0300',
    case_id: 103,
    due_date: '2025-01-25',
    priority: 'medium',
    responsible: 'Dr. João Pereira',
    status: 'pending',
  },
  {
    id: 4,
    title: 'Audiência de Instrução',
    case_number: '0004567-89.2024.8.26.0400',
    case_id: 104,
    due_date: '2025-01-28',
    priority: 'high',
    responsible: 'Dra. Maria Costa',
    status: 'pending',
  },
  {
    id: 5,
    title: 'Juntada de Documentos',
    case_number: '0005678-90.2024.8.26.0500',
    case_id: 105,
    due_date: '2025-02-02',
    priority: 'low',
    responsible: 'Dr. Pedro Alves',
    status: 'pending',
  },
]

const priorityConfig = {
  urgent: {
    label: 'Urgente',
    variant: 'destructive' as const,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950',
  },
  high: {
    label: 'Alta',
    variant: 'warning' as const,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-950',
  },
  medium: {
    label: 'Média',
    variant: 'info' as const,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-950',
  },
  low: {
    label: 'Baixa',
    variant: 'secondary' as const,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
  },
}

const statusConfig = {
  pending: { label: 'Pendente', variant: 'outline' as const },
  in_progress: { label: 'Em andamento', variant: 'info' as const },
  completed: { label: 'Concluído', variant: 'success' as const },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Amanhã'
  if (diffDays < 0) return `Atrasado ${Math.abs(diffDays)} dias`
  if (diffDays < 7) return `Em ${diffDays} dias`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function UpcomingDeadlines({ deadlines = defaultDeadlines }: UpcomingDeadlinesProps) {
  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <div>
            <CardTitle>Próximos Prazos</CardTitle>
            <CardDescription>Prazos com vencimento nos próximos dias</CardDescription>
          </div>
        </CardHeading>
        <CardToolbar>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/deadlines">
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {deadlines.map((deadline) => {
            const priority = priorityConfig[deadline.priority]
            const status = statusConfig[deadline.status]

            return (
              <div key={deadline.id} className="p-5 hover:bg-accent/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-xl p-2.5 shrink-0', priority.bg)}>
                    {deadline.priority === 'urgent' ? (
                      <AlertCircle className={cn('w-5 h-5', priority.color)} strokeWidth={2} />
                    ) : (
                      <Clock className={cn('w-5 h-5', priority.color)} strokeWidth={2} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <Link
                        href={`/cases/${deadline.case_id}`}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                      >
                        {deadline.title}
                      </Link>
                      <Badge
                        variant={priority.variant}
                        appearance="light"
                        size="xs"
                        className="shrink-0"
                      >
                        {priority.label}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground mb-2 font-mono tracking-tight">
                      {deadline.case_number}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <Badge variant={status.variant} appearance="light" size="xs">
                        {status.label}
                      </Badge>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{deadline.responsible}</span>
                      <span className="text-muted-foreground">•</span>
                      <span
                        className={cn(
                          'font-semibold',
                          deadline.priority === 'urgent'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        )}
                      >
                        {formatDate(deadline.due_date)}
                      </span>
                    </div>
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
