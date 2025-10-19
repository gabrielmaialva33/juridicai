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
} from 'recharts'
import { useTheme } from 'next-themes'

interface DeadlinesChartProps {
  data?: {
    categories: string[]
    values: number[]
  }
}

const defaultData = {
  categories: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  values: [12, 8, 15, 10, 6, 3, 2],
}

export function DeadlinesChart({ data = defaultData }: DeadlinesChartProps) {
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  // Transform data to format Recharts expects
  const chartData = data.categories.map((category, index) => ({
    day: category,
    prazos: data.values[index],
  }))

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <div className="min-w-0 flex-1">
            <CardTitle>Prazos da Semana</CardTitle>
            <CardDescription className="line-clamp-2">
              Distribuição de prazos nos próximos 7 dias
            </CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={isDark ? '#374151' : '#E5E7EB'}
              vertical={false}
            />
            <XAxis
              dataKey="day"
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
              formatter={(value: number) => [`${value} prazos`, 'Prazos']}
            />
            <Line
              type="monotone"
              dataKey="prazos"
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
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
