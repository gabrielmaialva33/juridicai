import { router, usePage } from '@inertiajs/react'
import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export function UserMenu() {
  const { user } = usePage<Data.SharedProps>().props

  const handleLogout = () => {
    router.post('/logout')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-accent">
          <div className="flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {user ? getInitials(user.fullName, 2) : <User className="size-4" />}
          </div>
          {user && (
            <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[140px] truncate">
              {user.fullName}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
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
  )
}
