import { Link } from '@inertiajs/react'
import { Search } from 'lucide-react'
import { Logo } from '@/components/layout/common/logo'
import { MENU_SIDEBAR } from '@/config/menu'
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuLabel,
  AccordionMenuItem,
  AccordionMenuSub,
  AccordionMenuSubTrigger,
  AccordionMenuSubContent,
} from '@/components/ui/accordion-menu'
import { cn } from '@/lib/utils'

interface Demo6SidebarProps {
  currentPath?: string
}

export function Demo6Sidebar({ currentPath = '/dashboard' }: Demo6SidebarProps) {
  const matchPath = (path: string) => {
    if (!path) return false
    return currentPath === path || currentPath.startsWith(path + '/')
  }

  return (
    <aside className="fixed lg:flex flex-col w-[270px] top-0 bottom-0 z-20 bg-card border-r border-border hidden">
      {/* Sidebar Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3 px-5 h-[70px]">
          <Logo size="md" showText={true} />
        </div>

        {/* Search Bar */}
        <div className="px-5 pb-5 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar processos, clientes..."
              className="w-full h-10 pl-10 pr-20 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              ⌘ /
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar Menu */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        <AccordionMenu
          type="multiple"
          selectedValue={currentPath}
          matchPath={matchPath}
          classNames={{
            root: 'flex flex-col gap-0.5',
            label: 'px-0 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide',
            item: cn(
              'hover:bg-accent hover:text-accent-foreground',
              'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground',
              'data-[selected=true]:font-medium'
            ),
            subTrigger: cn(
              'hover:bg-accent hover:text-accent-foreground',
              'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground'
            ),
            subContent: 'pl-4 pt-1 pb-2',
          }}
        >
          <AccordionMenuGroup>
            {MENU_SIDEBAR.map((item, index) => {
              // Render heading
              if (item.heading) {
                return <AccordionMenuLabel key={index}>{item.heading}</AccordionMenuLabel>
              }

              // Render item with children (accordion)
              if (item.children && item.children.length > 0) {
                return (
                  <AccordionMenuSub key={index} value={`item-${index}`}>
                    <AccordionMenuSubTrigger>
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <span>{item.title}</span>
                    </AccordionMenuSubTrigger>
                    <AccordionMenuSubContent>
                      <div className="flex flex-col gap-0.5">
                        {item.children.map((child, childIndex) => (
                          <Link
                            key={childIndex}
                            href={child.path || '#'}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                              'hover:bg-accent hover:text-accent-foreground',
                              matchPath(child.path || '')
                                ? 'bg-primary text-primary-foreground font-medium'
                                : ''
                            )}
                          >
                            <span>{child.title}</span>
                          </Link>
                        ))}
                      </div>
                    </AccordionMenuSubContent>
                  </AccordionMenuSub>
                )
              }

              // Render simple item
              if (item.path) {
                return (
                  <Link key={index} href={item.path}>
                    <AccordionMenuItem value={item.path}>
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <span>{item.title}</span>
                    </AccordionMenuItem>
                  </Link>
                )
              }

              return null
            })}
          </AccordionMenuGroup>
        </AccordionMenu>
      </div>

      {/* Sidebar Footer */}
      <div className="shrink-0 px-5 py-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <p className="font-medium">JuridicAI v1.0</p>
          <p className="mt-1">Sistema de Gestão Jurídica</p>
        </div>
      </div>
    </aside>
  )
}
