import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Users, Briefcase, Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatItem {
  title: string
  value: string | number
  change: number
  changeLabel: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}

interface LawStatsProps {
  stats?: StatItem[]
}

const defaultStats: StatItem[] = [
  {
    title: 'Total de Clientes',
    value: '1,247',
    change: 12.5,
    changeLabel: 'vs mês anterior',
    icon: Users,
    iconBg: 'bg-blue-100 dark:bg-blue-950',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Processos Ativos',
    value: '342',
    change: 8.2,
    changeLabel: 'vs mês anterior',
    icon: Briefcase,
    iconBg: 'bg-green-100 dark:bg-green-950',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    title: 'Prazos Pendentes',
    value: '28',
    change: -15.3,
    changeLabel: 'vs mês anterior',
    icon: Clock,
    iconBg: 'bg-yellow-100 dark:bg-yellow-950',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    title: 'Documentos Criados',
    value: '156',
    change: 23.1,
    changeLabel: 'este mês',
    icon: FileText,
    iconBg: 'bg-purple-100 dark:bg-purple-950',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
]

export function LawStats({ stats = defaultStats }: LawStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        const isPositive = stat.change >= 0
        const TrendIcon = isPositive ? TrendingUp : TrendingDown

        return (
          <Card key={index} variant="default">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.title}
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold mt-1.5">{stat.value}</CardTitle>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={isPositive ? 'success' : 'destructive'}
                      appearance="light"
                      size="sm"
                      className="gap-1"
                    >
                      <TrendIcon className="w-3 h-3" />
                      <span>{Math.abs(stat.change)}%</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">{stat.changeLabel}</span>
                  </div>
                </div>

                <div className={cn('rounded-lg p-2.5', stat.iconBg)}>
                  <Icon className={cn('w-5 h-5', stat.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
