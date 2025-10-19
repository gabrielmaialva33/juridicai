import { useCallback } from 'react'
import { Link, usePage, router } from '@inertiajs/react'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { Logo } from '@/components/layout/common/logo'
import { MENU_SIDEBAR, MenuItem, MenuConfig } from '@/config/menu'
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
  AccordionMenuClassNames,
} from '@/components/ui/accordion-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Demo1 Sidebar Component
 *
 * Fixed left sidebar with:
 * - Logo header
 * - Accordion navigation menu
 * - User profile footer
 * - Smooth animations
 * - Active state highlighting
 */
export function Demo1Sidebar() {
  const { url } = usePage()
  const pathname = url

  // Mock user data - TODO: Get from auth context
  const userName = 'Gabriel Maia'
  const userEmail = 'gabriel@juridicai.com'
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = () => {
    router.post('/logout')
  }

  // Check if path matches current route
  const matchPath = useCallback(
    (path: string): boolean => {
      if (!path) return false
      return path === pathname || (path.length > 1 && pathname.startsWith(path))
    },
    [pathname]
  )

  // Consistent styling for menu items
  const classNames: AccordionMenuClassNames = {
    root: 'space-y-0.5',
    group: 'gap-0.5',
    label:
      'uppercase text-[11px] font-semibold text-muted-foreground/80 px-3 py-1.5 mt-3 first:mt-0',
    item: 'mx-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subTrigger:
      'mx-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subContent: 'mt-0.5 mb-1',
    indicator: 'text-muted-foreground/60',
  }

  // Build menu recursively
  const buildMenu = (items: MenuConfig): JSX.Element[] => {
    return items.map((item: MenuItem, index: number) => {
      if (item.heading) {
        return <AccordionMenuLabel key={`heading-${index}`}>{item.heading}</AccordionMenuLabel>
      }

      if (item.children) {
        return (
          <AccordionMenuSub
            key={item.path || `parent-${index}`}
            value={item.path || `parent-${index}`}
          >
            <AccordionMenuSubTrigger>
              {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
              <span className="flex-1">{item.title}</span>
            </AccordionMenuSubTrigger>
            <AccordionMenuSubContent type="single" collapsible className="pl-4">
              <AccordionMenuGroup>
                {item.children.map((child, childIndex) => (
                  <AccordionMenuItem
                    key={child.path || `child-${childIndex}`}
                    value={child.path || ''}
                    className="text-[13px]"
                  >
                    <Link
                      href={child.path || '#'}
                      className="flex items-center gap-2 w-full px-3 py-1.5"
                    >
                      {child.title}
                    </Link>
                  </AccordionMenuItem>
                ))}
              </AccordionMenuGroup>
            </AccordionMenuSubContent>
          </AccordionMenuSub>
        )
      }

      return (
        <AccordionMenuItem key={item.path || `item-${index}`} value={item.path || ''}>
          <Link href={item.path || '#'} className="flex items-center gap-3 w-full">
            {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
            <span className="flex-1">{item.title}</span>
          </Link>
        </AccordionMenuItem>
      )
    })
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-20 w-[260px] bg-background border-r border-border/50 shadow-lg flex flex-col">
      {/* Sidebar Header with Logo */}
      <div className="h-[60px] flex items-center justify-between px-4 border-b border-border/50 bg-muted/30 shrink-0">
        <Logo size="md" showText />
      </div>

      {/* Scrollable Menu Area */}
      <ScrollArea className="flex-1 py-3">
        <AccordionMenu
          type="single"
          collapsible
          selectedValue={pathname}
          matchPath={matchPath}
          classNames={classNames}
        >
          {buildMenu(MENU_SIDEBAR)}
        </AccordionMenu>
      </ScrollArea>

      {/* User Profile Footer */}
      <div className="border-t border-border/50 p-3 bg-muted/30 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <Settings className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" side="top">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <UserIcon className="h-4 w-4 mr-2" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
