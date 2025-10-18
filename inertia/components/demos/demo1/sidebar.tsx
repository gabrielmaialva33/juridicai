import { useCallback } from 'react'
import { Link, usePage } from '@inertiajs/react'
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

/**
 * Demo1 Sidebar Component
 *
 * Fixed left sidebar with:
 * - Logo header
 * - Accordion navigation menu
 * - Smooth animations
 * - Active state highlighting
 */
export function Demo1Sidebar() {
  const { url } = usePage()
  const pathname = url

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
    label: 'uppercase text-[11px] font-semibold text-muted-foreground/70 px-3 py-2 mt-4 first:mt-0',
    item: 'mx-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subTrigger:
      'mx-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold',
    subContent: 'mt-1 mb-2',
    indicator: 'text-muted-foreground/50',
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
    <aside className="fixed left-0 top-0 bottom-0 z-20 w-[260px] bg-background border-r border-border flex flex-col">
      {/* Sidebar Header with Logo */}
      <div className="h-[60px] flex items-center justify-between px-5 border-b border-border shrink-0">
        <Logo size="md" showText />
      </div>

      {/* Scrollable Menu Area */}
      <ScrollArea className="flex-1 py-4">
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
    </aside>
  )
}
