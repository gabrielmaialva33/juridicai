import { Fragment } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MENU_SIDEBAR } from '@/config/menu.config'
import { MenuConfig, MenuItem } from '@/config/types'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  isExpanded?: boolean
}

export function SidebarMenu({ isExpanded = true }: Props) {
  const { url } = usePage()

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-3">
      {MENU_SIDEBAR.map((item, idx) => (
        <MenuNode key={`m-${idx}`} item={item} url={url} isExpanded={isExpanded} />
      ))}
    </nav>
  )
}

function isPathActive(itemPath: string | undefined, url: string): boolean {
  if (!itemPath) return false
  if (itemPath === url) return true
  if (itemPath !== '/dashboard' && url.startsWith(itemPath + '/')) return true
  return false
}

function hasActiveChild(children: MenuConfig | undefined, url: string): boolean {
  if (!children) return false
  return children.some((c) => isPathActive(c.path, url) || hasActiveChild(c.children, url))
}

function MenuNode({
  item,
  url,
  isExpanded,
  depth = 0,
}: {
  item: MenuItem
  url: string
  isExpanded: boolean
  depth?: number
}) {
  if (item.heading) {
    if (!isExpanded) return null
    return (
      <div className="px-3 pt-4 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {item.heading}
      </div>
    )
  }

  if (item.children && item.children.length > 0) {
    return <MenuGroup item={item} url={url} isExpanded={isExpanded} depth={depth} />
  }

  return <MenuLeaf item={item} url={url} isExpanded={isExpanded} depth={depth} />
}

function MenuLeaf({
  item,
  url,
  isExpanded,
  depth,
}: {
  item: MenuItem
  url: string
  isExpanded: boolean
  depth: number
}) {
  const Icon = item.icon
  const active = isPathActive(item.path, url)
  const inset = depth > 0 ? 'ps-9' : 'ps-3'

  const link = (
    <Link
      href={item.path ?? '#'}
      className={cn(
        'flex items-center gap-3 rounded-md py-2 pe-3 text-sm transition-colors',
        inset,
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      {isExpanded && <span className="truncate">{item.title}</span>}
      {isExpanded && item.badge !== undefined && (
        <span className="ms-auto inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          {item.badge}
        </span>
      )}
    </Link>
  )

  if (!isExpanded && item.title) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function MenuGroup({
  item,
  url,
  isExpanded,
  depth,
}: {
  item: MenuItem
  url: string
  isExpanded: boolean
  depth: number
}) {
  const Icon = item.icon
  const childActive = hasActiveChild(item.children, url)
  const inset = depth > 0 ? 'ps-9' : 'ps-3'

  if (!isExpanded) {
    // Collapsed mode: render group title as tooltip, items inline as leafs
    return (
      <Fragment>
        {item.children?.map((child, i) => (
          <MenuNode
            key={`${item.title}-c-${i}`}
            item={child}
            url={url}
            isExpanded={isExpanded}
            depth={depth + 1}
          />
        ))}
      </Fragment>
    )
  }

  return (
    <Collapsible defaultOpen={childActive} className="group/group">
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-3 rounded-md py-2 pe-3 text-sm transition-colors',
          inset,
          childActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className="truncate">{item.title}</span>
        <ChevronDown className="ms-auto size-3.5 shrink-0 transition-transform group-data-[state=open]/group:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-0.5 space-y-0.5">
          {item.children?.map((child, i) => (
            <MenuNode
              key={`${item.title}-c-${i}`}
              item={child}
              url={url}
              isExpanded={isExpanded}
              depth={depth + 1}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
