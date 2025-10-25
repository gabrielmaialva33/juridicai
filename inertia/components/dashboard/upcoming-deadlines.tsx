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
import { ArrowRight, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpcomingDeadlines } from '@/hooks/use-dashboard'
import { formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusConfig = {
  pending: { label: 'Pendente', variant: 'outline' as const },
  completed: { label: 'Concluído', variant: 'success' as const },
  cancelled: { label: 'Cancelado', variant: 'secondary' as const },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)

  if (isPast(date) && !isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
  }
  if (isToday(date)) return 'Hoje'
  if (isTomorrow(date)) return 'Amanhã'

  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
}

function getUrgencyLevel(deadlineDate: string, isFatal: boolean) {
  const date = new Date(deadlineDate)

  if (isPast(date) && !isToday(date)) {
    return {
      label: 'Atrasado',
      variant: 'destructive' as const,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-950',
      icon: AlertCircle,
    }
  }

  if (isToday(date) || isTomorrow(date)) {
    return {
      label: isFatal ? 'Urgente - Fatal' : 'Urgente',
      variant: 'warning' as const,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-950',
      icon: AlertCircle,
    }
  }

  return {
    label: isFatal ? 'Fatal' : 'Normal',
    variant: 'info' as const,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-950',
    icon: Clock,
  }
}

export function UpcomingDeadlines() {
  const { data: deadlines, isLoading, error } = useUpcomingDeadlines()

  if (error) {
    return (
      <Card className="bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 backdrop-blur-2xl shadow-2xl shadow-destructive/20 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">Erro ao carregar próximos prazos</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !deadlines) {
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

  if (deadlines.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
        <CardContent className="p-8 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum prazo pendente</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
      <CardHeader className="py-4">
        <CardHeading>
          <div>
            <CardTitle className="mb-1">Próximos Prazos</CardTitle>
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
        <div className="space-y-0">
          {deadlines.map((deadline, index) => {
            const urgency = getUrgencyLevel(deadline.deadline_date, deadline.is_fatal)
            const status = statusConfig[deadline.status]
            const isLast = index === deadlines.length - 1
            const UrgencyIcon = urgency.icon

            return (
              <div
                key={deadline.id}
                className={cn(
                  'p-5 bg-gradient-to-r from-primary/8 via-primary/5 to-primary/3 backdrop-blur-xl hover:from-primary/12 hover:via-primary/8 hover:to-primary/5 hover:backdrop-blur-2xl transition-all duration-300 ease-out',
                  {
                    'rounded-t-xl': index === 0,
                    'rounded-b-xl': isLast,
                  }
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-xl p-2.5 shrink-0', urgency.bg)}>
                    <UrgencyIcon className={cn('w-5 h-5', urgency.color)} strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <Link
                        href={`/cases/${deadline.case?.id}`}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                      >
                        {deadline.title}
                      </Link>
                      <Badge
                        variant={urgency.variant}
                        appearance="light"
                        size="xs"
                        className="shrink-0"
                      >
                        {urgency.label}
                      </Badge>
                    </div>

                    {deadline.case && (
                      <p className="text-[11px] text-muted-foreground mb-2 font-mono tracking-tight">
                        {deadline.case.case_number || deadline.case.internal_number}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <Badge variant={status.variant} appearance="light" size="xs">
                        {status.label}
                      </Badge>
                      <span className="text-muted-foreground">•</span>
                      <span
                        className={cn(
                          'font-semibold',
                          urgency.variant === 'destructive'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        )}
                      >
                        {formatDate(deadline.deadline_date)}
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
