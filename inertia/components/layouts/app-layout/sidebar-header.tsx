import { Link } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useLayout } from './context'

interface Props {
  isExpanded: boolean
}

export function SidebarHeader({ isExpanded }: Props) {
  const { sidebarCollapse, toggleSidebarCollapse } = useLayout()

  return (
    <div
      className={cn(
        'hidden lg:flex items-center shrink-0 h-[64px] border-b border-border group/header',
        isExpanded ? 'justify-between px-4 lg:px-5' : 'justify-center px-2'
      )}
    >
      <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center size-8 rounded-md bg-primary text-primary-foreground shrink-0">
          <Scale className="size-4" />
        </div>
        {isExpanded && (
          <span className="text-sm font-semibold tracking-tight truncate">JuridicAI</span>
        )}
      </Link>
      {isExpanded && (
        <Button
          onClick={toggleSidebarCollapse}
          size="sm"
          mode="icon"
          variant="ghost"
          className="size-7 opacity-0 group-hover/header:opacity-100 transition-opacity"
          aria-label={sidebarCollapse ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {sidebarCollapse ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      )}
    </div>
  )
}
