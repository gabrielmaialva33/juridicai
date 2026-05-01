import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '~/lib/utils'
import type { KeyboardEvent, ReactNode } from 'react'

const ALL_VALUE = '__all'

export type FilterOption = {
  value: string
  label: string
}

export function FilterPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className="mb-4">
      <CardContent className={cn('p-4', className)}>{children}</CardContent>
    </Card>
  )
}

export function SearchFilter({
  label = 'Busca',
  value,
  placeholder,
  onChange,
  onCommit,
  className,
}: {
  label?: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  onCommit: () => void
  className?: string
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      onCommit()
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <FilterLabel>{label}</FilterLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onCommit}
          placeholder={placeholder}
          className="h-10 pl-9"
        />
      </div>
    </div>
  )
}

export function SelectFilter({
  label,
  value,
  options,
  allLabel = 'Todos',
  onChange,
  className,
}: {
  label: string
  value?: string | null
  options: FilterOption[]
  allLabel?: string
  onChange: (value: string | null) => void
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <FilterLabel>{label}</FilterLabel>
      <Select
        value={value ?? ALL_VALUE}
        onValueChange={(next) => onChange(next === ALL_VALUE ? null : next)}
      >
        <SelectTrigger className="h-10 w-full text-sm">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}
