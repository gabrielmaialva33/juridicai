import { router, usePage } from '@inertiajs/react'
import { ChevronsUpDown, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getInitials } from '@/lib/helpers'
import { Data } from '@generated/data'

interface Props {
  isExpanded: boolean
}

export function SidebarFooter({ isExpanded }: Props) {
  const { user } = usePage<Data.SharedProps>().props

  const handleLogout = () => router.post('/logout')

  return (
    <div className="border-t border-border px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start transition-colors hover:bg-accent',
              !isExpanded && 'justify-center'
            )}
            aria-label={user?.fullName ?? 'Conta'}
          >
            <div className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
              {user ? getInitials(user.fullName, 2) : <User className="size-4" />}
            </div>
            {isExpanded && user && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{user.fullName}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-60 mb-1">
          {user && (
            <>
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{user.fullName}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
