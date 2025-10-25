import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardDescription,
  CardToolbar,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTheme } from 'next-themes'
import { Loader2, AlertCircle } from 'lucide-react'
import { useCasesChart } from '@/hooks/use-dashboard'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function CasesChart() {
  const { resolvedTheme } = useTheme()
  const [period, setPeriod] = useState('12m')
  const { data, isLoading, error } = useCasesChart()

  const isDark = resolvedTheme === 'dark'

  if (error) {
    return (
      <Card className="bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 backdrop-blur-2xl shadow-2xl shadow-destructive/20 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">Erro ao carregar gráfico de processos</p>
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
    'date': format(new Date(point.date), 'dd/MMM', { locale: ptBR }),
    'Processos Ativos': point.active,
    'Processos Encerrados': point.closed,
    'Total': point.total,
  }))

  return (
    <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 backdrop-blur-2xl shadow-2xl shadow-primary/20 border-primary/30">
      <CardHeader className="py-4">
        <CardHeading className="min-w-0 flex-1">
          <div className="min-w-0">
            <CardTitle className="mb-1">Processos</CardTitle>
            <CardDescription className="hidden sm:block">
              Abertura e finalização de processos ao longo do tempo
            </CardDescription>
          </div>
        </CardHeading>
        <CardToolbar className="shrink-0">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]" size="sm">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </CardToolbar>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={377}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNewCases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorClosedCases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={isDark ? '#374151' : '#E5E7EB'}
              vertical={false}
            />
            <XAxis
              dataKey="date"
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
              formatter={(value: number) => `${value} processos`}
            />
            <Legend
              wrapperStyle={{
                fontSize: '12px',
                color: isDark ? '#D1D5DB' : '#374151',
              }}
            />
            <Area
              type="monotone"
              dataKey="Processos Ativos"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorNewCases)"
            />
            <Area
              type="monotone"
              dataKey="Processos Encerrados"
              stroke="#10B981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorClosedCases)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
