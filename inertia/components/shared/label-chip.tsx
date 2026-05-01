import { cn } from '~/lib/utils'

const variants = {
  default: 'bg-muted text-secondary-foreground',
  primary: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success-accent)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info-accent)]',
  warning: 'bg-[var(--color-warning-soft)] text-amber-700 dark:text-yellow-300',
  danger: 'bg-[var(--color-destructive-soft)] text-[var(--color-destructive-accent)]',
}

export function LabelChip({
  children,
  variant = 'default',
  className,
}: {
  children: string
  variant?: keyof typeof variants
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-none items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium leading-none',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
