import { useState, useEffect, useCallback } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { Menu, Search } from 'lucide-react'
import { Logo } from '@/components/layout/common/logo'
import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'
import { MENU_SIDEBAR, MenuItem, MenuConfig } from '@/config/menu'
import { useIsMobile } from '@/hooks/use_media_query'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
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

/**
 * Demo1 Header Component
 *
 * Fixed header with:
 * - Mobile: Logo + Sheet menu trigger
 * - Desktop: Search, Notifications, User menu
 * - Responsive design
 * - Professional styling
 */
export function Demo1Header() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const isMobile = useIsMobile()
  const { url } = usePage()
  const pathname = url

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  // Match path for active state
  const matchPath = useCallback(
    (path: string): boolean => {
      if (!path) return false
      return path === pathname || (path.length > 1 && pathname.startsWith(path))
    },
    [pathname]
  )

  // Menu styling for mobile drawer
  const classNames: AccordionMenuClassNames = {
    root: 'space-y-0.5',
    group: 'gap-0.5',
    label: 'uppercase text-[11px] font-semibold text-muted-foreground/70 px-3 py-2 mt-4 first:mt-0',
    item: 'mx-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subTrigger:
      'mx-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subContent: 'mt-1 mb-2',
    indicator: 'text-muted-foreground/50',
  }

  // Build menu for mobile drawer
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
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] z-10 h-[60px] bg-background border-b border-border flex items-center justify-between px-5 lg:px-7.5">
      {/* Left Side - Mobile Logo + Menu Trigger */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <>
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="h-[60px] flex items-center justify-between px-5 border-b border-border">
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                  <Logo size="md" showText />
                </SheetHeader>
                <SheetBody className="p-0">
                  <ScrollArea className="h-[calc(100vh-60px)] py-4">
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
                </SheetBody>
              </SheetContent>
            </Sheet>
            <Logo size="sm" showText />
          </>
        )}
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-2">
        {/* Search Button - Desktop only */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>
        )}

        {/* Notifications */}
        <Notifications />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  )
}
