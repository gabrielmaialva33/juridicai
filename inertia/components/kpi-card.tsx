import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}

export function KpiCard({ label, value, hint, className }: Props) {
  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums leading-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}
