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
        'flex h-[64px] shrink-0 items-center border-b border-white/10 group/header',
        isExpanded ? 'justify-between px-4 lg:px-5' : 'justify-center px-2'
      )}
    >
      <Link href="/operations/desk" className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center size-8 rounded-md bg-primary text-primary-foreground shrink-0">
          <Scale className="size-4" />
        </div>
        {isExpanded && (
          <span className="truncate text-sm font-semibold tracking-tight text-white">
            JuridicAI
          </span>
        )}
      </Link>
      {isExpanded && (
        <Button
          onClick={toggleSidebarCollapse}
          size="sm"
          mode="icon"
          variant="ghost"
          className="size-7 text-white/70 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover/header:opacity-100"
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
