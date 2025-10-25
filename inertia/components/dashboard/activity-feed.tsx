import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@inertiajs/react'
import {
  FileText,
  UserPlus,
  Briefcase,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Upload,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivityFeed } from '@/hooks/use-dashboard'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ActivityType =
  | 'case_created'
  | 'deadline_added'
  | 'document_uploaded'
  | 'client_created'
  | 'event_logged'

const mockDefaultActivities = [
  {
    id: 1,
    type: 'document',
    title: 'Novo documento criado',
    description: 'Petição inicial criada para o processo 0001234-56.2024',
    user: 'Dr. Carlos Silva',
    timestamp: '2025-01-18T14:30:00',
    link: '/documents/123',
  },
  {
    id: 2,
    type: 'client',
    title: 'Cliente adicionado',
    description: 'João Silva Santos foi adicionado ao sistema',
    user: 'Dra. Ana Santos',
    timestamp: '2025-01-18T13:15:00',
    link: '/clients/1',
  },
  {
    id: 3,
    type: 'deadline',
    title: 'Prazo concluído',
    description: 'Contestação entregue no prazo para o processo 0002345-67.2024',
    user: 'Dr. João Pereira',
    timestamp: '2025-01-18T11:45:00',
    link: '/deadlines/45',
  },
  {
    id: 4,
    type: 'case',
    title: 'Novo processo cadastrado',
    description: 'Processo 0003456-78.2024 cadastrado no sistema',
    user: 'Dra. Maria Costa',
    timestamp: '2025-01-18T10:20:00',
    link: '/cases/103',
  },
  {
    id: 5,
    type: 'comment',
    title: 'Comentário adicionado',
    description: 'Nova movimentação processual registrada',
    user: 'Dr. Pedro Alves',
    timestamp: '2025-01-18T09:30:00',
    link: '/cases/101',
  },
  {
    id: 6,
    type: 'alert',
    title: 'Alerta de prazo',
    description: 'Prazo urgente vencendo em 2 dias',
    user: 'Sistema',
    timestamp: '2025-01-18T08:00:00',
    link: '/deadlines',
  },
  {
    id: 7,
    type: 'upload',
    title: 'Documentos anexados',
    description: '3 novos documentos anexados ao processo 0004567-89.2024',
    user: 'Dra. Ana Santos',
    timestamp: '2025-01-17T16:45:00',
    link: '/cases/104',
  },
  {
    id: 8,
    type: 'status',
    title: 'Status atualizado',
    description: 'Processo 0005678-90.2024 marcado como "Em análise"',
    user: 'Dr. Carlos Silva',
    timestamp: '2025-01-17T15:30:00',
    link: '/cases/105',
  },
]

const activityConfig: Record<
  ActivityType,
  {
    icon: React.ElementType
    color: string
    bg: string
  }
> = {
  case_created: {
    icon: Briefcase,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-950',
  },
  deadline_added: {
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-950',
  },
  document_uploaded: {
    icon: Upload,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-950',
  },
  client_created: {
    icon: UserPlus,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-950',
  },
  event_logged: {
    icon: MessageSquare,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-950',
  },
}

function formatTimestamp(timestamp: string): string {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: ptBR,
  })
}

export function ActivityFeed() {
  const { data: activities, isLoading, error } = useActivityFeed()

  if (error) {
    return (
      <Card className="h-full bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 backdrop-blur-2xl shadow-2xl shadow-destructive/20 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">Erro ao carregar feed de atividades</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !activities) {
    return (
      <Card className="h-full bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="h-full bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
        <CardContent className="p-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
      <CardHeader>
        <CardHeading>
          <div>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Timeline de atividades do escritório</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-0">
            {activities.map((activity, index) => {
              const config = activityConfig[activity.type]
              if (!config) {
                console.warn(`Unknown activity type: ${activity.type}`)
                return null
              }
              const Icon = config.icon
              const isLast = index === activities.length - 1

              return (
                <div
                  key={activity.id}
                  className={cn(
                    'relative px-5 py-5 bg-gradient-to-r from-primary/8 via-primary/5 to-primary/3 backdrop-blur-xl hover:from-primary/12 hover:via-primary/8 hover:to-primary/5 hover:backdrop-blur-2xl transition-all duration-300 ease-out',
                    {
                      'rounded-t-xl': index === 0,
                      'rounded-b-xl': isLast,
                    }
                  )}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-10 top-7 -translate-x-1/2">
                    <div className={cn('rounded-full p-2', config.bg)}>
                      <Icon className={cn('w-3.5 h-3.5', config.color)} strokeWidth={2} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="pl-10">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-semibold text-sm text-foreground leading-tight">
                        {activity.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatTimestamp(activity.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                      {activity.description}
                    </p>

                    {activity.user && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {activity.user.full_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
