import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTheme } from 'next-themes'
import { Loader2, AlertCircle } from 'lucide-react'
import { useDeadlinesChart } from '@/hooks/use-dashboard'

export function DeadlinesChart() {
  const { resolvedTheme } = useTheme()
  const { data, isLoading, error } = useDeadlinesChart()

  const isDark = resolvedTheme === 'dark'

  if (error) {
    return (
      <Card className="bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 backdrop-blur-2xl shadow-2xl shadow-destructive/20 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">Erro ao carregar gráfico de prazos</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Transform API data to format Recharts expects
  const chartData = data.map((point) => ({
    week: point.week,
    Pendentes: point.pending,
    Concluídos: point.completed,
    Atrasados: point.overdue,
  }))

  return (
    <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
      <CardHeader className="py-4">
        <CardHeading className="min-w-0 flex-1">
          <div className="min-w-0">
            <CardTitle className="mb-1">Prazos da Semana</CardTitle>
            <CardDescription className="hidden sm:block">
              Distribuição de prazos nos próximos 7 dias
            </CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={377}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={isDark ? '#374151' : '#E5E7EB'}
              vertical={false}
            />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12 }}
              tickFormatter={(value) => Math.round(value).toString()}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: '8px',
                fontSize: '12px',
                color: isDark ? '#D1D5DB' : '#374151',
              }}
              formatter={(value: number) => `${value} prazo(s)`}
            />
            <Legend
              wrapperStyle={{
                fontSize: '12px',
                color: isDark ? '#D1D5DB' : '#374151',
              }}
            />
            <Line
              type="monotone"
              dataKey="Pendentes"
              stroke="#F59E0B"
              strokeWidth={3}
              dot={{
                fill: '#F59E0B',
                stroke: isDark ? '#1F2937' : '#FFFFFF',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                r: 6,
                fill: '#F59E0B',
                stroke: isDark ? '#1F2937' : '#FFFFFF',
                strokeWidth: 2,
              }}
            />
            <Line
              type="monotone"
              dataKey="Concluídos"
              stroke="#10B981"
              strokeWidth={3}
              dot={{
                fill: '#10B981',
                stroke: isDark ? '#1F2937' : '#FFFFFF',
                strokeWidth: 2,
                r: 4,
              }}
            />
            <Line
              type="monotone"
              dataKey="Atrasados"
              stroke="#EF4444"
              strokeWidth={3}
              dot={{
                fill: '#EF4444',
                stroke: isDark ? '#1F2937' : '#FFFFFF',
                strokeWidth: 2,
                r: 4,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
