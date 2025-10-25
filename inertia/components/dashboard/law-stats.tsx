import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  Clock,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardStats } from '@/hooks/use-dashboard'

interface StatItem {
  title: string
  value: string | number
  change: number
  changeLabel: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}

export function LawStats() {
  const { data: stats, isLoading, error } = useDashboardStats()

  if (error) {
    return (
      <Card className="bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 backdrop-blur-2xl shadow-2xl shadow-destructive/20 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">Erro ao carregar estatísticas</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !stats) {
    return (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statItems: StatItem[] = [
    {
      title: 'Total de Clientes',
      value: stats.total_clients.toLocaleString('pt-BR'),
      change: 0, // Backend can provide this in the future
      changeLabel: 'total cadastrado',
      icon: Users,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Processos Ativos',
      value: stats.active_cases.toLocaleString('pt-BR'),
      change: 0,
      changeLabel: `de ${stats.total_cases} total`,
      icon: Briefcase,
      iconBg: 'bg-green-100 dark:bg-green-950',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Prazos Pendentes',
      value: stats.pending_deadlines.toLocaleString('pt-BR'),
      change: stats.overdue_deadlines > 0 ? -100 : 0,
      changeLabel:
        stats.overdue_deadlines > 0 ? `${stats.overdue_deadlines} atrasado(s)` : 'em dia',
      icon: Clock,
      iconBg: 'bg-yellow-100 dark:bg-yellow-950',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      title: 'Documentos',
      value: stats.total_documents.toLocaleString('pt-BR'),
      change: 0,
      changeLabel: 'total cadastrado',
      icon: FileText,
      iconBg: 'bg-purple-100 dark:bg-purple-950',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ]

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat, index) => {
        const Icon = stat.icon
        const isPositive = stat.change >= 0
        const TrendIcon = isPositive ? TrendingUp : TrendingDown

        return (
          <Card
            key={index}
            variant="default"
            className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {stat.title}
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold mt-2 tabular-nums">
                    {stat.value}
                  </CardTitle>

                  <div className="flex items-center gap-2 mt-3">
                    <Badge
                      variant={isPositive ? 'success' : 'destructive'}
                      appearance="light"
                      size="sm"
                      className="gap-1 px-2 py-0.5"
                    >
                      <TrendIcon className="w-3 h-3" />
                      <span className="text-[11px] font-semibold">{Math.abs(stat.change)}%</span>
                    </Badge>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {stat.changeLabel}
                    </span>
                  </div>
                </div>

                <div className={cn('rounded-xl p-3 shrink-0', stat.iconBg)}>
                  <Icon className={cn('w-6 h-6', stat.iconColor)} strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
