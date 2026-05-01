import { InboxIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  message: string
  description?: string
  children?: ReactNode
}

export function EmptyState({ icon, message, description, children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground mb-3">
        {icon || <InboxIcon className="h-12 w-12" />}
      </div>
      <h3 className="text-base font-medium">{message}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
