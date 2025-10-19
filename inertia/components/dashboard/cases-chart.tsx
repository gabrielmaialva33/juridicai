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

interface CasesChartProps {
  data?: {
    months: string[]
    newCases: number[]
    closedCases: number[]
  }
}

const defaultData = {
  months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  newCases: [28, 35, 42, 38, 45, 52, 48, 55, 60, 58, 65, 70],
  closedCases: [20, 28, 32, 30, 38, 42, 40, 45, 50, 48, 55, 58],
}

export function CasesChart({ data = defaultData }: CasesChartProps) {
  const { resolvedTheme } = useTheme()
  const [period, setPeriod] = useState('12m')

  const isDark = resolvedTheme === 'dark'

  // Transform data to format Recharts expects
  const chartData = data.months.map((month, index) => ({
    month,
    'Novos Processos': data.newCases[index],
    'Processos Finalizados': data.closedCases[index],
  }))

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <div className="min-w-0 flex-1">
            <CardTitle>Processos</CardTitle>
            <CardDescription className="line-clamp-2">
              Abertura e finalização de processos ao longo do tempo
            </CardDescription>
          </div>
        </CardHeading>
        <CardToolbar className="flex-shrink-0">
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
        <ResponsiveContainer width="100%" height={350}>
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
              dataKey="month"
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
              dataKey="Novos Processos"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorNewCases)"
            />
            <Area
              type="monotone"
              dataKey="Processos Finalizados"
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
