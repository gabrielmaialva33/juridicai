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
 * - Mobile: Hamburger + Logo + Notifications (Sheet drawer for menu)
 * - Desktop: Breadcrumbs + Search + Notifications
 * - Responsive design with Fibonacci spacing
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

  // Menu styling for mobile drawer - optimized for touch and visual hierarchy
  const classNames: AccordionMenuClassNames = {
    root: 'space-y-1',
    group: 'gap-1',
    label:
      'uppercase text-[10px] font-bold text-muted-foreground/70 px-4 py-3 mt-6 first:mt-3 tracking-[0.1em] border-t border-border/30 first:border-t-0',
    item: 'mx-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-foreground hover:bg-accent/80 hover:text-accent-foreground hover:scale-[1.02] transition-all duration-200 cursor-pointer data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:font-semibold data-[selected=true]:shadow-lg data-[selected=true]:scale-[1.02] active:scale-[0.97]',
    subTrigger:
      'mx-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-foreground hover:bg-accent/80 hover:text-accent-foreground hover:scale-[1.02] transition-all duration-200 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subContent: 'mt-1 mb-2 ml-2',
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
              {item.icon && <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} />}
              <span className="flex-1">{item.title}</span>
            </AccordionMenuSubTrigger>
            <AccordionMenuSubContent type="single" collapsible className="pl-4">
              <AccordionMenuGroup>
                {item.children.map((child, childIndex) => (
                  <AccordionMenuItem
                    key={child.path || `child-${childIndex}`}
                    value={child.path || ''}
                    className="text-sm"
                  >
                    <Link href={child.path || '#'} className="flex items-center gap-2 w-full px-4 py-2.5">
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
            {item.icon && <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} />}
            <span className="flex-1">{item.title}</span>
          </Link>
        </AccordionMenuItem>
      )
    })
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] z-10 h-[60px] bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm flex items-center gap-3 px-4 sm:px-5 lg:px-6">
      {/* Left Side - Mobile Hamburger + Logo OR Desktop Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0 overflow-hidden flex-1">
        {isMobile && (
          <>
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] p-0 sm:w-[360px] bg-background/95 backdrop-blur-xl shadow-2xl border-r border-border/20">
                <SheetHeader className="h-[60px] flex flex-row items-center justify-between px-5 border-b border-border/30 shrink-0 bg-background/80 backdrop-blur-sm">
                  <Logo size="md" showText />
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                </SheetHeader>
                <SheetBody className="p-0 h-[calc(100vh-140px)] bg-background/50 backdrop-blur-md flex flex-col">
                  <ScrollArea className="flex-1 py-2 bg-transparent">
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
                  <div className="border-t border-border/30 p-4 bg-background/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer active:scale-[0.98]">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md">
                        <span className="text-sm font-bold text-primary-foreground">GM</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">Gabriel Maia</p>
                        <p className="text-xs text-muted-foreground truncate">gabriel@juridicai.com</p>
                      </div>
                    </div>
                  </div>
                </SheetBody>
              </SheetContent>
            </Sheet>
            <Logo size="sm" showText className="flex-1" />
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
                        <BreadcrumbLink href={breadcrumb.href} className="flex items-center gap-1.5">
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

      {/* Center - Search Input (Desktop only) */}
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

      {/* Right Side - Notifications */}
      <div className="flex items-center gap-2 shrink-0">
        <Notifications />
      </div>
    </header>
  )
}
