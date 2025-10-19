import { useState, useEffect, useCallback } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { Menu, Search, ChevronRight } from 'lucide-react'
import { Logo } from '@/components/layout/common/logo'
import { Notifications } from '@/components/layout/common/notifications'
import { MENU_SIDEBAR, MenuItem, MenuConfig } from '@/config/menu'
import { useIsMobile } from '@/hooks/use_media_query'
import { Button } from '@/components/ui/button'
import { getBreadcrumbs } from '@/lib/breadcrumbs'
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
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

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
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] z-10 h-[60px] bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm flex items-center gap-4 px-4 sm:px-5 lg:px-6 overflow-hidden">
      {/* Left Side - Mobile Logo + Menu Trigger OR Desktop Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
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

        {/* Desktop Breadcrumbs */}
        {!isMobile && (
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
              {getBreadcrumbs(pathname).map((breadcrumb, index, array) => {
                const Icon = breadcrumb.icon
                const isLast = index === array.length - 1

                return (
                  <div key={index} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="truncate max-w-[200px] flex items-center gap-1.5">
                          {Icon && <Icon className="h-4 w-4" />}
                          {breadcrumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={breadcrumb.href}
                          className="flex items-center gap-1.5"
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          {breadcrumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      {/* Center - Search Input */}
      {!isMobile && (
        <div className="flex-1 flex justify-center max-w-2xl mx-auto">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      {/* Right Side - Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notifications */}
        <Notifications />
      </div>
    </header>
  )
}
