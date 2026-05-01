import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, User, UserRound } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  const { theme, setTheme } = useTheme()

  const handleLogout = () => router.post('/logout')

  return (
    <div className="border-t border-white/10 px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start text-white transition-colors hover:bg-white/10',
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
                  <div className="truncate text-xs text-white/55">{user.email}</div>
                </div>
                <ChevronsUpDown className="size-3.5 shrink-0 text-white/55" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-1 w-72">
          {user && (
            <>
              <DropdownMenuLabel className="p-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {getInitials(user.fullName, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {user.fullName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserRound className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <Sun className="mr-2 h-4 w-4" />
              Claro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon className="mr-2 h-4 w-4" />
              Escuro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor className="mr-2 h-4 w-4" />
              Sistema
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
