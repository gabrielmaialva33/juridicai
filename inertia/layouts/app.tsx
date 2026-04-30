import { ReactNode } from 'react'
import { Form, Link } from '@adonisjs/inertia/react'
import { usePage } from '@inertiajs/react'
import { Data } from '@generated/data'
import { LayoutDashboard, FileSearch, Users, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NavItem = { label: string; href: string; icon: ReactNode }

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="size-4" /> },
  { label: 'Precatórios', href: '/precatorios', icon: <FileSearch className="size-4" /> },
  { label: 'Devedores', href: '/debtors', icon: <Users className="size-4" /> },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const page = usePage<Data.SharedProps>()
  const user = page.props.user
  const url = page.url

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r bg-card">
        <div className="h-16 px-6 flex items-center font-semibold tracking-tight">
          JuridicAI
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                url === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <h1 className="text-sm font-medium text-muted-foreground">Radar Federal</h1>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-8">
                    <AvatarFallback>{user.initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user.initials}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/account">Conta</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Form route="auth.logout" className="w-full">
                    <button type="submit" className="flex w-full items-center gap-2">
                      <LogOut className="size-4" /> Sair
                    </button>
                  </Form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/signup">Cadastrar</Link>
              </Button>
            </div>
          )}
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
